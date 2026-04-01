"use server";

import {
  MAX_ORDER_IMAGE_BYTES,
  saveCustomerProfilePhotoUploaded,
} from "@/lib/order-image";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CustomerProfileFormState = { error?: string; ok?: boolean };

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

async function photoFromForm(
  formData: FormData,
  fieldName: string,
): Promise<
  { ok: true; photoUrl: string | null } | { ok: false; error: string }
> {
  const f = formData.get(fieldName);
  if (!(f instanceof File) || f.size === 0) {
    return { ok: true, photoUrl: null };
  }
  try {
    const photoUrl = await saveCustomerProfilePhotoUploaded(
      f,
      MAX_ORDER_IMAGE_BYTES,
    );
    return { ok: true, photoUrl };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "IMAGE_TOO_LARGE") {
      return { ok: false, error: "الصورة كبيرة جداً (الحد 10 ميجابايت)" };
    }
    if (code === "IMAGE_BAD_TYPE") {
      return { ok: false, error: "نوع الصورة غير مدعوم (JPG أو PNG أو Webp)" };
    }
    if (code === "IMAGE_STORAGE_FAILED") {
      return {
        ok: false,
        error:
          "تعذّر حفظ الصورة على الخادم. جرّب صورة أصغر أو أعد المحاولة لاحقاً.",
      };
    }
    return { ok: false, error: "تعذّر حفظ الصورة" };
  }
}

function parseLocationUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, url: "" };
  const url = normalizeUrl(t);
  try {
    new URL(url);
  } catch {
    return { ok: false, error: "رابط اللوكيشن غير صالح" };
  }
  return { ok: true, url };
}

export async function upsertCustomerPhoneProfile(
  _prev: CustomerProfileFormState,
  formData: FormData,
): Promise<CustomerProfileFormState> {
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const n = normalizeIraqMobileLocal11(phoneRaw);
  if (!n) {
    return {
      error:
        "رقم الهاتف غير صالح (أدخل رقماً عراقياً محلياً مثل 07xxxxxxxx)",
    };
  }
  const regionId = String(formData.get("regionId") ?? "").trim();
  if (!regionId) {
    return { error: "اختر المنطقة" };
  }
  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) {
    return { error: "المنطقة غير موجودة" };
  }
  const locParsed = parseLocationUrl(String(formData.get("locationUrl") ?? ""));
  if (!locParsed.ok) {
    return { error: locParsed.error };
  }
  const landmark = String(formData.get("landmark") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const altRaw = String(formData.get("alternatePhone") ?? "").trim();
  let alternatePhone: string | null = null;
  if (altRaw) {
    const alt = normalizeIraqMobileLocal11(altRaw);
    if (!alt) {
      return { error: "الرقم الثاني غير صالح أو اتركه فارغاً." };
    }
    if (alt === n) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    alternatePhone = alt;
  }

  const uploaded = await photoFromForm(formData, "photo");
  if (!uploaded.ok) {
    return { error: uploaded.error };
  }

  const existing = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone: n, regionId } },
  });
  let photoUrl = existing?.photoUrl ?? "";
  if (uploaded.photoUrl) {
    photoUrl = uploaded.photoUrl;
  }

  await prisma.customerPhoneProfile.upsert({
    where: { phone_regionId: { phone: n, regionId } },
    create: {
      phone: n,
      regionId,
      locationUrl: locParsed.url,
      landmark,
      photoUrl,
      alternatePhone,
      notes,
    },
    update: {
      locationUrl: locParsed.url,
      landmark,
      notes,
      alternatePhone,
      ...(uploaded.photoUrl ? { photoUrl: uploaded.photoUrl } : {}),
    },
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/profiles");
  return { ok: true };
}

export async function updateCustomerPhoneProfile(
  _prev: CustomerProfileFormState,
  formData: FormData,
): Promise<CustomerProfileFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const existing = await prisma.customerPhoneProfile.findUnique({
    where: { id },
  });
  if (!existing) {
    return { error: "السجل غير موجود" };
  }

  const regionId = String(formData.get("regionId") ?? "").trim();
  if (!regionId) {
    return { error: "اختر المنطقة" };
  }
  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) {
    return { error: "المنطقة غير موجودة" };
  }
  const locParsed = parseLocationUrl(String(formData.get("locationUrl") ?? ""));
  if (!locParsed.ok) {
    return { error: locParsed.error };
  }
  const landmark = String(formData.get("landmark") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const altRaw = String(formData.get("alternatePhone") ?? "").trim();
  let alternatePhone: string | null = null;
  if (altRaw) {
    const alt = normalizeIraqMobileLocal11(altRaw);
    if (!alt) {
      return { error: "الرقم الثاني غير صالح أو اتركه فارغاً." };
    }
    if (alt === existing.phone) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    alternatePhone = alt;
  }
  const removePhoto = formData.get("removePhoto") === "on";

  const uploaded = await photoFromForm(formData, "photo");
  if (!uploaded.ok) {
    return { error: uploaded.error };
  }

  let photoUrl = existing.photoUrl;
  if (removePhoto) {
    photoUrl = "";
  } else if (uploaded.photoUrl) {
    photoUrl = uploaded.photoUrl;
  }

  await prisma.customerPhoneProfile.update({
    where: { id },
    data: {
      regionId,
      locationUrl: locParsed.url,
      landmark,
      notes,
      alternatePhone,
      photoUrl,
    },
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/profiles");
  revalidatePath(`/admin/customers/profiles/${id}/edit`);
  return { ok: true };
}

export async function deleteCustomerPhoneProfile(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/admin/customers/profiles");
  }
  await prisma.customerPhoneProfile.delete({ where: { id } });
  revalidatePath("/admin/customers");
  revalidatePath("/admin/customers/profiles");
  redirect("/admin/customers/profiles");
}
