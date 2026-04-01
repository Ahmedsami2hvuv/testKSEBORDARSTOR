"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export type StoreOrderAdminState = { ok?: boolean; error?: string };

async function requireAdmin(): Promise<StoreOrderAdminState | null> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح. سجّل الدخول من لوحة الإدارة." };
  }
  return null;
}

export async function setStoreOrderStatus(
  _prev: StoreOrderAdminState,
  formData: FormData,
): Promise<StoreOrderAdminState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const status =
    statusRaw === "pending"
      ? "pending"
      : statusRaw === "confirmed"
        ? "confirmed"
        : statusRaw === "cancelled"
          ? "cancelled"
          : null;
  if (!id) return { error: "معرّف الطلب مفقود." };
  if (!status) return { error: "حالة غير صالحة." };

  await prisma.storeOrder.update({ where: { id }, data: { status } });
  revalidatePath("/admin/store/orders");
  revalidatePath("/admin/store/reports");
  return { ok: true };
}

