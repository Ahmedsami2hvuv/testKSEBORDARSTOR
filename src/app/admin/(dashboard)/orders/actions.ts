"use server";

import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";
import { prisma } from "@/lib/prisma";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
} from "@/lib/order-image";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { pushNotifyCourierNewAssignment } from "@/lib/web-push-server";
import { revalidatePath } from "next/cache";

export type AssignOrderState = { error?: string; ok?: boolean };

export async function assignPendingOrderToCourier(
  _prev: AssignOrderState,
  formData: FormData,
): Promise<AssignOrderState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const courierId = String(formData.get("courierId") ?? "").trim();
  const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const doorFile = formData.get("customerDoorPhoto");

  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }
  if (!courierId) {
    return { error: "اختر المندوب ثم اضغط الموافقة" };
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, status: "pending" },
  });
  if (!order) {
    return { error: "الطلب غير متاح أو تم إسناده مسبقاً" };
  }
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
  });
  if (!courier) {
    return { error: "المندوب غير موجود — أضف مندوباً من قسم المندوبين." };
  }
  if (courier.blocked) {
    return { error: "المندوب محظور ولا يمكن إسناد طلبات له." };
  }
  if (courier.hiddenFromReports) {
    return { error: "المندوب مخفي عن الإسناد ولا يمكن إسناد طلبات له." };
  }

  let doorUrl: string | null = order.customerDoorPhotoUrl;
  let doorPhotoJustUploaded = false;
  if (doorFile instanceof File && doorFile.size > 0) {
    try {
      doorUrl = await saveCustomerDoorPhotoUploaded(doorFile, MAX_ORDER_IMAGE_BYTES);
      doorPhotoJustUploaded = true;
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "IMAGE_TOO_LARGE") {
        return { error: "صورة باب الزبون كبيرة (الحد 10 ميجابايت). جرّب تصغير الصورة أو إرسال الطلب دون صورة." };
      }
      if (code === "IMAGE_BAD_TYPE") {
        return { error: "نوع الصورة غير مدعوم (JPG أو PNG أو Webp فقط)" };
      }
      if (code === "IMAGE_STORAGE_FAILED") {
        return {
          error:
            "تعذّر حفظ الصورة على الخادم (الصورة كبيرة أو التخزين غير متاح). جرّب صورة أصغر أو أرسل دون صورة.",
        };
      }
      return { error: "تعذّر حفظ صورة باب الزبون. حاول مرة أخرى." };
    }
  }

  const locMerged = customerLocationUrl.trim() || order.customerLocationUrl;
  const lmMerged = customerLandmark.trim() || order.customerLandmark;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      assignedCourierId: courierId,
      status: "assigned",
      customerLocationUrl: locMerged,
      customerLandmark: lmMerged,
      ...(doorUrl != null ? { customerDoorPhotoUrl: doorUrl } : {}),
      ...(doorPhotoJustUploaded
        ? { customerDoorPhotoUploadedByName: ORDER_UPLOADER_ADMIN_LABEL }
        : {}),
    },
  });

  await syncPhoneProfileFromOrder(orderId);
  void pushNotifyCourierNewAssignment(courierId, order.orderNumber);

  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/couriers");
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export type RejectOrderState = { error?: string; ok?: boolean };

export async function rejectPendingOrder(
  _prev: RejectOrderState,
  formData: FormData,
): Promise<RejectOrderState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, status: "pending" },
  });
  if (!order) {
    return { error: "الطلب غير متاح أو تمت معالجته" };
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "cancelled" },
  });
  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/rejected");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
