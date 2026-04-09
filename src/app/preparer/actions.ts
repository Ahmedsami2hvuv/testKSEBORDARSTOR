"use server";
// v4-bulletproof-fix: ضمان الحفظ الفوري ومنع التضارب بين المجهزين + توزيع الفواتير + حماية الملكية التامة

import { CourierWalletMiscDirection, Prisma, PreparerShoppingDraftStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { ALF_PER_DINAR, parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import {
  buildCustomerInvoiceText,
  buildPreparerPurchaseSummaryText,
} from "@/lib/preparation-invoice";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { prisma } from "@/lib/prisma";
import { MAX_ORDER_IMAGE_BYTES, saveOrderImageUploaded, saveShopDoorPhotoUploaded } from "@/lib/order-image";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { notifyTelegramNewOrder, notifyTelegramPresenceChange } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder, pushNotifyAdminsPresenceChange } from "@/lib/web-push-server";
import { assignPendingOrderToCourierInternal, transferOrderToCourierInternal } from "@/lib/order-assign-courier";

export type PreparerActionState = { error?: string; ok?: boolean; orderNumber?: number; draftId?: string };

const PREPARER_PORTAL_LABEL = "بوابة المجهز";

function formatBorderedSummarySection(title: string, raw: string): string {
  const CUSTOMER_NOTE_BORDER = "═══════════════";
  const t = raw.trim();
  if (!t) return "";
  return[
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

/**
 * تحديث مسودة التجهيز - مع حماية الملكية للمنتجات (المنع التام للتداخل)
 */
export async function updatePreparerShoppingDraft(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const draftId = String(formData.get("draftId") ?? "").trim();
    if (!draftId) return { error: "المعرف ناقص." };

    const currentPreparer = await prisma.companyPreparer.findFirst({
      where: { id: v.preparerId, active: true },
      select: { id: true, name: true }
    });
    if (!currentPreparer) return { error: "الحساب غير متاح." };

    const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: draftId } });
    if (!draft) return { error: "المسودة غير موجودة." };

    const productsJsonRaw = String(formData.get("productsJson") ?? "[]");
    let uiProducts: any[] =[];
    try { uiProducts = JSON.parse(productsJsonRaw); } catch { return { error: "بيانات غير صالحة." }; }

    const dbData = (draft.data as any) || { products:[] };
    const groupId = dbData.groupId;
    const preparerNameClean = currentPreparer.name.trim();

    // جلب جميع المسودات المرتبطة لضمان المزامنة
    let relatedDrafts = [draft];
    if (groupId) {
        relatedDrafts = await prisma.companyPreparerShoppingDraft.findMany({
            where: { data: { path:["groupId"], equals: groupId } }
        });
    } else {
        relatedDrafts = await prisma.companyPreparerShoppingDraft.findMany({
            where: {
                customerPhone: draft.customerPhone,
                titleLine: draft.titleLine,
                status: { in: ["draft", "priced"] }
            }
        });
    }

    const mergedProducts = uiProducts.map((uiProd, index) => {
        const dbProd = (dbData.products && dbData.products[index]) || {};

        const uiHasPrice = uiProd.buyAlf != null && uiProd.buyAlf !== "" && uiProd.buyAlf !== 0;
        const dbHasPrice = dbProd?.buyAlf != null && dbProd?.buyAlf !== "" && dbProd?.buyAlf !== 0;

        if (uiHasPrice) {
            if (dbHasPrice && Number(uiProd.buyAlf) === Number(dbProd.buyAlf) && Number(uiProd.sellAlf) === Number(dbProd.sellAlf)) {
                return { ...uiProd, pricedBy: dbProd.pricedBy || uiProd.pricedBy };
            }
            return { ...uiProd, pricedBy: uiProd.pricedBy || preparerNameClean };
        }

        return { ...uiProd, pricedBy: dbProd.pricedBy || null };
    });

    const placesRaw = String(formData.get("placesCount") ?? "");
    const placesCount = placesRaw === "" ? (draft.placesCount ?? null) : Number(placesRaw);
    const newStatus = mergedProducts.every((p: any) => p.buyAlf != null && p.buyAlf !== "") ? "priced" : "draft";

    const titleLine = String(formData.get("titleLine") ?? draft.titleLine);
    const customerPhone = String(formData.get("customerPhone") ?? draft.customerPhone);
    const customerName = String(formData.get("customerName") ?? draft.customerName);
    const customerLandmark = String(formData.get("customerLandmark") ?? draft.customerLandmark);
    const orderTime = String(formData.get("orderTime") ?? draft.orderTime);

    const updatePromises = relatedDrafts.map(rd => {
        return prisma.companyPreparerShoppingDraft.update({
            where: { id: rd.id },
            data: {
                titleLine,
                customerPhone,
                customerName,
                customerLandmark,
                orderTime,
                placesCount,
                data: {
                    ...(rd.data as any),
                    products: mergedProducts,
                    lastActivityAt: new Date().toISOString()
                },
                status: newStatus as any
            }
        });
    });

    await Promise.all(updatePromises);

    revalidatePath(`/preparer/preparation/draft/${draftId}`);
    return { ok: true };
  } catch (e) {
    console.error("Update Draft Error:", e);
    return { error: "فشل الحفظ بسبب خطأ تقني." };
  }
}

export async function submitPreparerShoppingDraft(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const draftId = String(formData.get("draftId") ?? "").trim();
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: draftId },
      include: { preparer: true }
    });
    if (!draft) return { error: "المسودة غير موجودة." };

    if (draft.status === "sent" || draft.status === "archived") {
        return { error: "لقد تم إرسال هذا الطلب مسبقاً إلى النظام." };
    }

    const currentPreparer = await prisma.companyPreparer.findFirst({
        where: { id: v.preparerId, active: true },
        select: { name: true }
    });

    const link = await prisma.preparerShop.findFirst({
      where: { preparerId: v.preparerId, canSubmitOrders: true },
      orderBy: { assignedAt: "asc" },
    });
    if (!link) return { error: "لا يوجد محل مفعّل لك صلاحية رفع الطلب." };

    const data = draft.data as any;
    const products = data.products as any[];
    if (!products || products.some(p => p.buyAlf == null || p.buyAlf === "")) return { error: "أكمل تسعير جميع المواد." };

    const shop = await prisma.shop.findUnique({ where: { id: link.shopId }, include: { region: true } });
    const custRegion = await prisma.region.findUnique({ where: { id: draft.customerRegionId! } });
    if (!shop || !custRegion) return { error: "خطأ في بيانات المحل أو المنطقة." };

    const placesCount = draft.placesCount || 1;
    const delivery = Decimal.max(shop.region.deliveryPrice, custRegion.deliveryPrice);
    const sumSellAlf = products.reduce((acc, p) => acc + Number(p.sellAlf), 0);
    const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);
    const subtotal = new Decimal(sumSellAlf + extraAlf).mul(ALF_PER_DINAR);
    const total = subtotal.plus(delivery);

    const preparerNames = Array.from(new Set(products.map(p => p.pricedBy || currentPreparer?.name?.trim()).filter(Boolean)));
    const preparerInvoices = preparerNames.map(name => {
        const myProducts = products.filter(p => (p.pricedBy || currentPreparer?.name?.trim()) === name);
        const myTotalBuy = myProducts.reduce((acc, p) => acc + Number(p.buyAlf || 0), 0);
        const myTotalSell = myProducts.reduce((acc, p) => acc + Number(p.sellAlf || 0), 0);
        return {
            preparerName: String(name),
            products: myProducts,
            totalBuyAlf: myTotalBuy,
            totalSellAlf: myTotalSell,
            invoiceText: buildPreparerPurchaseSummaryText(myProducts)
        };
    });

    const summaryParts = preparerInvoices.map(inv => {
        return `[ تجهيز: ${inv.preparerName} ]\n${inv.invoiceText}\n(المجموع: ${inv.totalSellAlf})`;
    });

    const order = await prisma.order.create({
      data: {
        shopId: shop.id,
        status: "pending",
        orderType: "تجهيز تسوق",
        customerPhone: draft.customerPhone,
        customerRegionId: draft.customerRegionId,
        customerLandmark: draft.customerLandmark,
        orderNoteTime: draft.orderTime,
        deliveryPrice: delivery,
        orderSubtotal: subtotal,
        totalAmount: total,
        submissionSource: "company_preparer",
        submittedByCompanyPreparerId: null,
        summary: formatBorderedSummarySection("المنتجات حسب المجهز", summaryParts.join("\n\n═══════════════\n\n")),
        preparerShoppingJson: {
          version: 1,
          products,
          placesCount,
          sumSellAlf,
          extraAlf,
          deliveryAlf: Number(delivery) / ALF_PER_DINAR,
          preparerInvoices,
          customerInvoiceText: buildCustomerInvoiceText({
            brandLabel: "أبو الأكبر للتوصيل",
            orderNumberLabel: "...",
            regionTitle: draft.titleLine,
            phone: draft.customerPhone,
            lines: products,
            placesCount,
            deliveryAlf: Number(delivery) / ALF_PER_DINAR
          })
        }
      }
    });

    const allPreps = await prisma.companyPreparer.findMany({
        where: { active: true },
        select: { id: true, name: true, walletEmployeeId: true }
    });

    for (const inv of preparerInvoices) {
        const prep = allPreps.find(p => p.name.trim() === inv.preparerName.trim());
        if (prep) {
            if (prep.walletEmployeeId && inv.totalBuyAlf > 0) {
                await prisma.employeeWalletMiscEntry.create({
                    data: {
                        employeeId: prep.walletEmployeeId,
                        direction: CourierWalletMiscDirection.give,
                        amountDinar: new Decimal(inv.totalBuyAlf).mul(ALF_PER_DINAR),
                        label: `فاتورة تجهيز طلب #${order.orderNumber} (مساهمتك)`,
                    },
                });
            }

            await prisma.companyPreparerPrepNotice.create({
                data: {
                    preparerId: prep.id,
                    title: `قائمة تجهيز الطلب #${order.orderNumber}`,
                    body:[
                        `المنطقة: ${draft.titleLine}`,
                        `الزبون: ${draft.customerPhone}`,
                        `═══════════════`,
                        `المواد التي جهزتها أنت:`,
                        inv.invoiceText,
                        `═══════════════`,
                        `إجمالي البيع: ${inv.totalSellAlf}`
                    ].join("\n")
                }
            });
        }
    }

    const groupId = (draft.data as any)?.groupId;
    if (groupId) {
        await prisma.companyPreparerShoppingDraft.updateMany({
            where: { data: { path: ["groupId"], equals: groupId } },
            data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: order.id }
        });
    } else {
        await prisma.companyPreparerShoppingDraft.updateMany({
            where: {
                customerPhone: draft.customerPhone,
                titleLine: draft.titleLine,
                status: { in: ["draft", "priced"] }
            },
            data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: order.id }
        });
    }

    revalidatePath("/preparer");
    return { ok: true, orderNumber: order.orderNumber };
  } catch (e) {
    console.error(e);
    return { error: "فشل إرسال الطلب." };
  }
}

export async function createPreparerShoppingDraftFromAnalysis(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
    try {
        const p = String(formData.get("p") ?? "").trim();
        const exp = String(formData.get("exp") ?? "").trim();
        const s = String(formData.get("s") ?? "").trim();
        const v = verifyCompanyPreparerPortalQuery(p, exp, s);
        if (!v.ok) return { error: "الرابط غير صالح." };

        const productsCsv = String(formData.get("productsCsv") ?? "");
        const productLines = productsCsv.split("\n").map(l => l.trim()).filter(Boolean);
        if (productLines.length === 0) return { error: "لا توجد منتجات." };

        const customerRegionId = String(formData.get("customerRegionId") ?? "").trim() || null;

        const draft = await prisma.companyPreparerShoppingDraft.create({
            data: {
                preparerId: v.preparerId,
                titleLine: String(formData.get("titleLine") ?? ""),
                customerPhone: String(formData.get("customerPhone") ?? ""),
                customerName: String(formData.get("customerName") ?? ""),
                customerLandmark: String(formData.get("customerLandmark") ?? ""),
                orderTime: String(formData.get("orderTime") ?? "فوري"),
                customerRegionId,
                rawListText: String(formData.get("rawListText") ?? ""),
                data: {
                    products: productLines.map(line => ({ line, buyAlf: null, sellAlf: null, pricedBy: null }))
                }
            }
        });
        return { ok: true, draftId: draft.id };
    } catch (e) {
        console.error(e);
        return { error: "فشل إنشاء المسودة." };
    }
}

export async function submitPreparerOrder(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId, active: true },
    });
    if (!preparer) return { error: "حساب المجهز غير موجود." };

    const shopId = String(formData.get("shopId") ?? "").trim();
    if (!shopId) return { error: "المحل مطلوب." };

    const orderType = String(formData.get("orderType") ?? "").trim();
    const orderNoteTime = String(formData.get("orderTime") ?? "").trim();
    const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
    const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
    const customerName = String(formData.get("customerName") ?? "").trim();
    const alternatePhone = String(formData.get("alternatePhone") ?? "").trim();
    const summary = String(formData.get("notes") ?? "").trim();
    const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
    const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
    const prepaidAll = formData.get("prepaidAll") === "on";

    const customerPhone = normalizeIraqMobileLocal11(customerPhoneRaw);
    if (!customerPhone) return { error: "رقم هاتف الزبون غير صالح." };
    if (!customerRegionId) return { error: "منطقة الزبون مطلوبة." };

    const subtotalParsed = parseAlfInputToDinarDecimalRequired(
      String(formData.get("orderSubtotal") ?? "0"),
    );
    if (!subtotalParsed.ok) return { error: "سعر الطلب غير صالح." };

    const [shop, region] = await Promise.all([
      prisma.shop.findUnique({ where: { id: shopId }, include: { region: true } }),
      prisma.region.findUnique({ where: { id: customerRegionId } }),
    ]);

    if (!shop || !region) return { error: "بيانات المحل أو المنطقة غير موجودة." };

    const orderImg = formData.get("orderImage");
    const shopDoorImg = formData.get("shopDoorPhoto");

    let imageUrl: string | null = null;
    let shopDoorPhotoUrl: string | null = null;

    try {
      if (orderImg instanceof File && orderImg.size > 0) {
        imageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
      }
      if (shopDoorImg instanceof File && shopDoorImg.size > 0) {
        shopDoorPhotoUrl = await saveShopDoorPhotoUploaded(shopDoorImg, MAX_ORDER_IMAGE_BYTES);
      }
    } catch (e) {
      return { error: "تعذّر حفظ الصور المرفقة." };
    }

    const customerRow = await upsertCustomerByPhone({
      shopId,
      phone: customerPhone,
      regionId: customerRegionId,
      locationUrl: customerLocationUrl,
      landmark: customerLandmark,
    });

    const delivery = Decimal.max(shop.region.deliveryPrice, region.deliveryPrice);
    const total = new Decimal(subtotalParsed.value).plus(delivery);

    const order = await prisma.order.create({
      data: {
        shopId,
        customerId: customerRow.id,
        status: "pending",
        submissionSource: "company_preparer",
        submittedByCompanyPreparerId: v.preparerId,
        orderType,
        orderNoteTime,
        customerPhone,
        alternatePhone,
        customerRegionId,
        customerLocationUrl,
        customerLandmark,
        summary,
        orderSubtotal: subtotalParsed.value,
        deliveryPrice: delivery,
        totalAmount: total,
        prepaidAll,
        imageUrl,
        orderImageUploadedByName: imageUrl ? PREPARER_PORTAL_LABEL : null,
        shopDoorPhotoUrl,
        shopDoorPhotoUploadedByName: shopDoorPhotoUrl ? PREPARER_PORTAL_LABEL : null,
      },
    });

    await syncPhoneProfileFromOrder(order.id);
    void notifyTelegramNewOrder(order.id);
    void pushNotifyAdminsNewPendingOrder(order.orderNumber);

    revalidatePath("/preparer");
    return { ok: true, orderNumber: order.orderNumber };
  } catch (e) {
    console.error("Submit Order Error:", e);
    return { error: "فشل إرسال الطلب بسبب خطأ تقني." };
  }
}

export async function setPreparerPresenceFromForm(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) return { error: "الرابط غير صالح." };
  const availableRaw = String(formData.get("available") ?? "").trim();
  const available = availableRaw === "true" || availableRaw === "on";
  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
  });
  if (!preparer) return { error: "الحساب غير متاح." };
  if (preparer.availableForAssignment === available) {
    revalidatePath("/preparer");
    return { ok: true };
  }
  await prisma.companyPreparer.update({
    where: { id: preparer.id },
    data: { availableForAssignment: available },
  });
  void notifyTelegramPresenceChange({ kind: "preparer", name: preparer.name, available });
  void pushNotifyAdminsPresenceChange({ kind: "preparer", name: preparer.name, available });
  revalidatePath("/preparer");
  return { ok: true };
}

export async function bulkAssignOrdersByPreparer(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) return { error: "الرابط غير صالح." };
  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });
  if (!preparer) return { error: "الحساب غير متاح." };
  const courierId = String(formData.get("courierId") ?? "").trim();
  const orderIdsRaw = String(formData.get("orderIds") ?? "").trim();
  if (!courierId || !orderIdsRaw) return { error: "اختر المندوب والطلبات." };
  const orderIds = orderIdsRaw.split(",").map((x) => x.trim()).filter(Boolean);
  if (orderIds.length === 0) return { error: "لم يُحدَّد أي طلب." };

  let okCount = 0;
  let lastError: string | undefined;

  for (const orderId of orderIds) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) { lastError = "طلب غير موجود."; continue; }
    if (order.status !== "pending" && order.status !== "assigned") {
      lastError = "يمكن تعديل الإسناد لطلبات جديد أو مسند فقط.";
      continue;
    }
    const res = order.status === "pending"
        ? await assignPendingOrderToCourierInternal(orderId, courierId, { bypassCourierAvailability: true })
        : await transferOrderToCourierInternal(orderId, courierId, { bypassCourierAvailability: true });
    if ("error" in res && res.error) { lastError = res.error; continue; }
    okCount += 1;
  }

  if (okCount === 0) return { error: lastError ?? "لم يُسنَد أي طلب." };
  revalidatePath("/preparer");
  revalidatePath("/mandoub");
  return { ok: true };
}

export async function dismissCompanyPreparerPrepNotice(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) return { error: "الرابط غير صالح." };
  const noticeId = String(formData.get("noticeId") ?? "").trim();
  if (!noticeId) return { error: "معرّف الإشعار ناقص." };
  await prisma.companyPreparerPrepNotice.updateMany({
    where: { id: noticeId, preparerId: v.preparerId, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });
  revalidatePath("/preparer");
  return { ok: true };
}

export async function submitPreparerShoppingOrder(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }
export async function updatePreparerShoppingOrder(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }
export async function assignOrderByPreparer(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }
export async function updatePreparerOrderFields(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }
