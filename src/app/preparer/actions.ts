"use server";

import { CourierWalletMiscDirection, Prisma, PreparerShoppingDraftStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { upsertCustomerPhoneProfileFromOrderSnapshot } from "@/lib/customer-phone-profile-sync";
import { ALF_PER_DINAR, parseAlfInputToDinarNumber } from "@/lib/money-alf";
import {
  buildCustomerInvoiceText,
  buildPreparerPurchaseSummaryText,
  buildShoppingOrderProductNotesLines,
} from "@/lib/preparation-invoice";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import type { PreparerShoppingPayloadV1 } from "@/lib/preparer-shopping-payload";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveShopDoorPhotoUploaded,
} from "@/lib/order-image";
import { assignPendingOrderToCourierInternal, transferOrderToCourierInternal } from "@/lib/order-assign-courier";
import { preparerCanSubmitForShop, preparerHasShopAccess } from "@/lib/preparer-order-access";
import { prisma } from "@/lib/prisma";
import { notifyTelegramNewOrder, notifyTelegramPresenceChange } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder, pushNotifyAdminsPresenceChange } from "@/lib/web-push-server";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { MAX_VOICE_NOTE_BYTES, saveVoiceNoteUploaded } from "@/lib/voice-note";

export type PreparerActionState = { error?: string; ok?: boolean; orderNumber?: number; draftId?: string };

function formatCustomerSummaryNote(raw: string): string {
  return raw.trim();
}

function formatBorderedSummarySection(title: string, raw: string): string {
  const CUSTOMER_NOTE_BORDER = "═══════════════";
  const t = raw.trim();
  if (!t) return "";
  return [
    CUSTOMER_NOTE_BORDER,
    title,
    CUSTOMER_NOTE_BORDER,
    t,
    CUSTOMER_NOTE_BORDER,
  ].join("\n");
}

function readPortal(formData: FormData) {
  const p = String(formData.get("p") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();
  return verifyCompanyPreparerPortalQuery(p, exp, s);
}

export async function submitPreparerOrder(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    return await submitPreparerOrderInner(formData);
  } catch (e) {
    console.error("submitPreparerOrder", e);
    return {
      error:
        "تعذّر إتمام الطلب. إن أرفقت صوراً كبيرة جرّب التقاطها مجدداً أو أعد المحاولة بعد قليل.",
    };
  }
}

async function submitPreparerOrderInner(formData: FormData): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ. اطلب رابطاً جديداً من الإدارة." };
  }

  const shopId = String(formData.get("shopId") ?? "").trim();
  const ok = await preparerCanSubmitForShop(v.preparerId, shopId);
  if (!ok) {
    return { error: "لا يمكنك رفع طلب لهذا المحل — فعّل «صلاحية رفع الطلب» من الإدارة أو اختر محلاً مرتبطاً." };
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }

  const orderType = String(formData.get("orderType") ?? "").trim();
  const orderSubtotalRaw = String(formData.get("orderSubtotal") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const alternatePhoneRaw = String(formData.get("alternatePhone") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const customerNameRaw = String(formData.get("customerName") ?? "").trim();
  const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const prepaidAll = formData.get("prepaidAll") === "on";

  const imageFile = formData.get("orderImage");
  const shopDoorFile = formData.get("shopDoorPhoto");
  const voiceFile = formData.get("voiceNote");

  if (!orderType) {
    return { error: "نوع الطلب مطلوب" };
  }
  if (!orderTime.trim()) {
    return { error: "وقت الطلب إجباري" };
  }
  if (!customerRegionId) {
    return { error: "اختر منطقة الزبون من البحث" };
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return {
      error:
        "رقم الزبون غير صالح. يمكنك إدخاله بأي صيغة شائعة (مثل 07… أو +964… أو مع مسافات).",
    };
  }

  const normalizedSub = orderSubtotalRaw.replace(/,/g, ".").trim();
  let subtotal = new Decimal(0);
  if (normalizedSub) {
    const subtotalNum = parseAlfInputToDinarNumber(normalizedSub);
    if (subtotalNum == null) {
      return { error: "سعر الطلب غير صالح (أدخل المبلغ بالألف، مثال: 10 أو 10.5)" };
    }
    if (subtotalNum < 0) {
      return { error: "سعر الطلب لا يمكن أن يكون سالباً" };
    }
    subtotal = new Decimal(subtotalNum);
  }

  let imageUrl: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await saveOrderImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "IMAGE_TOO_LARGE") {
        return { error: "حجم صورة الطلب كبير جداً (الحد 10 ميجابايت)" };
      }
      if (code === "IMAGE_BAD_TYPE") {
        return { error: "نوع الصورة غير مدعوم (استخدم JPG أو PNG أو Webp)" };
      }
      return { error: "تعذّر حفظ صورة الطلب." };
    }
  }

  let shopDoorPhotoUrl: string | null = null;
  if (shopDoorFile instanceof File && shopDoorFile.size > 0) {
    try {
      shopDoorPhotoUrl = await saveShopDoorPhotoUploaded(shopDoorFile, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "IMAGE_TOO_LARGE") {
        return { error: "حجم صورة باب المحل كبير جداً" };
      }
      return { error: "تعذّر حفظ صورة باب المحل." };
    }
  }

  let voiceNoteUrl: string | null = null;
  if (voiceFile instanceof File && voiceFile.size > 0) {
    try {
      voiceNoteUrl = await saveVoiceNoteUploaded(voiceFile, MAX_VOICE_NOTE_BYTES);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "VOICE_TOO_LARGE") {
        return { error: "الملاحظة الصوتية كبيرة جداً (الحدّ حوالي 10 ثوانٍ)" };
      }
      if (code === "VOICE_BAD_TYPE") {
        return { error: "صيغة الصوت غير مدعومة. سجّل من المتصفح مرة أخرى." };
      }
      if (code === "VOICE_STORAGE_FAILED") {
        return { error: "تعذّر حفظ الملاحظة الصوتية على الخادم. أرسل الطلب دون صوت أو جرّب لاحقاً." };
      }
      return { error: "تعذّر حفظ الملاحظة الصوتية." };
    }
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { region: true },
  });
  if (!shop) {
    return { error: "المحل غير موجود" };
  }

  const custRegion = await prisma.region.findUnique({
    where: { id: customerRegionId },
  });
  if (!custRegion) {
    return { error: "منطقة الزبون غير صالحة" };
  }

  const shopDel = shop.region.deliveryPrice;
  const custDel = custRegion.deliveryPrice;
  const delivery = shopDel.greaterThan(custDel) ? shopDel : custDel;
  const total = subtotal.plus(delivery);

  const firstCustomer = await prisma.customer.findFirst({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
    select: { name: true, phone: true },
  });

  const existingCustomer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phone: phoneLocal },
  });

  const phoneRegionProfile = await prisma.customerPhoneProfile.findUnique({
    where: {
      phone_regionId: { phone: phoneLocal, regionId: customerRegionId },
    },
  });

  const lastOrderWithAddress = await prisma.order.findFirst({
    where: {
      shopId: shop.id,
      customerPhone: phoneLocal,
      customerRegionId: customerRegionId,
      customerLocationUrl: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    select: { customerLocationUrl: true, customerLandmark: true },
  });

  const locMerged =
    customerLocationUrl.trim() ||
    phoneRegionProfile?.locationUrl?.trim() ||
    lastOrderWithAddress?.customerLocationUrl?.trim() ||
    "";
  const lmMerged =
    customerLandmark.trim() ||
    phoneRegionProfile?.landmark?.trim() ||
    lastOrderWithAddress?.customerLandmark?.trim() ||
    "";

  let alternateMerged: string | null = null;
  if (alternatePhoneRaw.trim()) {
    const altLocal = normalizeIraqMobileLocal11(alternatePhoneRaw);
    if (!altLocal) {
      return {
        error:
          "الرقم الثاني غير صالح. أدخل رقماً عراقياً صحيحاً أو اترك الحقل فارغاً.",
      };
    }
    if (altLocal === phoneLocal) {
      return { error: "الرقم الثاني يجب أن يختلف عن رقم الزبون الأساسي." };
    }
    alternateMerged = altLocal;
  } else if (phoneRegionProfile?.alternatePhone?.trim()) {
    alternateMerged = phoneRegionProfile.alternatePhone.trim();
  }

  const customerRow = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name:
            customerNameRaw ||
            existingCustomer.name?.trim() ||
            "",
          customerRegionId: custRegion.id,
          customerLocationUrl: "",
          customerLandmark: "",
          alternatePhone: null,
          customerDoorPhotoUrl: null,
        },
      })
    : await prisma.customer.create({
        data: {
          shopId: shop.id,
          phone: phoneLocal,
          name: customerNameRaw,
          customerRegionId: custRegion.id,
          customerLocationUrl: "",
          customerLandmark: "",
          alternatePhone: null,
          customerDoorPhotoUrl: null,
        },
      });

  const customerDoorPrefill = phoneRegionProfile?.photoUrl?.trim() || null;

  const orderNoteTimeOnly = orderTime.trim();
  const summaryFromCustomerNotes = formatCustomerSummaryNote(notes);

  const headerBlock = [
    `مجهز الطلب: ${preparer.name} — ${preparer.phone?.trim() || "—"}`,
    `الحساب المرتبط للتنفيذ: ${shop.name}`,
    `أول زبون بالمحل: ${firstCustomer?.name?.trim() || "—"} — ${firstCustomer?.phone || "—"}`,
  ].join("\n");

  const summaryCombined = [headerBlock, summaryFromCustomerNotes ? `\n${summaryFromCustomerNotes}` : ""]
    .filter(Boolean)
    .join("\n");

  const orderImageUploaderName = imageUrl ? preparer.name.trim() || "مجهز" : null;

  const order = await prisma.order.create({
    data: {
      shopId: shop.id,
      customerId: customerRow.id,
      status: "pending",
      summary: summaryCombined,
      orderType,
      customerLocationUrl: locMerged,
      customerLandmark: lmMerged,
      customerRegionId: custRegion.id,
      deliveryPrice: delivery,
      orderSubtotal: subtotal,
      totalAmount: total,
      customerPhone: phoneLocal,
      alternatePhone: alternateMerged,
      orderNoteTime: orderNoteTimeOnly,
      imageUrl,
      orderImageUploadedByName: orderImageUploaderName,
      voiceNoteUrl,
      shopDoorPhotoUrl: shopDoorPhotoUrl ?? (shop.photoUrl?.trim() || null),
      shopDoorPhotoUploadedByName: shopDoorPhotoUrl ? preparer.name.trim() || "مجهز" : null,
      customerDoorPhotoUrl: customerDoorPrefill,
      submissionSource: "company_preparer",
      submittedByEmployeeId: null,
      submittedByCompanyPreparerId: preparer.id,
      prepaidAll: false,
    },
  });

  await upsertCustomerPhoneProfileFromOrderSnapshot({
    phone: phoneLocal,
    regionId: custRegion.id,
    locationUrl: locMerged,
    landmark: lmMerged,
    doorPhotoUrl: customerDoorPrefill ?? "",
    alternatePhone: alternateMerged,
  });

  void notifyTelegramNewOrder(order.id);
  void pushNotifyAdminsNewPendingOrder(order.orderNumber);

  revalidatePath("/admin/orders/pending");
  revalidatePath("/preparer");
  return { ok: true };
}

export async function assignOrderByPreparer(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ." };
  }
  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }
  const orderId = String(formData.get("orderId") ?? "").trim();
  const courierId = String(formData.get("courierId") ?? "").trim();
  if (!orderId || !courierId) {
    return { error: "بيانات ناقصة." };
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { error: "الطلب غير موجود." };
  }
  const allowed = preparer.shopLinks.some((l) => l.shopId === order.shopId);
  if (!allowed) {
    return { error: "لا صلاحية لهذا الطلب." };
  }
  const bypass = { bypassCourierAvailability: true as const };
  if (order.status !== "pending" && order.status !== "assigned") {
    return { error: "لا يمكن تعديل الإسناد بعد استلام الطلب من المندوب." };
  }
  const res =
    order.status === "pending"
      ? await assignPendingOrderToCourierInternal(orderId, courierId, bypass)
      : await transferOrderToCourierInternal(orderId, courierId, bypass);
  if ("error" in res && res.error) {
    return { error: res.error };
  }
  revalidatePath("/preparer");
  revalidatePath("/mandoub");
  revalidatePath(`/preparer/order/${orderId}`);
  return { ok: true };
}

export async function updatePreparerOrderFields(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ." };
  }
  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }
  const orderId = String(formData.get("orderId") ?? "").trim();
  const orderType = String(formData.get("orderType") ?? "").trim();
  const orderSubtotalRaw = String(formData.get("orderSubtotal") ?? "").trim();
  const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
  const imageFile = formData.get("orderImage");
  const shopDoorFile = formData.get("shopDoorPhoto");

  if (!orderId) {
    return { error: "معرّف الطلب مفقود." };
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shop: { include: { region: true } }, customerRegion: true },
  });
  if (!order) {
    return { error: "الطلب غير موجود." };
  }
  const allowed = preparer.shopLinks.some((l) => l.shopId === order.shopId);
  if (!allowed) {
    return { error: "لا صلاحية لهذا الطلب." };
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhoneRaw);
  if (!phoneLocal) {
    return { error: "رقم الزبون غير صالح." };
  }

  let subtotal = order.orderSubtotal ?? new Decimal(0);
  if (orderSubtotalRaw.trim()) {
    const n = parseAlfInputToDinarNumber(orderSubtotalRaw.replace(/,/g, ".").trim());
    if (n == null) {
      return { error: "سعر الطلب غير صالح (بالألف)." };
    }
    subtotal = new Decimal(n);
  }
  const delivery = order.deliveryPrice ?? new Decimal(0);
  const total = subtotal.plus(delivery);

  let imageUrl: string | undefined;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await saveOrderImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
    } catch {
      return { error: "تعذّر حفظ صورة الطلب." };
    }
  }
  let shopDoorUrl: string | undefined;
  if (shopDoorFile instanceof File && shopDoorFile.size > 0) {
    try {
      shopDoorUrl = await saveShopDoorPhotoUploaded(shopDoorFile, MAX_ORDER_IMAGE_BYTES);
    } catch {
      return { error: "تعذّر حفظ صورة باب المحل." };
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      orderType: orderType || order.orderType,
      customerPhone: phoneLocal,
      orderSubtotal: subtotal,
      totalAmount: total,
      ...(imageUrl ? { imageUrl, orderImageUploadedByName: preparer.name.trim() || "مجهز" } : {}),
      ...(shopDoorUrl
        ? {
            shopDoorPhotoUrl: shopDoorUrl,
            shopDoorPhotoUploadedByName: preparer.name.trim() || "مجهز",
          }
        : {}),
    },
  });

  revalidatePath("/preparer");
  revalidatePath(`/preparer/order/${orderId}`);
  return { ok: true };
}

export async function setPreparerPresenceFromForm(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ." };
  }
  const availableRaw = String(formData.get("available") ?? "").trim();
  const available = availableRaw === "true" || availableRaw === "on";
  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }
  if (preparer.availableForAssignment === available) {
    revalidatePath("/preparer");
    return { ok: true };
  }
  await prisma.companyPreparer.update({
    where: { id: preparer.id },
    data: { availableForAssignment: available },
  });
  void notifyTelegramPresenceChange({
    kind: "preparer",
    name: preparer.name,
    available,
  });
  void pushNotifyAdminsPresenceChange({
    kind: "preparer",
    name: preparer.name,
    available,
  });
  revalidatePath("/preparer");
  return { ok: true };
}

export async function bulkAssignOrdersByPreparerForm(formData: FormData): Promise<void> {
  await bulkAssignOrdersByPreparer({}, formData);
}

export async function bulkAssignOrdersByPreparer(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ." };
  }
  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }
  const courierId = String(formData.get("courierId") ?? "").trim();
  const orderIdsRaw = String(formData.get("orderIds") ?? "").trim();
  if (!courierId || !orderIdsRaw) {
    return { error: "اختر المندوب والطلبات." };
  }
  const orderIds = orderIdsRaw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (orderIds.length === 0) {
    return { error: "لم يُحدَّد أي طلب." };
  }

  let okCount = 0;
  let lastError: string | undefined;

  for (const orderId of orderIds) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      lastError = "طلب غير موجود.";
      continue;
    }
    if (order.status !== "pending" && order.status !== "assigned") {
      lastError = "يمكن تعديل الإسناد الجماعي لطلبات «جديد» أو «مُسند» فقط قبل استلام المندوب.";
      continue;
    }
    const allowed = preparer.shopLinks.some((l) => l.shopId === order.shopId);
    if (!allowed) {
      lastError = "لا صلاحية لأحد الطلبات.";
      continue;
    }
    const res =
      order.status === "pending"
        ? await assignPendingOrderToCourierInternal(orderId, courierId, {
            bypassCourierAvailability: true,
          })
        : await transferOrderToCourierInternal(orderId, courierId, {
            bypassCourierAvailability: true,
          });
    if ("error" in res && res.error) {
      lastError = res.error;
      continue;
    }
    okCount += 1;
    revalidatePath(`/preparer/order/${orderId}`);
  }

  if (okCount === 0) {
    return { error: lastError ?? "لم يُسنَد أي طلب." };
  }
  revalidatePath("/preparer");
  revalidatePath("/mandoub");
  revalidatePath("/admin/orders/pending");
  return { ok: true };
}

const BRAND_PREP_INVOICE = "أبو الأكبر للتوصيل";

/** صفوف منتجات مسودة التجهيز مع تسعير كامل — يُستخدم عند الإرسال من النموذج أو من JSON المخزّن. */
function buildPricedProductsFromDraftRows(
  products: unknown,
):
  | { ok: true; products: PreparerShoppingPayloadV1["products"] }
  | { ok: false; error: string } {
  if (!Array.isArray(products) || products.length === 0) {
    return { ok: false, error: "لا توجد منتجات في المسودة." };
  }
  const out: PreparerShoppingPayloadV1["products"] = [];
  for (const p of products) {
    if (!p || typeof p !== "object") {
      return { ok: false, error: "بيانات المنتجات غير صالحة." };
    }
    const row = p as Record<string, unknown>;
    const line = String(row.line ?? "").trim();
    const buyRaw = row.buyAlf;
    const sellRaw = row.sellAlf;
    if (!line) {
      return { ok: false, error: "بيانات المنتجات غير صالحة." };
    }
    if (
      buyRaw == null ||
      sellRaw == null ||
      (typeof buyRaw === "string" && buyRaw.trim() === "") ||
      (typeof sellRaw === "string" && sellRaw.trim() === "")
    ) {
      return { ok: false, error: "أكمل تسعير كل المنتجات ثم احفظ أو أعد الإرسال." };
    }
    const buyAlf = Number(buyRaw);
    const sellAlf = Number(sellRaw);
    if (!Number.isFinite(buyAlf) || !Number.isFinite(sellAlf)) {
      return { ok: false, error: "أكمل تسعير كل المنتجات ثم احفظ أو أعد الإرسال." };
    }
    const buyAlfVal = Number(buyAlf);
    const sellAlfVal = Number(sellAlf);
    if (buyAlfVal < 0 || sellAlfVal < 0) {
      return { ok: false, error: "أسعار غير صالحة." };
    }
    out.push({ line, buyAlf: buyAlfVal, sellAlf: sellAlfVal });
  }
  return { ok: true, products: out };
}

function parseShoppingPayload(raw: string): PreparerShoppingPayloadV1 | null {
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    if (o.version !== 1) return null;
    const titleLine = String(o.titleLine ?? "").trim();
    const placesCount = Number(o.placesCount);
    const products = o.products;
    if (!titleLine || !Number.isFinite(placesCount) || placesCount < 1 || placesCount > 10) return null;
    if (!Array.isArray(products) || products.length === 0) return null;
    const out: PreparerShoppingPayloadV1["products"] = [];
    for (const p of products) {
      if (!p || typeof p !== "object") return null;
      const row = p as Record<string, unknown>;
      const line = String(row.line ?? "").trim();
      const buyRaw = row.buyAlf;
      const sellRaw = row.sellAlf;
      // Reject empty/nullish values before numeric coercion to avoid accidental 0.
      if (
        buyRaw == null ||
        sellRaw == null ||
        (typeof buyRaw === "string" && buyRaw.trim() === "") ||
        (typeof sellRaw === "string" && sellRaw.trim() === "")
      ) {
        return null;
      }
      const buyAlf = Number(buyRaw);
      const sellAlf = Number(sellRaw);
      if (!line || !Number.isFinite(buyAlf) || !Number.isFinite(sellAlf)) return null;
      if (buyAlf < 0 || sellAlf < 0) return null;
      out.push({ line, buyAlf, sellAlf });
    }
    return {
      version: 1,
      titleLine,
      products: out,
      placesCount: Math.floor(placesCount),
      rawListText: typeof o.rawListText === "string" ? o.rawListText : undefined,
    };
  } catch {
    return null;
  }
}

export async function submitPreparerShoppingOrder(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    return await submitPreparerShoppingOrderInner(formData);
  } catch (e) {
    console.error("submitPreparerShoppingOrder", e);
    return {
      error: "تعذّر إتمام طلب التجهيز. أعد المحاولة أو تواصل مع الإدارة.",
    };
  }
}

async function submitPreparerShoppingOrderInner(formData: FormData): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ. اطلب رابطاً جديداً من الإدارة." };
  }

  const shopId = String(formData.get("shopId") ?? "").trim();
  const okShop = await preparerCanSubmitForShop(v.preparerId, shopId);
  if (!okShop) {
    return {
      error:
        "لا يمكنك رفع طلب لهذا المحل — فعّل «صلاحية رفع الطلب» من الإدارة أو اختر محلاً مرتبطاً.",
    };
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    select: {
      id: true,
      name: true,
      phone: true,
      walletEmployeeId: true,
    },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }

  const payload = parseShoppingPayload(String(formData.get("shoppingPayload") ?? ""));
  if (!payload) {
    return { error: "بيانات التجهيز غير صالحة. أعد تحميل الصفحة وحاول مجدداً." };
  }

  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();
  const customerNameRaw = String(formData.get("customerName") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();

  if (!orderTime.trim()) {
    return { error: "وقت الطلب إجباري" };
  }
  if (!customerRegionId) {
    return { error: "اختر منطقة الزبون من البحث" };
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return {
      error:
        "رقم الزبون غير صالح. يمكنك إدخاله بأي صيغة شائعة (مثل 07… أو +964… أو مع مسافات).",
    };
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { region: true },
  });
  if (!shop) {
    return { error: "المحل غير موجود" };
  }

  const custRegion = await prisma.region.findUnique({
    where: { id: customerRegionId },
  });
  if (!custRegion) {
    return { error: "منطقة الزبون غير صالحة" };
  }

  const shopDel = shop.region.deliveryPrice;
  const custDel = custRegion.deliveryPrice;
  const delivery = shopDel.greaterThan(custDel) ? shopDel : custDel;
  const deliveryAlf = Number(delivery.toString()) / ALF_PER_DINAR;

  let sumSellAlf = 0;
  let sumBuyAlf = 0;
  for (const p of payload.products) {
    sumSellAlf += p.sellAlf;
    sumBuyAlf += p.buyAlf;
  }
  const extraAlf = calculateExtraAlfFromPlacesCount(payload.placesCount);

  const sumSellDinar = new Decimal(sumSellAlf).mul(ALF_PER_DINAR);
  const extraDinar = new Decimal(extraAlf).mul(ALF_PER_DINAR);
  const subtotal = sumSellDinar.plus(extraDinar);
  const total = subtotal.plus(delivery);

  const firstCustomer = await prisma.customer.findFirst({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
    select: { name: true, phone: true },
  });

  const existingCustomer = await prisma.customer.findFirst({
    where: { shopId: shop.id, phone: phoneLocal },
  });

  const phoneRegionProfile = await prisma.customerPhoneProfile.findUnique({
    where: {
      phone_regionId: { phone: phoneLocal, regionId: customerRegionId },
    },
  });

  const lastOrderWithAddress = await prisma.order.findFirst({
    where: {
      shopId: shop.id,
      customerPhone: phoneLocal,
      customerRegionId: customerRegionId,
      customerLocationUrl: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    select: { customerLocationUrl: true, customerLandmark: true },
  });

  const locMerged =
    phoneRegionProfile?.locationUrl?.trim() ||
    lastOrderWithAddress?.customerLocationUrl?.trim() ||
    "";
  const lmMerged =
    customerLandmark.trim() ||
    phoneRegionProfile?.landmark?.trim() ||
    lastOrderWithAddress?.customerLandmark?.trim() ||
    "";

  const customerRow = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name: customerNameRaw || existingCustomer.name?.trim() || "",
          customerRegionId: custRegion.id,
          customerLocationUrl: "",
          customerLandmark: "",
          customerDoorPhotoUrl: null,
        },
      })
    : await prisma.customer.create({
        data: {
          shopId: shop.id,
          phone: phoneLocal,
          name: customerNameRaw,
          customerRegionId: custRegion.id,
          customerLocationUrl: "",
          customerLandmark: "",
          alternatePhone: null,
          customerDoorPhotoUrl: null,
        },
      });

  const customerDoorPrefill = phoneRegionProfile?.photoUrl?.trim() || null;

  const orderType = "تجهيز تسوق";

  const order = await prisma.order.create({
    data: {
      shopId: shop.id,
      customerId: customerRow.id,
      status: "pending",
      summary: "",
      orderType,
      customerLocationUrl: locMerged,
      customerLandmark: lmMerged,
      customerRegionId: custRegion.id,
      deliveryPrice: delivery,
      orderSubtotal: subtotal,
      totalAmount: total,
      customerPhone: phoneLocal,
      alternatePhone: null,
      orderNoteTime: orderTime.trim(),
      imageUrl: null,
      orderImageUploadedByName: null,
      voiceNoteUrl: null,
      shopDoorPhotoUrl: shop.photoUrl?.trim() || null,
      shopDoorPhotoUploadedByName: null,
      customerDoorPhotoUrl: customerDoorPrefill,
      submissionSource: "company_preparer",
      submittedByEmployeeId: null,
      submittedByCompanyPreparerId: preparer.id,
      prepaidAll: false,
    },
  });

  const invoiceLines = payload.products.map((p) => ({
    line: p.line,
    buyAlf: p.buyAlf,
    sellAlf: p.sellAlf,
  }));

  const customerInvoice = buildCustomerInvoiceText({
    brandLabel: BRAND_PREP_INVOICE,
    orderNumberLabel: `#${order.orderNumber}`,
    regionTitle: payload.titleLine,
    phone: phoneLocal,
    lines: invoiceLines,
    placesCount: payload.placesCount,
    deliveryAlf,
  });

  const purchaseBlock = buildPreparerPurchaseSummaryText(invoiceLines);

  /** في `summary` لا نضع الفاتورة الكاملة ولا تفاصيل الشراء أو بيانات المحل — فقط المنتجات مع السعر بجانبها. */
  const productNotesOnly = buildShoppingOrderProductNotesLines(invoiceLines);
  const summaryCombined = formatBorderedSummarySection("المنتجات", productNotesOnly);

  const jsonStore: Prisma.InputJsonValue = {
    version: 1,
    orderNumber: order.orderNumber,
    titleLine: payload.titleLine,
    phone: phoneLocal,
    products: invoiceLines,
    placesCount: payload.placesCount,
    extraAlf,
    sumSellAlf,
    sumBuyAlf,
    deliveryAlf,
    customerInvoiceText: customerInvoice,
    purchaseSummaryText: purchaseBlock,
    rawListText: payload.rawListText ?? null,
    preparerId: preparer.id,
    preparerName: preparer.name,
    shopId: shop.id,
    shopName: shop.name,
    regionId: custRegion.id,
    regionName: custRegion.name,
  };

  await prisma.order.update({
    where: { id: order.id },
    data: {
      summary: summaryCombined,
      preparerShoppingJson: jsonStore,
    },
  });

  let totalBuyDinar = new Decimal(0);
  for (const p of payload.products) {
    totalBuyDinar = totalBuyDinar.plus(new Decimal(p.buyAlf).mul(ALF_PER_DINAR));
  }
  if (totalBuyDinar.gt(0) && preparer.walletEmployeeId) {
    await prisma.employeeWalletMiscEntry.create({
      data: {
        employeeId: preparer.walletEmployeeId,
        direction: CourierWalletMiscDirection.give,
        amountDinar: totalBuyDinar,
        label: `صادر المبلغ تجهيز تسوق #${order.orderNumber}`,
      },
    });
    revalidatePath("/preparer/wallet");
  }

  await upsertCustomerPhoneProfileFromOrderSnapshot({
    phone: phoneLocal,
    regionId: custRegion.id,
    locationUrl: locMerged,
    landmark: lmMerged,
    doorPhotoUrl: customerDoorPrefill ?? "",
    alternatePhone: null,
  });

  void notifyTelegramNewOrder(order.id);
  void pushNotifyAdminsNewPendingOrder(order.orderNumber);

  revalidatePath("/admin/orders/pending");
  revalidatePath("/preparer");
  return { ok: true, orderNumber: order.orderNumber };
}

export async function updatePreparerShoppingOrder(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    return await updatePreparerShoppingOrderInner(formData);
  } catch (e) {
    console.error("updatePreparerShoppingOrder", e);
    return { error: "تعذّر تحديث تسعير الطلبية. أعد المحاولة أو تواصل مع الإدارة." };
  }
}

async function updatePreparerShoppingOrderInner(formData: FormData): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ. اطلب رابطاً جديداً من الإدارة." };
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) {
    return { error: "معرّف الطلب ناقص." };
  }

  const existing = await prisma.order.findFirst({
    where: {
      id: orderId,
      submittedByCompanyPreparerId: v.preparerId,
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      shopId: true,
      customerId: true,
      preparerShoppingJson: true,
      customerLocationUrl: true,
      customerLandmark: true,
      customerDoorPhotoUrl: true,
    },
  });
  if (!existing) {
    return { error: "الطلب غير موجود أو لا يخص حسابك." };
  }
  if (existing.status === "delivered" || existing.status === "cancelled") {
    return { error: "لا يمكن تعديل تسعير طلب تم تسليمه أو أُلغي." };
  }

  const shopId = String(formData.get("shopId") ?? "").trim();
  const okShop = await preparerCanSubmitForShop(v.preparerId, shopId);
  if (!okShop) {
    return {
      error:
        "لا يمكنك استخدام هذا المحل — فعّل «صلاحية رفع الطلب» من الإدارة أو اختر محلاً مرتبطاً.",
    };
  }
  if (existing.shopId !== shopId) {
    return { error: "لا يمكن تغيير محل الطلب من التعديل." };
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    select: {
      id: true,
      name: true,
      phone: true,
      walletEmployeeId: true,
    },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }

  const payload = parseShoppingPayload(String(formData.get("shoppingPayload") ?? ""));
  if (!payload) {
    return { error: "بيانات التجهيز غير صالحة. أعد تحميل الصفحة وحاول مجدداً." };
  }

  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();
  const customerNameRaw = String(formData.get("customerName") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();

  if (!orderTime.trim()) {
    return { error: "وقت الطلب إجباري" };
  }
  if (!customerRegionId) {
    return { error: "منطقة الزبون غير صالحة" };
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return {
      error:
        "رقم الزبون غير صالح. يمكنك إدخاله بأي صيغة شائعة (مثل 07… أو +964… أو مع مسافات).",
    };
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { region: true },
  });
  if (!shop) {
    return { error: "المحل غير موجود" };
  }

  const custRegion = await prisma.region.findUnique({
    where: { id: customerRegionId },
  });
  if (!custRegion) {
    return { error: "منطقة الزبون غير صالحة" };
  }

  const shopDel = shop.region.deliveryPrice;
  const custDel = custRegion.deliveryPrice;
  const delivery = shopDel.greaterThan(custDel) ? shopDel : custDel;
  const deliveryAlf = Number(delivery.toString()) / ALF_PER_DINAR;

  let sumSellAlf = 0;
  let sumBuyAlf = 0;
  for (const p of payload.products) {
    sumSellAlf += p.sellAlf;
    sumBuyAlf += p.buyAlf;
  }
  const extraAlf = calculateExtraAlfFromPlacesCount(payload.placesCount);

  const sumSellDinar = new Decimal(sumSellAlf).mul(ALF_PER_DINAR);
  const extraDinar = new Decimal(extraAlf).mul(ALF_PER_DINAR);
  const subtotal = sumSellDinar.plus(extraDinar);
  const total = subtotal.plus(delivery);

  const phoneRegionProfile = await prisma.customerPhoneProfile.findUnique({
    where: {
      phone_regionId: { phone: phoneLocal, regionId: customerRegionId },
    },
  });

  const lastOrderWithAddress = await prisma.order.findFirst({
    where: {
      shopId: shop.id,
      customerPhone: phoneLocal,
      customerRegionId: customerRegionId,
      customerLocationUrl: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    select: { customerLocationUrl: true, customerLandmark: true },
  });

  const existingCustomer = existing.customerId
    ? await prisma.customer.findUnique({ where: { id: existing.customerId } })
    : null;

  const locMerged =
    phoneRegionProfile?.locationUrl?.trim() ||
    lastOrderWithAddress?.customerLocationUrl?.trim() ||
    existing.customerLocationUrl?.trim() ||
    "";
  const lmMerged =
    customerLandmark.trim() ||
    phoneRegionProfile?.landmark?.trim() ||
    lastOrderWithAddress?.customerLandmark?.trim() ||
    existing.customerLandmark?.trim() ||
    "";

  const customerRow =
    existingCustomer != null
      ? await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: customerNameRaw || existingCustomer.name?.trim() || "",
            customerRegionId: custRegion.id,
            customerLocationUrl: "",
            customerLandmark: "",
            customerDoorPhotoUrl: null,
          },
        })
      : await prisma.customer.create({
          data: {
            shopId: shop.id,
            phone: phoneLocal,
            name: customerNameRaw,
            customerRegionId: custRegion.id,
            customerLocationUrl: "",
            customerLandmark: "",
            alternatePhone: null,
            customerDoorPhotoUrl: null,
          },
        });

  const customerDoorPrefill =
    phoneRegionProfile?.photoUrl?.trim() ||
    existing.customerDoorPhotoUrl?.trim() ||
    null;

  const invoiceLines = payload.products.map((p) => ({
    line: p.line,
    buyAlf: p.buyAlf,
    sellAlf: p.sellAlf,
  }));

  const customerInvoice = buildCustomerInvoiceText({
    brandLabel: BRAND_PREP_INVOICE,
    orderNumberLabel: `#${existing.orderNumber}`,
    regionTitle: payload.titleLine,
    phone: phoneLocal,
    lines: invoiceLines,
    placesCount: payload.placesCount,
    deliveryAlf,
  });

  const purchaseBlock = buildPreparerPurchaseSummaryText(invoiceLines);
  const productNotesOnly = buildShoppingOrderProductNotesLines(invoiceLines);
  const summaryCombined = formatBorderedSummarySection("المنتجات", productNotesOnly);

  const jsonStore: Prisma.InputJsonValue = {
    version: 1,
    orderNumber: existing.orderNumber,
    titleLine: payload.titleLine,
    phone: phoneLocal,
    products: invoiceLines,
    placesCount: payload.placesCount,
    extraAlf,
    sumSellAlf,
    sumBuyAlf,
    deliveryAlf,
    customerInvoiceText: customerInvoice,
    purchaseSummaryText: purchaseBlock,
    rawListText: payload.rawListText ?? null,
    preparerId: preparer.id,
    preparerName: preparer.name,
    shopId: shop.id,
    shopName: shop.name,
    regionId: custRegion.id,
    regionName: custRegion.name,
  };

  const oldJson = existing.preparerShoppingJson as { sumBuyAlf?: number } | null;
  const oldSumBuyAlf = typeof oldJson?.sumBuyAlf === "number" ? oldJson.sumBuyAlf : 0;

  await prisma.order.update({
    where: { id: existing.id },
    data: {
      summary: summaryCombined,
      preparerShoppingJson: jsonStore,
      orderSubtotal: subtotal,
      totalAmount: total,
      deliveryPrice: delivery,
      customerPhone: phoneLocal,
      customerRegionId: custRegion.id,
      customerLandmark: lmMerged,
      customerLocationUrl: locMerged,
      customerId: customerRow.id,
      orderNoteTime: orderTime.trim(),
      customerDoorPhotoUrl: customerDoorPrefill,
    },
  });

  const oldBuyDinar = new Decimal(oldSumBuyAlf).mul(ALF_PER_DINAR);
  const newBuyDinar = new Decimal(sumBuyAlf).mul(ALF_PER_DINAR);
  const deltaBuy = newBuyDinar.minus(oldBuyDinar);
  if (preparer.walletEmployeeId && !deltaBuy.eq(0)) {
    if (deltaBuy.gt(0)) {
      await prisma.employeeWalletMiscEntry.create({
        data: {
          employeeId: preparer.walletEmployeeId,
          direction: CourierWalletMiscDirection.give,
          amountDinar: deltaBuy,
          label: `فرق تعديل شراء طلبية تجهيز #${existing.orderNumber}`,
        },
      });
    } else {
      await prisma.employeeWalletMiscEntry.create({
        data: {
          employeeId: preparer.walletEmployeeId,
          direction: CourierWalletMiscDirection.take,
          amountDinar: deltaBuy.abs(),
          label: `فرق تعديل شراء طلبية تجهيز #${existing.orderNumber}`,
        },
      });
    }
    revalidatePath("/preparer/wallet");
  }

  await upsertCustomerPhoneProfileFromOrderSnapshot({
    phone: phoneLocal,
    regionId: custRegion.id,
    locationUrl: locMerged,
    landmark: lmMerged,
    doorPhotoUrl: customerDoorPrefill ?? "",
    alternatePhone: null,
  });

  revalidatePath("/preparer");
  revalidatePath(`/preparer/order/${existing.id}`);
  revalidatePath("/admin/orders/pending");
  return { ok: true, orderNumber: existing.orderNumber };
}

export type DismissPrepNoticeState = { error?: string };

export async function dismissCompanyPreparerPrepNotice(
  _prev: DismissPrepNoticeState,
  formData: FormData,
): Promise<DismissPrepNoticeState> {
  const v = readPortal(formData);
  if (!v.ok) return { error: "الرابط غير صالح." };
  const noticeId = String(formData.get("noticeId") ?? "").trim();
  if (!noticeId) return { error: "معرّف الإشعار ناقص." };
  try {
    await prisma.companyPreparerPrepNotice.updateMany({
      where: {
        id: noticeId,
        preparerId: v.preparerId,
        dismissedAt: null,
      },
      data: { dismissedAt: new Date() },
    });
  } catch (e) {
    console.error("dismissCompanyPreparerPrepNotice", e);
    return { error: "تعذّر تسجيل القراءة. حاول مجدداً." };
  }
  revalidatePath("/preparer");
  return {};
}

export async function createPreparerShoppingDraftFromAnalysis(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "الرابط غير صالح أو منتهٍ. اطلب رابطاً جديداً من الإدارة." };
  }

  const titleLine = String(formData.get("titleLine") ?? "").trim();
  const rawListText = String(formData.get("rawListText") ?? "").trim();
  const productsCsv = String(formData.get("productsCsv") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();

  if (!titleLine || !productsCsv || !customerRegionId || !orderTime) {
    return { error: "بيانات ناقصة — تأكد من العنوان والمنطقة والمنتجات." };
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return {
      error:
        "رقم الزبون غير صالح. يمكنك إدخاله بأي صيغة شائعة (مثل 07… أو +964… أو مع مسافات).",
    };
  }

  const region = await prisma.region.findUnique({ where: { id: customerRegionId } });
  if (!region) {
    return { error: "منطقة الزبون غير صالحة." };
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    select: { id: true },
  });
  if (!preparer) {
    return { error: "الحساب غير متاح." };
  }

  const lines = productsCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { error: "لا توجد منتجات في القائمة." };
  }

  const products = lines.map((line) => ({ line, buyAlf: null as number | null, sellAlf: null as number | null }));

  const data: Prisma.InputJsonValue = {
    version: 1,
    products,
    ...(rawListText ? { rawListText } : {}),
  };

  const draft = await prisma.companyPreparerShoppingDraft.create({
    data: {
      preparerId: preparer.id,
      status: PreparerShoppingDraftStatus.draft,
      titleLine,
      rawListText,
      customerRegionId,
      customerPhone: phoneLocal,
      customerName,
      customerLandmark,
      orderTime,
      placesCount: null,
      data,
    },
  });

  revalidatePath("/preparer/preparation");
  return { ok: true, draftId: draft.id };
}

export async function updatePreparerShoppingDraft(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) {
      return { error: "الرابط غير صالح أو منتهٍ." };
    }

    const draftId = String(formData.get("draftId") ?? "").trim();
    if (!draftId) {
      return { error: "معرّف المسودة ناقص." };
    }

    const draft = await prisma.companyPreparerShoppingDraft.findFirst({
      where: { id: draftId, preparerId: v.preparerId },
    });
    if (!draft) {
      return { error: "المسودة غير موجودة." };
    }
    if (draft.status === PreparerShoppingDraftStatus.sent) {
      return { error: "تم إرسال هذه المسودة — لا يمكن تعديلها من هنا." };
    }

    const titleLine = String(formData.get("titleLine") ?? "").trim();
    const customerPhone = String(formData.get("customerPhone") ?? "").trim();
    const customerName = String(formData.get("customerName") ?? "").trim();
    const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
    const orderTime = String(formData.get("orderTime") ?? "").trim();
    const placesRaw = String(formData.get("placesCount") ?? "").trim();
    const placesCount = placesRaw === "" ? null : Number(placesRaw);

    const base = draft.data && typeof draft.data === "object" ? (draft.data as Record<string, unknown>) : {};
    const existingProducts = Array.isArray(base.products) ? base.products : [];
    const productsJsonRaw = String(formData.get("productsJson") ?? "").trim();
    let merged: { line: string; buyAlf: number | null; sellAlf: number | null }[] = [];
    if (productsJsonRaw) {
      try {
        const parsed = JSON.parse(productsJsonRaw) as Array<{ line?: unknown; buyAlf?: unknown; sellAlf?: unknown }>;
        if (!Array.isArray(parsed)) {
          return { error: "بيانات المنتجات غير صالحة." };
        }
        merged = parsed
          .map((row) => {
            const line = String(row?.line ?? "").trim();
            if (!line) return null;
            const buyAlf = row?.buyAlf == null ? null : Number(row.buyAlf);
            const sellAlf = row?.sellAlf == null ? null : Number(row.sellAlf);
            if (buyAlf != null && !Number.isFinite(buyAlf)) return null;
            if (sellAlf != null && !Number.isFinite(sellAlf)) return null;
            return { line, buyAlf, sellAlf };
          })
          .filter((x): x is { line: string; buyAlf: number | null; sellAlf: number | null } => x != null);
      } catch {
        return { error: "بيانات المنتجات غير صالحة." };
      }
    } else {
      let priceArr: { buyAlf: number | null; sellAlf: number | null }[];
      try {
        priceArr = JSON.parse(String(formData.get("pricesJson") ?? "[]")) as {
          buyAlf: number | null;
          sellAlf: number | null;
        }[];
      } catch {
        return { error: "بيانات التسعير غير صالحة." };
      }
      if (!Array.isArray(priceArr) || priceArr.length !== existingProducts.length) {
        return { error: "عدد أسعار الشراء/البيع لا يطابق عدد المنتجات. أعد تحميل الصفحة." };
      }
      merged = existingProducts.map((p, i) => {
        const row = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
        const line = String(row.line ?? "").trim();
        const pr = priceArr[i]!;
        return {
          line,
          buyAlf: pr.buyAlf,
          sellAlf: pr.sellAlf,
        };
      });
    }
    if (merged.length === 0) {
      return { error: "لا يمكن حفظ مسودة بدون منتجات." };
    }
    const hasNegative = merged.some(
      (x) => (typeof x.buyAlf === "number" && x.buyAlf < 0) || (typeof x.sellAlf === "number" && x.sellAlf < 0),
    );
    if (hasNegative) {
      return { error: "أسعار الشراء/البيع يجب أن تكون 0 أو أكثر." };
    }

    const allPriced =
      merged.length > 0 &&
      merged.every(
        (x) =>
          typeof x.buyAlf === "number" &&
          Number.isFinite(x.buyAlf) &&
          typeof x.sellAlf === "number" &&
          Number.isFinite(x.sellAlf),
      );

    const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
    if (!phoneLocal) {
      return { error: "رقم الزبون غير صالح." };
    }

    if (placesCount != null && (!Number.isFinite(placesCount) || placesCount < 1 || placesCount > 10)) {
      return { error: "عدد المحلات يجب أن يكون بين 1 و 10." };
    }

    const nextData: Prisma.InputJsonValue = {
      ...base,
      version: 1,
      products: merged,
    };

    await prisma.companyPreparerShoppingDraft.update({
      where: { id: draftId },
      data: {
        titleLine,
        customerPhone: phoneLocal,
        customerName,
        customerLandmark,
        orderTime,
        placesCount: placesCount ?? null,
        data: nextData,
        status: allPriced ? PreparerShoppingDraftStatus.priced : PreparerShoppingDraftStatus.draft,
      },
    });

    revalidatePath("/preparer/preparation");
    revalidatePath(`/preparer/preparation/draft/${draftId}`);
    return { ok: true };
  } catch (e) {
    console.error("updatePreparerShoppingDraft", e);
    return { error: "تعذّر حفظ المسودة. حاول مجدداً." };
  }
}

export async function submitPreparerShoppingDraft(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) {
      return { error: "الرابط غير صالح أو منتهٍ." };
    }

    const draftId = String(formData.get("draftId") ?? "").trim();
    if (!draftId) {
      return { error: "معرّف المسودة ناقص." };
    }

    const draft = await prisma.companyPreparerShoppingDraft.findFirst({
      where: { id: draftId, preparerId: v.preparerId },
    });
    if (!draft) {
      return { error: "المسودة غير موجودة." };
    }
    if (draft.status === PreparerShoppingDraftStatus.sent) {
      return { error: "تم إرسال هذه المسودة مسبقاً." };
    }
    if (!draft.customerRegionId) {
      return { error: "منطقة الزبون غير محددة في المسودة." };
    }

    const link = await prisma.preparerShop.findFirst({
      where: { preparerId: v.preparerId, canSubmitOrders: true },
      orderBy: { assignedAt: "asc" },
    });
    if (!link) {
      return { error: "لا يوجد محل مفعّل لك «صلاحية رفع الطلب». اطلب من الإدارة التفعيل." };
    }

    const shopId = link.shopId;
    const okShop = await preparerCanSubmitForShop(v.preparerId, shopId);
    if (!okShop) {
      return {
        error:
          "لا يمكنك رفع طلب لهذا المحل — فعّل «صلاحية رفع الطلب» من الإدارة أو اختر محلاً مرتبطاً.",
      };
    }

    const placesCountRaw = String(formData.get("placesCount") ?? "").trim();
    const uiPlaces = placesCountRaw ? Number(placesCountRaw) : null;
    const placesCount = uiPlaces ?? draft.placesCount;
    if (placesCount == null || !Number.isFinite(placesCount) || placesCount < 1 || placesCount > 10) {
      return { error: "حدد عدد المحلات (1–10) واحفظ المسودة قبل الإرسال." };
    }
    if (uiPlaces != null && uiPlaces !== draft.placesCount) {
      await prisma.companyPreparerShoppingDraft.update({
        where: { id: draftId },
        data: {
          placesCount: uiPlaces,
        },
      });
    }

    const data = draft.data;
    const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

    /** أولوية لما على الشاشة: الإرسال كان يقرأ فقط من DB فيفقد منتجات أضيفت دون «حفظ التسعير». */
    const productsJsonRaw = String(formData.get("productsJson") ?? "").trim();
    let productRows: unknown;
    if (productsJsonRaw) {
      try {
        const parsed = JSON.parse(productsJsonRaw) as unknown;
        productRows = parsed;
      } catch {
        return { error: "بيانات المنتجات في النموذج غير صالحة. أعد تحميل الصفحة." };
      }
    } else {
      productRows = o.products;
    }

    const priced = buildPricedProductsFromDraftRows(productRows);
    if (!priced.ok) {
      return { error: priced.error };
    }
    const out = priced.products;

    const titleLine =
      String(formData.get("titleLine") ?? "").trim() || draft.titleLine.trim();
    const customerPhone =
      String(formData.get("customerPhone") ?? "").trim() || draft.customerPhone;
    const orderTime = String(formData.get("orderTime") ?? "").trim() || draft.orderTime;
    const customerName = String(formData.get("customerName") ?? "").trim() || draft.customerName;
    const customerLandmark =
      String(formData.get("customerLandmark") ?? "").trim() || draft.customerLandmark;

    const payload: PreparerShoppingPayloadV1 = {
      version: 1,
      titleLine,
      products: out,
      placesCount: Math.floor(placesCount),
      rawListText:
        typeof o.rawListText === "string"
          ? o.rawListText
          : draft.rawListText.trim()
            ? draft.rawListText
            : undefined,
    };

    const fd = new FormData();
    fd.set("p", String(formData.get("p") ?? ""));
    fd.set("exp", String(formData.get("exp") ?? ""));
    fd.set("s", String(formData.get("s") ?? ""));
    fd.set("shopId", shopId);
    fd.set("shoppingPayload", JSON.stringify(payload));
    fd.set("customerRegionId", draft.customerRegionId);
    fd.set("customerPhone", customerPhone);
    fd.set("orderTime", orderTime);
    fd.set("customerName", customerName);
    fd.set("customerLandmark", customerLandmark);

    const res = await submitPreparerShoppingOrderInner(fd);
    if (res.error || !res.ok || !res.orderNumber) {
      return res;
    }

    const order = await prisma.order.findUnique({ where: { orderNumber: res.orderNumber } });
    if (!order) {
      return { error: "تعذّر ربط الطلب بالمسودة." };
    }

    const img =
      typeof o.orderImageUrl === "string" && o.orderImageUrl.trim() ? o.orderImageUrl.trim() : null;
    if (img) {
      await prisma.order.update({
        where: { id: order.id },
        data: { imageUrl: img },
      });
    }

    await prisma.companyPreparerShoppingDraft.update({
      where: { id: draftId },
      data: {
        status: PreparerShoppingDraftStatus.sent,
        sentOrderId: order.id,
      },
    });

    revalidatePath("/preparer/preparation");
    revalidatePath(`/preparer/preparation/draft/${draftId}`);
    revalidatePath("/preparer");
    return res;
  } catch (e) {
    console.error("submitPreparerShoppingDraft", e);
    return { error: "تعذّر إرسال الطلب. أعد المحاولة أو تواصل مع الإدارة." };
  }
}
