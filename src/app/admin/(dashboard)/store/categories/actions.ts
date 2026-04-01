"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slugify";
import { MAX_ORDER_IMAGE_BYTES, saveStoreCategoryImageUploaded } from "@/lib/order-image";

export type StoreCategoryFormState = { ok?: boolean; error?: string };

async function requireAdmin(): Promise<StoreCategoryFormState | null> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح. سجّل الدخول من لوحة الإدارة." };
  }
  return null;
}

export async function createStoreCategory(
  _prev: StoreCategoryFormState,
  formData: FormData,
): Promise<StoreCategoryFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const name = String(formData.get("name") ?? "").trim();
  const imageFile = formData.get("imageFile");
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

  if (!name) return { error: "اسم القسم مطلوب." };
  if (!(imageFile instanceof File) || imageFile.size <= 0) {
    return { error: "صورة القسم/الفرع مطلوبة." };
  }
  if (!Number.isFinite(sortOrder)) return { error: "ترتيب غير صالح." };
  const slug = uniqueSlug(name, Date.now().toString(36));
  let imageUrl = "";
  try {
    imageUrl = await saveStoreCategoryImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
  } catch {
    return { error: "فشل رفع صورة القسم/الفرع." };
  }

  await prisma.storeCategory.create({
    data: { name, slug, imageUrl, parentId, sortOrder },
  });

  revalidatePath("/admin/store/categories");
  return { ok: true };
}

export async function updateStoreCategory(
  _prev: StoreCategoryFormState,
  formData: FormData,
): Promise<StoreCategoryFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;
  const imageFile = formData.get("imageFile");

  if (!id) return { error: "معرّف القسم مفقود." };
  if (!name) return { error: "اسم القسم مطلوب." };
  if (!Number.isFinite(sortOrder)) return { error: "ترتيب غير صالح." };

  let nextImageUrl: string | undefined;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      nextImageUrl = await saveStoreCategoryImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
    } catch {
      return { error: "فشل رفع صورة القسم/الفرع." };
    }
  }

  await prisma.storeCategory.update({
    where: { id },
    data: {
      name,
      parentId,
      sortOrder,
      imageUrl: nextImageUrl ?? undefined,
    },
  });

  revalidatePath("/admin/store/categories");
  revalidatePath(`/admin/store/categories/${id}`);
  return { ok: true };
}

