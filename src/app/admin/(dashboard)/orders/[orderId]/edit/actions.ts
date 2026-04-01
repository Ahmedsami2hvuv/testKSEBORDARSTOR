"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { unlink } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
} from "@/lib/order-image";
import { syncOrderCourierMoneyExpectations } from "@/lib/order-courier-money-sync";
import { prisma } from "@/lib/prisma";
import { getUploadsRoot } from "@/lib/upload-storage";
import { MAX_VOICE_NOTE_BYTES, saveVoiceNoteUploaded } from "@/lib/voice-note";
import { parseOptionalAlfInputToDinar } from "@/lib/money-alf";
import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { reconcileMoneyEventsOnOrderStatusChange } from "@/lib/order-money-reconcile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function assertAdmin(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(adminCookieName)?.value ?? "";
  return !!(t && (await verifyAdminToken(t)));
}

function revalidateAdminOrderPaths(orderId: string) {
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/orders/rejected");
  revalidatePath("/admin/orders/archived");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
}

export type AdminOrderLocationAction = {
  ok?: boolean;
  error?: string;
  locationUrl?: string;
};

/** مسح رابط موقع الزبون من الطلب وسجل العميل المرتبط (لو وجد). */
export async function clearOrderCustomerLocationAdmin(
  orderId: string,
): Promise<AdminOrderLocationAction> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح" };
  }
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    return { error: "الطلب غير موجود" };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerLocationUrl: "",
      customerLocationSetByCourierAt: null,
      customerLocationUploadedByName: null,
    },
  });

  await syncPhoneProfileFromOrder(orderId);

  revalidateAdminOrderPaths(orderId);
  return { ok: true };
}

/** استبدال رابط الموقع بإحداثيات GPS الحالية (من لوحة الإدارة). */
export async function setAdminOrderCustomerLocationFromGeolocation(
  orderId: string,
  lat: number,
  lng: number,
): Promise<AdminOrderLocationAction> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "تعذّر قراءة الإحداثيات." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "إحداثيات خارج النطاق." };
  }
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    return { error: "الطلب غير موجود" };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerLocationUrl: mapsUrl,
      customerLocationSetByCourierAt: null,
      customerLocationUploadedByName: ORDER_UPLOADER_ADMIN_LABEL,
    },
  });

  await syncPhoneProfileFromOrder(orderId);

  revalidateAdminOrderPaths(orderId);
  return { ok: true, locationUrl: mapsUrl };
}

async function unlinkUploadIfAny(url: string | null | undefined): Promise<void> {
  const u = url?.trim();
  if (!u || !u.startsWith("/uploads/")) return;
  try {
    const rel = u.replace(/^\/uploads\/?/, "");
    await unlink(path.join(getUploadsRoot(), rel));
  } catch {
    /* ملف مفقود */
  }
}

export type PendingCustomerImport = {
  customerId: string;
  regionName: string | null;
  customerName: string;
  locationUrl: string;
  landmark: string;
  alternatePhone: string;
  hasDoorPhoto: boolean;
  doorPhotoUrl: string;
};

export type OrderEditState = {
  error?: string;
  ok?: boolean;
  pendingCustomerImport?: PendingCustomerImport;
};

export async function updateOrderAdmin(
  orderId: string,
  _prev: OrderEditState,
  formData: FormData,
): Promise<OrderEditState> {
  const shopId = String(formData.get("shopId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const orderType = String(formData.get("orderType") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const alternatePhone = String(formData.get("alternatePhone") ?? "").trim();
  const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const orderNoteTime = String(formData.get("orderNoteTime") ?? "").trim();
  const courierRaw = String(formData.get("assignedCourierId") ?? "").trim();
  const customerIdRaw = String(formData.get("customerId") ?? "").trim();
  const submittedByEmployeeIdRaw = String(
    formData.get("submittedByEmployeeId") ?? "",
  ).trim();
  const prepaidAll = formData.get("prepaidAll") === "on";

  const allowed = new Set([
    "pending",
    "assigned",
    "delivering",
    "delivered",
    "cancelled",
    "archived",
  ]);
  if (!allowed.has(status)) {
    return { error: "حالة الطلب غير صالحة" };
  }
  if (!orderNoteTime) {
    return { error: "وقت الطلب إجباري" };
  }

  const sub = parseOptionalAlfInputToDinar(String(formData.get("orderSubtotal") ?? ""));
  const del = parseOptionalAlfInputToDinar(String(formData.get("deliveryPrice") ?? ""));
  const tot = parseOptionalAlfInputToDinar(String(formData.get("totalAmount") ?? ""));
  if (!sub.ok) return { error: "سعر الطلب غير صالح (أدخل المبلغ بالألف)" };
  if (!del.ok) return { error: "سعر التوصيل غير صالح (بالألف)" };
  if (!tot.ok) return { error: "المجموع غير صالح (بالألف)" };

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    return { error: "الطلب غير موجود" };
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return { error: "المحل غير موجود" };
  }
  const shopDoorFromShop = shop.photoUrl?.trim() || null;

  let linkedCustomerId: string | null = customerIdRaw || null;
  if (linkedCustomerId) {
    const cust = await prisma.customer.findUnique({ where: { id: linkedCustomerId } });
    if (!cust || cust.shopId !== shopId) {
      return { error: "زبون التوصيل المختار لا يتبع هذا المحل" };
    }
  }

  let submittedByEmployeeId: string | null = null;
  if (submittedByEmployeeIdRaw) {
    const emp = await prisma.employee.findUnique({
      where: { id: submittedByEmployeeIdRaw },
    });
    if (!emp || emp.shopId !== shopId) {
      return { error: "عميل المحل المختار لا يتبع هذا المحل" };
    }
    submittedByEmployeeId = emp.id;
  }

  let regionId: string | null = customerRegionId || null;
  if (regionId) {
    const r = await prisma.region.findUnique({ where: { id: regionId } });
    if (!r) regionId = null;
  }

  let assignedCourierId: string | null = courierRaw || null;
  if (status === "pending" || status === "cancelled" || status === "archived") {
    assignedCourierId = null;
  } else if (assignedCourierId) {
    const c = await prisma.courier.findUnique({ where: { id: assignedCourierId } });
    if (!c) {
      assignedCourierId = null;
    } else if (
      (c.blocked || c.hiddenFromReports) &&
      assignedCourierId !== existing.assignedCourierId
    ) {
      return {
        error:
          "هذا المندوب غير متاح للإسناد (محظور أو مخفي عن قوائم الإسناد). اختر مندوباً آخر أو ألغِ الإخفاء من صفحة المندوب.",
      };
    }
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return { error: "رقم الزبون غير صالح. جرّب صيغة عراقية شائعة (07… أو +964…)." };
  }
  let altPhone: string | null = null;
  if (alternatePhone.trim()) {
    const a = normalizeIraqMobileLocal11(alternatePhone);
    if (!a) {
      return { error: "الرقم الثاني غير صالح أو اتركه فارغاً." };
    }
    if (a === phoneLocal) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    altPhone = a;
  }

  const importChoice = String(formData.get("customerImportChoice") ?? "").trim();

  let effectiveLocationUrl = customerLocationUrl;
  let effectiveLandmark = customerLandmark;
  let effectiveLinkedCustomerId: string | null = linkedCustomerId;
  let doorPhotoFromImport: string | undefined;

  if (importChoice === "confirm") {
    const importId = String(formData.get("importCustomerId") ?? "").trim();
    if (!importId) {
      return { error: "معرّف استيراد بيانات العميل مفقود." };
    }
    const importCust = await prisma.customer.findFirst({
      where: {
        id: importId,
        shopId,
        phone: phoneLocal,
        customerRegionId: regionId,
      },
    });
    if (!importCust) {
      return {
        error:
          "تعذّر مطابقة بيانات زبون التوصيل المخزّنة. أعد المحاولة أو احفظ دون الاستيراد.",
      };
    }
    effectiveLinkedCustomerId = importCust.id;
    effectiveLocationUrl =
      importCust.customerLocationUrl?.trim() || customerLocationUrl;
    effectiveLandmark = importCust.customerLandmark?.trim() || customerLandmark;
    if (importCust.customerDoorPhotoUrl?.trim()) {
      doorPhotoFromImport = importCust.customerDoorPhotoUrl.trim();
    }
  } else if (importChoice === "decline") {
    /* يُحفظ الطلب بالقيم المدخلة دون استيراد من سجل آخر */
  } else {
    /** طلبات رابط العميل: لا نُوقف الحفظ بمطالبة «استيراد» سجل آخر لنفس الرقم والمنطقة */
    const skipCustomerImportPrompt =
      existing.submissionSource === "customer_via_employee_link";
    const prevPhone = normalizeIraqMobileLocal11(existing.customerPhone) ?? "";
    const phoneChanged = prevPhone !== phoneLocal;
    if (!skipCustomerImportPrompt && phoneChanged && regionId) {
      const match = await prisma.customer.findFirst({
        where: {
          shopId,
          phone: phoneLocal,
          customerRegionId: regionId,
        },
        include: { customerRegion: true },
        orderBy: { updatedAt: "desc" },
      });
      const hasStoredDetails =
        match &&
        (match.customerLocationUrl.trim() ||
          match.customerLandmark.trim() ||
          match.customerDoorPhotoUrl?.trim());
      if (
        match &&
        hasStoredDetails &&
        match.id !== existing.customerId
      ) {
        return {
          pendingCustomerImport: {
            customerId: match.id,
            regionName: match.customerRegion?.name ?? null,
            customerName: match.name?.trim() ?? "",
            locationUrl: match.customerLocationUrl,
            landmark: match.customerLandmark,
            alternatePhone: match.alternatePhone?.trim() ?? "",
            hasDoorPhoto: Boolean(match.customerDoorPhotoUrl?.trim()),
            doorPhotoUrl: match.customerDoorPhotoUrl?.trim() ?? "",
          },
        };
      }
    }
  }

  let nextImageUrl: string | undefined = undefined;
  const orderImg = formData.get("orderImage");
  if (orderImg instanceof File && orderImg.size > 0) {
    try {
      nextImageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "IMAGE_TOO_LARGE") {
        return { error: "صورة الطلب كبيرة جداً (الحد 10 ميجابايت)" };
      }
      if (code === "IMAGE_BAD_TYPE") {
        return { error: "نوع الصورة غير مدعوم (JPG أو PNG أو Webp)" };
      }
      if (code === "IMAGE_STORAGE_FAILED") {
        return {
          error:
            "تعذّر حفظ الصورة على الخادم. جرّب صورة أصغر أو احفظ دون تغيير الصورة.",
        };
      }
      return { error: "تعذّر حفظ صورة الطلب" };
    }
  }

  let nextAdminVoiceUrl: string | undefined = undefined;
  const adminVoice = formData.get("adminVoice");
  if (adminVoice instanceof File && adminVoice.size > 0) {
    try {
      nextAdminVoiceUrl = await saveVoiceNoteUploaded(adminVoice, MAX_VOICE_NOTE_BYTES);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "VOICE_TOO_LARGE") {
        return { error: "الملف الصوتي كبير جداً (الحد 2 ميجابايت)" };
      }
      if (code === "VOICE_BAD_TYPE") {
        return { error: "نوع الملف الصوتي غير مدعوم" };
      }
      if (code === "VOICE_STORAGE_FAILED") {
        return { error: "تعذّر حفظ الملف الصوتي على الخادم" };
      }
      return { error: "تعذّر رفع ملاحظة الإدارة الصوتية" };
    }
    await unlinkUploadIfAny(existing.adminVoiceNoteUrl);
  }

  const totalFromSubDel =
    sub.value != null && del.value != null
      ? new Decimal(sub.value).plus(new Decimal(del.value))
      : tot.value != null
        ? new Decimal(tot.value)
        : null;

  let nextArchivedAt: Date | null | undefined = undefined;
  if (existing.status !== status) {
    if (status === "archived") nextArchivedAt = new Date();
    else if (existing.status === "archived") nextArchivedAt = null;
  }

  await prisma.$transaction(async (tx) => {
    if (existing.status !== status) {
      await reconcileMoneyEventsOnOrderStatusChange(
        tx,
        orderId,
        existing.status,
        status,
      );
    }

    let nextCourierEarning: Decimal | null = null;
    let nextCourierEarningForId: string | null = null;
    if (status === "delivered" && assignedCourierId && del.value != null) {
      const courierRow = await tx.courier.findUnique({
        where: { id: assignedCourierId },
      });
      if (courierRow) {
        nextCourierEarning = computeCourierDeliveryEarningDinar(
          courierRow.vehicleType,
          new Decimal(del.value),
        );
        nextCourierEarningForId =
          nextCourierEarning != null ? assignedCourierId : null;
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        shopId,
        submittedByEmployeeId,
        ...(submittedByEmployeeId
          ? { submittedByCompanyPreparerId: null }
          : {}),
        customerId: effectiveLinkedCustomerId,
        status,
        orderType,
        summary,
        customerPhone: phoneLocal,
        alternatePhone: altPhone,
        customerLocationUrl: effectiveLocationUrl,
        ...(existing.customerLocationUrl.trim() !== effectiveLocationUrl.trim()
          ? {
              customerLocationSetByCourierAt: null,
              customerLocationUploadedByName: null,
            }
          : {}),
        customerLandmark: effectiveLandmark,
        customerRegionId: regionId,
        orderSubtotal: sub.value,
        deliveryPrice: del.value,
        totalAmount: totalFromSubDel,
        orderNoteTime,
        assignedCourierId,
        courierEarningDinar:
          status === "delivered" ? nextCourierEarning : existing.courierEarningDinar,
        courierEarningForCourierId:
          status === "delivered"
            ? nextCourierEarningForId
            : existing.courierEarningForCourierId,
        ...(nextImageUrl != null
          ? { imageUrl: nextImageUrl, orderImageUploadedByName: ORDER_UPLOADER_ADMIN_LABEL }
          : {}),
        ...(nextAdminVoiceUrl != null ? { adminVoiceNoteUrl: nextAdminVoiceUrl } : {}),
        ...(doorPhotoFromImport !== undefined
          ? {
              customerDoorPhotoUrl: doorPhotoFromImport,
              customerDoorPhotoUploadedByName: null,
            }
          : {}),
        ...((!existing.shopDoorPhotoUrl?.trim() || existing.shopId !== shopId)
          ? {
              shopDoorPhotoUrl: shopDoorFromShop,
              shopDoorPhotoUploadedByName: null,
            }
          : {}),
        prepaidAll,
        ...(nextArchivedAt !== undefined ? { archivedAt: nextArchivedAt } : {}),
      },
    });

    await syncOrderCourierMoneyExpectations(tx, orderId);
  });

  if (effectiveLinkedCustomerId) {
    await prisma.customer.update({
      where: { id: effectiveLinkedCustomerId },
      data: {
        phone: phoneLocal,
        customerRegionId: regionId,
        customerLocationUrl: "",
        customerLandmark: "",
        alternatePhone: null,
        customerDoorPhotoUrl: null,
      },
    });
  }

  await syncPhoneProfileFromOrder(orderId);

  revalidateAdminOrderPaths(orderId);
  if (status === "archived") {
    redirect("/admin/orders/archived");
  }
  redirect("/admin/orders/tracking");
}
