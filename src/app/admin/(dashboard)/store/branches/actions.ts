"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { MAX_ORDER_IMAGE_BYTES, saveStoreBranchImageUploaded } from "@/lib/order-image";

export type StoreBranchFormState = { ok?: boolean; error?: string };

async function requireAdmin(): Promise<StoreBranchFormState | null> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح. سجّل الدخول من لوحة الإدارة." };
  }
  return null;
}

export async function createStoreBranch(
  _prev: StoreBranchFormState,
  formData: FormData,
): Promise<StoreBranchFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const name = String(formData.get("name") ?? "").trim();
  const imageFile = formData.get("imageFile");
  const shopIdRaw = String(formData.get("shopId") ?? "").trim();
  const shopId = shopIdRaw ? shopIdRaw : null;

  if (!name) return { error: "اسم الفرع مطلوب." };
  if (!(imageFile instanceof File) || imageFile.size <= 0) {
    return { error: "صورة الفرع مطلوبة." };
  }
  let imageUrl = "";
  try {
    imageUrl = await saveStoreBranchImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
  } catch {
    return { error: "فشل رفع صورة الفرع." };
  }

  await prisma.storeBranch.create({ data: { name, imageUrl, shopId } });
  revalidatePath("/admin/store/branches");
  return { ok: true };
}

export async function updateStoreBranch(
  _prev: StoreBranchFormState,
  formData: FormData,
): Promise<StoreBranchFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const shopIdRaw = String(formData.get("shopId") ?? "").trim();
  const shopId = shopIdRaw ? shopIdRaw : null;
  const imageFile = formData.get("imageFile");

  if (!id) return { error: "معرّف الفرع مفقود." };
  if (!name) return { error: "اسم الفرع مطلوب." };

  let nextImageUrl: string | undefined;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      nextImageUrl = await saveStoreBranchImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
    } catch {
      return { error: "فشل رفع صورة الفرع." };
    }
  }

  await prisma.storeBranch.update({
    where: { id },
    data: {
      name,
      shopId,
      imageUrl: nextImageUrl ?? undefined,
    },
  });

  revalidatePath("/admin/store/branches");
  return { ok: true };
}

export async function createStockMovement(
  _prev: StoreBranchFormState,
  formData: FormData,
): Promise<StoreBranchFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const branchId = String(formData.get("branchId") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!branchId) return { error: "اختر فرعاً." };
  if (!variantId) return { error: "اختر متغيراً." };
  if (!quantityRaw) return { error: "أدخل الكمية." };

  const q = parseInt(quantityRaw, 10);
  if (!Number.isFinite(q) || q === 0) return { error: "الكمية غير صالحة." };

  const kind =
    kindRaw === "in" ? "in" : kindRaw === "out" ? "out" : kindRaw === "adjust" ? "adjust" : null;
  if (!kind) return { error: "نوع الحركة غير صالح." };

  // قواعد بسيطة: in/out يجب أن تكون موجبة
  if ((kind === "in" || kind === "out") && q < 0) {
    return { error: "للإدخال/الإخراج أدخل كمية موجبة." };
  }

  await prisma.storeStockMovement.create({
    data: { branchId, variantId, kind, quantity: q, note },
  });

  revalidatePath("/admin/store/branches");
  return { ok: true };
}

