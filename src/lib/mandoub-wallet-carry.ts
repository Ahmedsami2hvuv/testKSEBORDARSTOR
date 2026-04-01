import { Decimal } from "@prisma/client/runtime/library";
import { CourierWalletMiscDirection } from "@prisma/client";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { prisma } from "@/lib/prisma";

/**
 * حساب "مربع الإدارة" (ما بذمة المندوب للشركة).
 * المعادلة: (إجمالي الوارد) - (إجمالي الصادر) - (الأرباح المستحقة).
 * وارد = وارد الطلبات + أخذت (يدوي/تحويل).
 * صادر = صادر الطلبات + أعطيت (يدوي/تحويل).
 */
export async function computeMandoubAdminTotalAllTimeDinar(courierId: string): Promise<Decimal> {
  const [sumOrderWard, sumOrderSader, sumMiscTake, sumMiscGive, earnings] = await Promise.all([
    prisma.orderCourierMoneyEvent.aggregate({
      where: { courierId, deletedAt: null, kind: MONEY_KIND_DELIVERY },
      _sum: { amountDinar: true },
    }),
    prisma.orderCourierMoneyEvent.aggregate({
      where: { courierId, deletedAt: null, kind: MONEY_KIND_PICKUP },
      _sum: { amountDinar: true },
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.take },
      _sum: { amountDinar: true },
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.give },
      _sum: { amountDinar: true },
    }),
    computeMandoubEarningsAllTimeDinar(courierId),
  ]);

  const ward = (sumOrderWard._sum.amountDinar ?? new Decimal(0)).plus(sumMiscTake._sum.amountDinar ?? new Decimal(0));
  const sader = (sumOrderSader._sum.amountDinar ?? new Decimal(0)).plus(sumMiscGive._sum.amountDinar ?? new Decimal(0));

  return ward.minus(sader).minus(earnings);
}

/** متبقي المحفظة (الكاش الفعلي) */
export async function computeMandoubWalletRemainAllTimeDinar(courierId: string): Promise<Decimal> {
  const [sumOrderWard, sumOrderSader, sumMiscTake, sumMiscGive] = await Promise.all([
    prisma.orderCourierMoneyEvent.aggregate({ where: { courierId, deletedAt: null, kind: MONEY_KIND_DELIVERY }, _sum: { amountDinar: true } }),
    prisma.orderCourierMoneyEvent.aggregate({ where: { courierId, deletedAt: null, kind: MONEY_KIND_PICKUP }, _sum: { amountDinar: true } }),
    prisma.courierWalletMiscEntry.aggregate({ where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.take }, _sum: { amountDinar: true } }),
    prisma.courierWalletMiscEntry.aggregate({ where: { courierId, deletedAt: null, direction: CourierWalletMiscDirection.give }, _sum: { amountDinar: true } }),
  ]);
  const ward = (sumOrderWard._sum.amountDinar ?? new Decimal(0)).plus(sumMiscTake._sum.amountDinar ?? new Decimal(0));
  const sader = (sumOrderSader._sum.amountDinar ?? new Decimal(0)).plus(sumMiscGive._sum.amountDinar ?? new Decimal(0));
  return ward.minus(sader);
}

export function mandoubWalletRemainDinar(
  carryOverDinar: Decimal | null | undefined,
  remainingNetMerged: Decimal,
  pendingIncomingSum: Decimal,
  pendingOutgoingSum: Decimal,
): Decimal {
  const c = carryOverDinar ?? new Decimal(0);
  return c.plus(remainingNetMerged).plus(pendingIncomingSum).minus(pendingOutgoingSum);
}

export function mandoubHandToAdminDinar(walletRemain: Decimal, sumEarnings: Decimal): Decimal {
  return walletRemain.minus(sumEarnings);
}

export async function computeMandoubEarningsAllTimeDinar(courierId: string): Promise<Decimal> {
  const res = await prisma.order.aggregate({
    where: { courierEarningForCourierId: courierId, status: { in: ["delivered", "archived"] } },
    _sum: { courierEarningDinar: true },
  });
  return res._sum.courierEarningDinar ?? new Decimal(0);
}
