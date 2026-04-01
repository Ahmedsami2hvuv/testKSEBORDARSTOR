"use server";

import { randomBytes } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
} from "@/lib/order-image";
import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";
import { prisma } from "@/lib/prisma";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import {
  MAX_VOICE_NOTE_BYTES,
  saveVoiceNoteUploaded,
} from "@/lib/voice-note";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import {
  syncPhoneProfileFromOrder,
  syncSecondPhoneProfileFromOrder,
} from "@/lib/customer-phone-profile-sync";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export type AdminCreateOrderState = { ok?: boolean; error?: string };

type AdminSubmissionMode = "from_shop" | "admin_one_face" | "two_faces";

const SYSTEM_ADMIN_SHOP_NAME = "طلبات الإدارة العامة";
const SYSTEM_ADMIN_PHONE = "07733921568";

/**
 * جلب أو إنشاء محل النظام الخاص بالطلبات الإدارية المباشرة
 */
async function getOrCreateSystemAdminShop(): Promise<{ id: string, regionId: string, photoUrl: string | null }> {
  let shop = await prisma.shop.findFirst({
    where: { name: SYSTEM_ADMIN_SHOP_NAME }
  });

  if (!shop) {
    const firstRegion = await prisma.region.findFirst();
    if (!firstRegion) throw new Error("يجب إضافة منطقة واحدة على الأقل في النظام.");

    shop = await prisma.shop.create({
      data: {
        name: SYSTEM_ADMIN_SHOP_NAME,
        phone: SYSTEM_ADMIN_PHONE,
        locationUrl: "",
        regionId: firstRegion.id,
      }
    });
  } else if (shop.phone !== SYSTEM_ADMIN_PHONE) {
    // تحديث رقم الإدارة إذا كان مختلفاً
    shop = await prisma.shop.update({
      where: { id: shop.id },
      data: { phone: SYSTEM_ADMIN_PHONE }
    });
  }

  return { id: shop.id, regionId: shop.regionId, photoUrl: shop.photoUrl || null };
}

/**
 * ربط الزبون بالمحل والرقم — وتحديث التفاصيل المكانية.
 */
async function upsertCustomerByPhone(opts: {
  shopId: string;
  phone: string;
  regionId: string | null;
  locationUrl?: string;
  landmark?: string;
  doorPhotoUrl?: string | null;
}): Promise<{ id: string }> {
  const { shopId, phone, regionId, locationUrl, landmark, doorPhotoUrl } = opts;

  const existing = await prisma.customer.findFirst({
    where: { shopId, phone },
  });

  const data = {
    customerRegionId: regionId,
    customerLocationUrl: locationUrl ?? "",
    customerLandmark: landmark ?? "",
    customerDoorPhotoUrl: doorPhotoUrl ?? null,
  };

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
  }

  return prisma.customer.create({
    data: {
      shopId,
      phone,
      name: "",
      ...data,
    },
    select: { id: true },
  });
}

export async function createAdminOrder(
  _prev: AdminCreateOrderState,
  formData: FormData,
): Promise<AdminCreateOrderState> {
  const modeRaw = String(formData.get("adminSubmissionMode") ?? "from_shop").trim();
  const adminSubmissionMode: AdminSubmissionMode =
    modeRaw === "admin_one_face" || modeRaw === "two_faces" ? modeRaw : "from_shop";

  const routeMode: "single" | "double" = adminSubmissionMode === "two_faces" ? "double" : "single";

  let adminOrderCode = String(formData.get("adminOrderCode") ?? "").trim();
  if (!adminOrderCode) {
    adminOrderCode = `ADM-${randomBytes(5).toString("hex").toUpperCase()}`;
  }

  // تحديد المحل المسؤول
  let targetShopId = "";
  if (adminSubmissionMode === "from_shop") {
    targetShopId = String(formData.get("shopId") ?? "").trim();
    if (!targetShopId) return { error: "اختر المحل." };
  } else {
    // في حالة وجهة واحدة أو وجهتين، نستخدم حصراً محل النظام الخاص بالإدارة
    const systemShop = await getOrCreateSystemAdminShop();
    targetShopId = systemShop.id;
  }

  const orderType = String(formData.get("orderType") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const orderNoteTime = String(formData.get("orderNoteTime") ?? "").trim();

  const firstPhoneRaw = String(formData.get("firstCustomerPhone") ?? "").trim();
  const firstRegionIdRaw = String(formData.get("firstCustomerRegionId") ?? "").trim();
  const firstLocationUrl = String(formData.get("firstCustomerLocationUrl") ?? "").trim();
  const firstLandmark = String(formData.get("firstCustomerLandmark") ?? "").trim();

  const secondPhoneRaw = String(formData.get("secondCustomerPhone") ?? "").trim();
  const secondRegionIdRaw = String(formData.get("secondCustomerRegionId") ?? "").trim();
  const secondLocationUrl = String(formData.get("secondCustomerLocationUrl") ?? "").trim();
  const secondLandmark = String(formData.get("secondCustomerLandmark") ?? "").trim();

  if (!orderType) return { error: "نوع الطلب مطلوب." };
  if (!orderNoteTime) return { error: "وقت الطلب إجباري." };

  const firstPhone = normalizeIraqMobileLocal11(firstPhoneRaw);
  if (!firstPhone) return { error: "رقم الزبون غير صالح." };
  if (!firstRegionIdRaw) return { error: "منطقة الزبون مطلوبة." };

  let secondPhone: string | null = null;
  let secondRegionId: string | null = null;
  if (routeMode === "double") {
    secondPhone = normalizeIraqMobileLocal11(secondPhoneRaw);
    if (!secondPhone) return { error: "رقم المستلم غير صالح." };
    if (!secondRegionIdRaw) return { error: "منطقة المستلم مطلوبة." };
    secondRegionId = secondRegionIdRaw;
  }

  const subtotalParsed = parseAlfInputToDinarDecimalRequired(
    String(formData.get("orderSubtotal") ?? ""),
  );
  if (!subtotalParsed.ok) return { error: "سعر الطلب غير صالح." };

  const [shop, firstRegion] = await Promise.all([
    prisma.shop.findUnique({ where: { id: targetShopId }, include: { region: true } }),
    prisma.region.findUnique({ where: { id: firstRegionIdRaw } }),
  ]);

  if (!shop || !firstRegion) return { error: "المعلومات الأساسية غير موجودة." };

  let secondRegion = null;
  if (secondRegionId) {
    secondRegion = await prisma.region.findUnique({ where: { id: secondRegionId } });
  }

  // المرفقات
  const orderImg = formData.get("orderImage");
  const firstDoor = formData.get("firstCustomerDoorPhoto");
  const secondDoor = formData.get("secondCustomerDoorPhoto");
  const voice = formData.get("voiceNote");

  let imageUrl: string | null = null;
  let firstDoorUrl: string | null = null;
  let secondDoorUrl: string | null = null;
  let voiceNoteUrl: string | null = null;

  try {
    if (orderImg instanceof File && orderImg.size > 0) imageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
    if (firstDoor instanceof File && firstDoor.size > 0) firstDoorUrl = await saveCustomerDoorPhotoUploaded(firstDoor, MAX_ORDER_IMAGE_BYTES);
    if (secondDoor instanceof File && secondDoor.size > 0) secondDoorUrl = await saveCustomerDoorPhotoUploaded(secondDoor, MAX_ORDER_IMAGE_BYTES);
    if (voice instanceof File && voice.size > 0) voiceNoteUrl = await saveVoiceNoteUploaded(voice, MAX_VOICE_NOTE_BYTES);
  } catch (e) {
    return { error: "تعذّر حفظ الملفات المرفقة." };
  }

  const firstCustomerRow = await upsertCustomerByPhone({
    shopId: targetShopId,
    phone: firstPhone,
    regionId: firstRegionIdRaw,
    locationUrl: firstLocationUrl,
    landmark: firstLandmark,
    doorPhotoUrl: firstDoorUrl,
  });

  if (routeMode === "double" && secondPhone && secondRegionId) {
    await upsertCustomerByPhone({
      shopId: targetShopId,
      phone: secondPhone,
      regionId: secondRegionId,
      locationUrl: secondLocationUrl,
      landmark: secondLandmark,
      doorPhotoUrl: secondDoorUrl,
    });
  }

  // التسعير
  const shopDel = shop.region.deliveryPrice;
  const firstDel = firstRegion.deliveryPrice;
  const secondDel = secondRegion?.deliveryPrice ?? new Decimal(0);

  const delivery = adminSubmissionMode === "admin_one_face"
    ? firstDel
    : (routeMode === "double"
        ? Decimal.max(shopDel, firstDel, secondDel)
        : Decimal.max(shopDel, firstDel));

  const total = new Decimal(subtotalParsed.value).plus(delivery);

  const order = await prisma.order.create({
    data: {
      shopId: targetShopId,
      customerId: firstCustomerRow.id,
      status: "pending",
      routeMode,
      adminOrderCode,
      submissionSource: "admin_portal",
      summary,
      orderType,
      orderNoteTime,
      customerPhone: firstPhone,
      customerRegionId: firstRegionIdRaw,
      customerLocationUrl: firstLocationUrl,
      customerLandmark: firstLandmark,
      customerDoorPhotoUrl: firstDoorUrl || null,
      secondCustomerPhone: routeMode === "double" ? secondPhone : null,
      secondCustomerRegionId: routeMode === "double" ? secondRegionId : null,
      secondCustomerLocationUrl: routeMode === "double" ? secondLocationUrl : "",
      secondCustomerLandmark: routeMode === "double" ? secondLandmark : "",
      secondCustomerDoorPhotoUrl: routeMode === "double" ? (secondDoorUrl || null) : null,
      orderSubtotal: subtotalParsed.value,
      deliveryPrice: delivery,
      totalAmount: total,
      imageUrl,
      voiceNoteUrl,
      shopDoorPhotoUrl: shop.photoUrl?.trim() || null,
      orderImageUploadedByName: imageUrl ? ORDER_UPLOADER_ADMIN_LABEL : null,
      customerDoorPhotoUploadedByName: firstDoorUrl ? ORDER_UPLOADER_ADMIN_LABEL : null,
    },
  });

  await syncPhoneProfileFromOrder(order.id);
  if (routeMode === "double") await syncSecondPhoneProfileFromOrder(order.id);

  void notifyTelegramNewOrder(order.id);
  void pushNotifyAdminsNewPendingOrder(order.orderNumber);

  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/orders/tracking");
  return { ok: true };
}
