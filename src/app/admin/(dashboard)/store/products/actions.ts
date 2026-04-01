"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { uniqueSlug } from "@/lib/slugify";
import { MAX_ORDER_IMAGE_BYTES, saveStoreProductImageUploaded } from "@/lib/order-image";
import { parseStoredProductImages, serializeStoredProductImages } from "@/lib/store-image-utils";

export type StoreProductFormState = { ok?: boolean; error?: string };
export type StoreProductAssignState = { ok?: boolean; error?: string };

async function requireAdmin(): Promise<StoreProductFormState | null> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح. سجّل الدخول من لوحة الإدارة." };
  }
  return null;
}

export async function createStoreProductWithVariant(
  _prev: StoreProductFormState,
  formData: FormData,
): Promise<StoreProductFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageFiles = formData
    .getAll("imageFiles")
    .filter((x): x is File => x instanceof File && x.size > 0);
  const categoryIds = formData
    .getAll("categoryIds")
    .map((x) => String(x).trim())
    .filter(Boolean);
  const primaryCategoryIdRaw = String(formData.get("primaryCategoryId") ?? "").trim();
  const primaryCategoryId = primaryCategoryIdRaw || categoryIds[0] || null;

  const color = String(formData.get("color") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim();
  const shape = String(formData.get("shape") ?? "").trim();

  const saleAlf = String(formData.get("salePriceAlf") ?? "").trim();
  const costAlf = String(formData.get("costPriceAlf") ?? "").trim();

  if (!name) return { error: "اسم المنتج مطلوب." };
  if (imageFiles.length === 0) {
    return { error: "صورة واحدة على الأقل للمنتج مطلوبة." };
  }
  const saleParsed = parseAlfInputToDinarDecimalRequired(saleAlf);
  if (!saleParsed.ok) return { error: "سعر البيع بالألف غير صالح." };
  const costParsed = parseAlfInputToDinarDecimalRequired(costAlf);
  if (!costParsed.ok) return { error: "سعر الشراء بالألف غير صالح." };
  const slug = uniqueSlug(name, Date.now().toString(36));
  let imageUrls = "";
  try {
    const uploaded: string[] = [];
    for (const file of imageFiles) {
      uploaded.push(await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES));
    }
    imageUrls = serializeStoredProductImages(uploaded);
  } catch {
    return { error: "فشل رفع صور المنتج." };
  }

  const optionValues: Record<string, string> = {};
  if (color) optionValues.color = color;
  if (size) optionValues.size = size;
  if (shape) optionValues.shape = shape;

  await prisma.storeProduct.create({
    data: {
      name,
      slug,
      description,
      imageUrls,
      categoryId: primaryCategoryId,
      categories:
        categoryIds.length > 0
          ? {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            }
          : undefined,
      variants: {
        create: {
          optionValues,
          salePriceDinar: new Decimal(saleParsed.value),
          costPriceDinar: new Decimal(costParsed.value),
        },
      },
    },
  });

  revalidatePath("/admin/store/products");
  return { ok: true };
}

export async function assignProductCategories(
  _prev: StoreProductAssignState,
  formData: FormData,
): Promise<StoreProductAssignState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const productId = String(formData.get("productId") ?? "").trim();
  const categoryIds = formData
    .getAll("categoryIds")
    .map((x) => String(x).trim())
    .filter(Boolean);
  const primaryCategoryIdRaw = String(formData.get("primaryCategoryId") ?? "").trim();
  const primaryCategoryId = primaryCategoryIdRaw || categoryIds[0] || null;

  if (!productId) return { error: "معرّف المنتج مفقود." };

  await prisma.$transaction(async (tx) => {
    await tx.storeProductCategory.deleteMany({ where: { productId } });
    for (const categoryId of categoryIds) {
      await tx.storeProductCategory.create({ data: { productId, categoryId } });
    }
    await tx.storeProduct.update({
      where: { id: productId },
      data: { categoryId: primaryCategoryId },
    });
  });

  revalidatePath("/admin/store/products");
  return { ok: true };
}

export async function updateStoreProduct(
  _prev: StoreProductFormState,
  formData: FormData,
): Promise<StoreProductFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const primaryCategoryIdRaw = String(formData.get("primaryCategoryId") ?? "").trim();
  const primaryCategoryId = primaryCategoryIdRaw || null;
  const imageFiles = formData
    .getAll("imageFiles")
    .filter((x): x is File => x instanceof File && x.size > 0);

  if (!id) return { error: "معرّف المنتج مفقود." };
  if (!name) return { error: "اسم المنتج مطلوب." };

  let nextImageUrls: string | undefined;
  if (imageFiles.length > 0) {
    try {
      const prev = await prisma.storeProduct.findUnique({
        where: { id },
        select: { imageUrls: true },
      });
      const merged = parseStoredProductImages(prev?.imageUrls);
      for (const file of imageFiles) {
        merged.push(await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES));
      }
      nextImageUrls = serializeStoredProductImages(merged);
    } catch {
      return { error: "فشل رفع صور المنتج." };
    }
  }

  await prisma.storeProduct.update({
    where: { id },
    data: {
      name,
      description,
      categoryId: primaryCategoryId,
      imageUrls: nextImageUrls ?? undefined,
    },
  });

  revalidatePath("/admin/store/products");
  revalidatePath(`/admin/store/products/${id}/edit`);
  return { ok: true };
}

