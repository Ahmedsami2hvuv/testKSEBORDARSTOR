import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ربط المحاسبة — أبو الأكبر للتوصيل",
};

export default async function AccountingReportPage() {
  const deliveredWhere = { status: "delivered" as const };

  const [
    deliveredCount,
    shopCostMarked,
    customerPaymentMarked,
    courierSettledMarked,
    sumDeliveredTotals,
    sumDeliveryFeesDelivered,
  ] = await Promise.all([
    prisma.order.count({ where: deliveredWhere }),
    prisma.order.count({
      where: { ...deliveredWhere, shopCostPaidAt: { not: null } },
    }),
    prisma.order.count({
      where: { ...deliveredWhere, customerPaymentReceivedAt: { not: null } },
    }),
    prisma.order.count({
      where: { ...deliveredWhere, courierCashSettledAt: { not: null } },
    }),
    prisma.order.aggregate({
      where: deliveredWhere,
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: deliveredWhere,
      _sum: { deliveryPrice: true },
    }),
  ]);

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/reports" className={ad.link}>
          ← التقارير
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>ربط المحاسبة</h1>
        <p className={`mt-1 ${ad.lead}`}>
          ملخص من الطلبات <strong className="text-sky-900">المسلّمة</strong> حسب ما يُسجَّل في النظام من
          دفع المحل، استلام الزبون، وتسوية المندوب — لمراجعة سريعة قبل إدخالها في دفتر المحاسبة الخارجي.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={`${ad.section} border-emerald-200`}>
          <p className="text-sm font-bold text-emerald-800">طلبات مسلّمة (إجمالي)</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-emerald-950">{deliveredCount}</p>
        </div>
        <div className={`${ad.section} border-sky-200`}>
          <p className="text-sm font-bold text-sky-900">مجموع قيم الطلبات (مسلّمة)</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">
            {formatDinarAsAlfWithUnit(sumDeliveredTotals._sum.totalAmount)}
          </p>
        </div>
        <div className={`${ad.section} border-amber-200`}>
          <p className="text-sm font-bold text-amber-900">مجموع أجور التوصيل (مسلّمة)</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-amber-950">
            {formatDinarAsAlfWithUnit(sumDeliveryFeesDelivered._sum.deliveryPrice)}
          </p>
        </div>
      </div>

      <div className={`${ad.section} border-slate-200`}>
        <h2 className={ad.h2}>علامات التحصيل على الطلبات المسلّمة</h2>
        <p className={`mt-2 text-sm ${ad.muted}`}>
          تُحدَّث من لوحة المندوب أو الإدارة لكل طلبية. العدد أدناه = عدد الطلبات التي فيها العلامة
          مفعّلة.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
            <p className="text-xs font-bold text-emerald-800">دفع حساب العميل (المحل)</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-emerald-950">{shopCostMarked}</p>
          </li>
          <li className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3">
            <p className="text-xs font-bold text-red-900">استلام من الزبون</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-red-950">
              {customerPaymentMarked}
            </p>
          </li>
          <li className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
            <p className="text-xs font-bold text-amber-900">تسوية أجور المندوب</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-950">
              {courierSettledMarked}
            </p>
          </li>
        </ul>
      </div>

      <p className={`text-sm ${ad.muted}`}>
        لا يوجد تصدير تلقائي لبرنامج محاسبة خارجي؛ يمكن نسخ الأرقام يدوياً أو الاعتماد على{" "}
        <Link href="/admin/reports/general" className={ad.link}>
          التقرير العام
        </Link>{" "}
        للتفصيل الزمني.
      </p>
    </div>
  );
}
