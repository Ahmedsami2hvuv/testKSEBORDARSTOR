import type { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";

/** مجموع حركات الوارد (استلام من الزبون) غير المحذوفة — يدعم دفعات جزئية متعددة */
export function sumDeliveryInFromOrderMoneyEvents(
  moneyEvents: Array<{
    kind: string;
    amountDinar: Decimal;
    deletedAt: Date | null;
  }>,
): Decimal | null {
  let sum: Decimal | null = null;
  for (const e of moneyEvents) {
    if (e.kind === MONEY_KIND_DELIVERY && e.deletedAt == null) {
      sum = sum == null ? e.amountDinar : sum.plus(e.amountDinar);
    }
  }
  return sum;
}

/** المجموع المتوقع = سعر الطلب + التوصيل */
export function orderExpectedTotal(
  orderSubtotal: Decimal | null,
  deliveryPrice: Decimal | null,
): Decimal | null {
  if (orderSubtotal == null || deliveryPrice == null) return null;
  return orderSubtotal.plus(deliveryPrice);
}

/** المبلغ الفعلي للتسليم: مجموع حركات «وارد» إن وُجدت، وإلا حقل الطلب */
function deliveredActualAmount(
  totalAmount: Decimal | null,
  deliveryEventsSum: Decimal | null | undefined,
): Decimal | null {
  return deliveryEventsSum ?? totalAmount;
}

/** فحص الصادر: المبلغ المُسلَّم أكبر من المجموع المتوقع */
export function deliveredSaderMismatch(
  status: string,
  totalAmount: Decimal | null,
  orderSubtotal: Decimal | null,
  deliveryPrice: Decimal | null,
  /** مجموع حركات الوارد الفعلية (دفعات جزئية)؛ إن وُجد يُستخدم بدل `totalAmount` */
  deliveryEventAmount?: Decimal | null,
): boolean {
  if (status !== "delivered") return false;
  const exp = orderExpectedTotal(orderSubtotal, deliveryPrice);
  const actual = deliveredActualAmount(totalAmount, deliveryEventAmount);
  if (!exp || actual == null) return false;
  return actual.greaterThan(exp);
}

/** فحص الوارد: المبلغ المُسلَّم أقل من المجموع المتوقع */
export function deliveredWardMismatch(
  status: string,
  totalAmount: Decimal | null,
  orderSubtotal: Decimal | null,
  deliveryPrice: Decimal | null,
  /** مجموع حركات الوارد الفعلية (دفعات جزئية)؛ إن وُجد يُستخدم بدل `totalAmount` */
  deliveryEventAmount?: Decimal | null,
): boolean {
  if (status !== "delivered") return false;
  const exp = orderExpectedTotal(orderSubtotal, deliveryPrice);
  const actual = deliveredActualAmount(totalAmount, deliveryEventAmount);
  if (!exp || actual == null) return false;
  return actual.lessThan(exp);
}
