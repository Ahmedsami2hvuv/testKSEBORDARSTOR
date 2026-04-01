"use server";

import type { CourierVehicleType } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { fetchMandoubMoneySumsForCourier } from "@/lib/mandoub-courier-event-totals";
import { mandoubWalletRemainDinar } from "@/lib/mandoub-wallet-carry";
import { sumPendingIncomingForCourier, sumPendingOutgoingForCourier } from "@/lib/wallet-peer-transfer";
import {
  isPlausibleWhatsAppNumber,
  normalizePhoneDigits,
} from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

export type CourierFormState = { error?: string; ok?: boolean };

export type CourierMandoubResetState = { error?: string; ok?: boolean };

async function assertAdmin(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(adminCookieName)?.value ?? "";
  return !!(t && (await verifyAdminToken(t)));
}

/**
 * تصفير المحفظة:
 * 1. تعيين خط أساس زمني جديد (mandoubTotalsResetAt) لإخفاء الحركات القديمة من العرض الحالي.
 * 2. تصفير الرصيد المحمول (mandoubWalletCarryOverDinar) ليصبح متبقي المحفظة 0.
 * ملاحظة: مربع "للإدارة" يعتمد على سجل الأحداث التراكمي (All Time) لذا لن يتأثر بالتصفير،
 * لكنه سيتأثر عند تسجيل حركات "أعطيت" فعلية.
 */
export async function resetCourierMandoubTotals(
  courierId: string,
  _prev: CourierMandoubResetState,
  _formData: FormData,
): Promise<CourierMandoubResetState> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح." };
  }
  const c = await prisma.courier.findUnique({ where: { id: courierId } });
  if (!c) {
    return { error: "المندوب غير موجود." };
  }

  // عند التصفير، نجعل المحمول 0 ونحدّث الوقت، ليكون متبقي المحفظة في الفترة الجديدة 0.
  await prisma.courier.update({
    where: { id: courierId },
    data: {
      mandoubTotalsResetAt: new Date(),
      mandoubWalletCarryOverDinar: new Decimal(0),
    },
  });

  revalidatePath("/admin/couriers");
  revalidatePath(`/admin/couriers/${courierId}/edit`);
  revalidatePath("/admin/reports/couriers");
  revalidatePath("/admin/reports/courier-mandoub");
  revalidatePath("/mandoub");
  revalidatePath("/mandoub/wallet");
  return { ok: true };
}

export async function createCourier(
  _prev: CourierFormState,
  formData: FormData,
): Promise<CourierFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = normalizePhoneDigits(phoneRaw);
  const telegramUserIdRaw = String(formData.get("telegramUserId") ?? "").trim();
  const telegramUserId = telegramUserIdRaw.length > 0 ? telegramUserIdRaw : null;

  if (!name) {
    return { error: "اسم المندوب مطلوب" };
  }
  if (!phoneRaw) {
    return { error: "رقم الهاتف مطلوب" };
  }
  if (!phone || !isPlausibleWhatsAppNumber(phone)) {
    return {
      error:
        "رقم الهاتف غير صالح. جرّب مثل 077xxxxxxxxx أو +964 77x xxx xxxx",
    };
  }
  if (telegramUserId && !/^\d+$/.test(telegramUserId)) {
    return { error: "Telegram User ID غير صالح. اتركه فارغاً أو أدخل أرقاماً فقط." };
  }
  const vehicleRaw = String(formData.get("vehicleType") ?? "").trim();
  const vehicleType: CourierVehicleType =
    vehicleRaw === "bike" ? "bike" : "car";
  await prisma.courier.create({
    data: { name, phone, telegramUserId, vehicleType },
  });
  revalidatePath("/admin/couriers");
  revalidatePath("/admin/orders/pending");
  return { ok: true };
}

export async function updateCourier(
  courierId: string,
  _prev: CourierFormState,
  formData: FormData,
): Promise<CourierFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = normalizePhoneDigits(phoneRaw);
  const telegramUserIdRaw = String(formData.get("telegramUserId") ?? "").trim();
  const telegramUserId =
    telegramUserIdRaw.length > 0 ? telegramUserIdRaw : null;
  if (!name) {
    return { error: "اسم المندوب مطلوب" };
  }
  if (!phoneRaw) {
    return { error: "رقم الهاتف مطلوب" };
  }
  if (!phone || !isPlausibleWhatsAppNumber(phone)) {
    return {
      error:
        "رقم الهاتف غير صالح. جرّب مثل 077xxxxxxxxx أو +964 77x xxx xxxx",
    };
  }
  if (telegramUserIdRaw && !/^\d+$/.test(telegramUserIdRaw)) {
    return { error: "Telegram User ID غير صالح. اتركه فارغاً أو أدخل أرقاماً فقط." };
  }
  const vehicleRaw = String(formData.get("vehicleType") ?? "").trim();
  const vehicleType: CourierVehicleType =
    vehicleRaw === "bike" ? "bike" : "car";
  const c = await prisma.courier.findUnique({ where: { id: courierId } });
  if (!c) {
    return { error: "المندوب غير موجود" };
  }
  const hiddenFromReports = formData.get("hiddenFromReports") === "on";
  const blocked = formData.get("blocked") === "on";

  await prisma.courier.update({
    where: { id: courierId },
    data: {
      name,
      phone,
      telegramUserId,
      vehicleType,
      hiddenFromReports,
      blocked,
    },
  });
  revalidatePath("/admin/couriers");
  revalidatePath(`/admin/couriers/${courierId}/edit`);
  revalidatePath("/admin/orders/pending");
  revalidatePath("/admin/reports/couriers");
  return { ok: true };
}

export async function deleteCourier(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.courier.delete({ where: { id } });
  revalidatePath("/admin/couriers");
  revalidatePath("/admin/orders/pending");
}
