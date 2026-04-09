"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import {
  buildCustomerInvoiceText,
  buildPreparerPurchaseSummaryText,
} from "@/lib/preparation-invoice";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { CourierWalletMiscDirection, PreparerShoppingDraftStatus } from "@prisma/client";

export type PricingState = { error?: string; ok?: boolean };

export async function savePricingProgress(id: string, isDraft: boolean, products: any[], placesCount: number) {
  try {
    const safeProducts = Array.isArray(products) ? products.filter(Boolean) : [];
    if (isDraft) {
      const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id } });
      if (!draft) return { error: "المسودة غير موجودة" };
      await prisma.companyPreparerShoppingDraft.update({
        where: { id },
        data: {
          data: { ...(draft.data as any || {}), products: safeProducts },
          placesCount
        }
      });
    } else {
      const order = await prisma.order.findUnique({ where: { id }, select: { preparerShoppingJson: true } });
      if (!order) return { error: "الطلب غير موجود" };
      await prisma.order.update({
        where: { id },
        data: {
          preparerShoppingJson: { ...(order.preparerShoppingJson as any || {}), products: safeProducts, placesCount }
        }
      });
    }
    return { ok: true };
  } catch (e) {
    console.error("Auto-save error:", e);
    return { error: "فشل الحفظ التلقائي" };
  }
}

export async function updateOrderPricingByAdmin(orderId: string, _prev: any, formData: FormData): Promise<PricingState> {
  const productsJson = String(formData.get("productsJson") ?? "[]");
  const placesCount = Number(formData.get("placesCount") ?? 1);
  const skipWallet = formData.get("skipWallet") === "on";
  const isDraft = formData.get("isDraft") === "true";
  const shopId = String(formData.get("shopId") ?? "").trim();

  let uiProducts: any[] = [];
  try {
    uiProducts = JSON.parse(productsJson).filter(Boolean);
  } catch (e) {
    return { error: "بيانات المنتجات غير صالحة" };
  }

  // --- 1. جلب البيانات الأصلية من قاعدة البيانات ---
  let draftData: any = null;
  let customerRegion: any = null;
  let originalOrder: any = null;

  if (isDraft) {
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: orderId },
      include: { customerRegion: true }
    });
    if (!draft) return { error: "المسودة غير موجودة" };
    draftData = draft;
    customerRegion = draft.customerRegion;
  } else {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customerRegion: true, shop: { include: { region: true } } }
    });
    if (!order) return { error: "الطلب غير موجود" };
    originalOrder = order;
    customerRegion = order.customerRegion;
  }

  // --- 2. معالجة المنتجات ---
  // نعتمد على بيانات الواجهة (uiProducts) لأنها تحمل التعديلات الإدارية وتوزيع المجهزين الصحيح لكل سطر.
  // تجنبنا الدمج التلقائي بالاسم (Map) لمنع "flipping" المجهزين عند وجود مواد بنفس الاسم.
  const finalProducts = uiProducts.map(uiProd => ({
    line: String(uiProd.line || "").trim(),
    buyAlf: Number(uiProd.buyAlf || 0),
    sellAlf: Number(uiProd.sellAlf || 0),
    pricedBy: uiProd.pricedBy || null,
  }));

  // --- 3. حساب الإجماليات العامة ---
  let sumSellAlf = 0;
  for (const p of finalProducts) {
    sumSellAlf += p.sellAlf;
  }
  const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);
  const subtotalDinar = new Decimal(sumSellAlf + extraAlf).mul(ALF_PER_DINAR);

  // --- 4. تجميع المنتجات حسب المجهز الذي سعرها (pricedBy) ---
  const preparerMap = new Map<string, { products: any[]; totalBuyAlf: number }>();
  for (const p of finalProducts) {
    const preparerName = p.pricedBy?.trim();
    if (!preparerName) continue;

    if (!preparerMap.has(preparerName)) {
      preparerMap.set(preparerName, { products: [], totalBuyAlf: 0 });
    }
    const entry = preparerMap.get(preparerName)!;
    entry.products.push(p);
    entry.totalBuyAlf += p.buyAlf;
  }

  // --- 5. تحضير الفواتير المنفصلة ---
  const preparerInvoices = Array.from(preparerMap.entries()).map(([name, data]) => ({
    preparerName: name,
    products: data.products,
    totalBuyAlf: data.totalBuyAlf,
    invoiceText: buildPreparerPurchaseSummaryText(data.products)
  }));

  if (!skipWallet && preparerInvoices.length === 0 && finalProducts.length > 0) {
    return { error: "لا يمكن تحديد المجهزين لهذه المنتجات. تأكد من أن كل منتج قد تم تسعيره من قبل أحد المجهزين." };
  }

  // --- 6. بناء نص الملاحظات الرئيسي للطلب ---
  const summaryParts = preparerInvoices.map(inv => {
    return `[ تجهيز: ${inv.preparerName} ]\n${inv.invoiceText}\n(المجموع: ${inv.totalBuyAlf} ألف)`;
  });
  const CUSTOMER_NOTE_BORDER = "═══════════════";
  const summaryCombined = [
    CUSTOMER_NOTE_BORDER,
    "المنتجات المجهزة (حسب المجهز)",
    CUSTOMER_NOTE_BORDER,
    summaryParts.join("\n\n═══════════════\n\n"),
    CUSTOMER_NOTE_BORDER
  ].join("\n");

  // --- 7. جلب بيانات المتجر والتوصيل ---
  let shop = null;
  let deliveryDinar = new Decimal(0);
  if (isDraft) {
    if (!shopId) return { error: "يجب اختيار المحل المستهدف لتحويل المسودة" };
    shop = await prisma.shop.findUnique({ where: { id: shopId }, include: { region: true } });
    if (!shop) return { error: "المحل غير موجود" };
    deliveryDinar = Decimal.max(shop.region.deliveryPrice, customerRegion?.deliveryPrice || 0);
  } else {
    shop = originalOrder!.shop;
    deliveryDinar = originalOrder!.deliveryPrice || new Decimal(0);
  }

  const totalDinar = subtotalDinar.plus(deliveryDinar);
  const deliveryAlf = Number(deliveryDinar.toString()) / ALF_PER_DINAR;

  return await prisma.$transaction(async (tx) => {
    let finalOrderId: string;
    let finalOrderNumber: number;

    // --- 8. إنشاء الطلب النهائي أو تحديثه ---
    if (isDraft) {
      const newOrder = await tx.order.create({
        data: {
          shopId: shop!.id,
          customerPhone: draftData!.customerPhone,
          customerRegionId: draftData!.customerRegionId,
          customerLandmark: draftData!.customerLandmark,
          orderNoteTime: draftData!.orderTime,
          status: "pending",
          orderType: "تجهيز تسوق",
          submissionSource: "company_preparer",
          submittedByCompanyPreparerId: null,
          orderSubtotal: subtotalDinar,
          deliveryPrice: deliveryDinar,
          totalAmount: totalDinar,
          summary: summaryCombined,
          preparerShoppingJson: {
            version: 1,
            products: finalProducts,
            placesCount,
            sumSellAlf,
            extraAlf,
            deliveryAlf,
            preparerInvoices,
            customerInvoiceText: buildCustomerInvoiceText({
              brandLabel: "أبو الأكبر للتوصيل",
              orderNumberLabel: `#(جديد)`,
              regionTitle: draftData!.titleLine,
              phone: draftData!.customerPhone,
              lines: finalProducts,
              placesCount,
              deliveryAlf,
            })
          }
        }
      });
      finalOrderId = newOrder.id;
      finalOrderNumber = newOrder.orderNumber;

      await tx.companyPreparerShoppingDraft.update({
        where: { id: orderId },
        data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: newOrder.id }
      });
    } else {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          orderSubtotal: subtotalDinar,
          totalAmount: totalDinar,
          summary: summaryCombined,
          preparerShoppingJson: {
            ...(originalOrder!.preparerShoppingJson as any || {}),
            version: 1,
            products: finalProducts,
            placesCount,
            sumSellAlf,
            extraAlf,
            deliveryAlf,
            preparerInvoices,
            customerInvoiceText: buildCustomerInvoiceText({
              brandLabel: "أبو الأكبر للتوصيل",
              orderNumberLabel: `#${originalOrder!.orderNumber}`,
              regionTitle: customerRegion?.name || "",
              phone: originalOrder!.customerPhone,
              lines: finalProducts,
              placesCount,
              deliveryAlf,
            })
          }
        }
      });
      finalOrderId = orderId;
      finalOrderNumber = updated.orderNumber;
    }

    // --- 9. تسجيل القيود المالية وتصحيح التكرار ---
    if (!skipWallet) {
      const allPreparers = await tx.companyPreparer.findMany({
        where: { active: true },
        select: { id: true, name: true, walletEmployeeId: true }
      });

      // مسح كافة الفواتير السابقة المرتبطة بهذا الطلب لمنع التكرار (تلبية لطلب "مفروض يعدل مو يسوي فاتورة")
      await tx.employeeWalletMiscEntry.updateMany({
        where: {
          label: { contains: `طلب #${finalOrderNumber}` },
          deletedAt: null
        },
        data: {
          deletedAt: new Date(),
          deletedReason: "manual_admin",
          deletedByDisplayName: "تحديث الأسعار من الإدارة"
        }
      });

      for (const inv of preparerInvoices) {
        const preparer = allPreparers.find(p => p.name.trim() === inv.preparerName.trim());
        if (preparer && preparer.walletEmployeeId && inv.totalBuyAlf > 0) {
          await tx.employeeWalletMiscEntry.create({
            data: {
              employeeId: preparer.walletEmployeeId,
              direction: CourierWalletMiscDirection.give,
              amountDinar: new Decimal(inv.totalBuyAlf).mul(ALF_PER_DINAR),
              label: `فاتورة تجهيز طلب #${finalOrderNumber} (مساهمتك)`
            }
          });
        }
      }
    }

    revalidatePath("/admin/orders/pending");
    revalidatePath(`/admin/orders/${finalOrderId}`);
    return { ok: true };
  });
}
