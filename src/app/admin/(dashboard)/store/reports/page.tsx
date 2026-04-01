import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export const metadata = {
  title: "تقارير المتجر — لوحة الإدارة",
};

type Props = {
  searchParams?: Promise<{ days?: string }>;
};

export default async function AdminStoreReportsPage({ searchParams }: Props) {
  if (!(await isAdminSession())) redirect("/admin/login");

  const sp = (await searchParams) ?? {};
  const daysRaw = (sp.days ?? "").trim();
  const days = daysRaw ? parseInt(daysRaw, 10) : 30;
  const safeDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 30;
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const orders = await prisma.storeOrder.findMany({
    where: { status: "confirmed", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalSaleDinar: true,
      totalCostDinar: true,
      profitDinar: true,
    },
  });

  const totals = orders.reduce(
    (acc, o) => {
      acc.sale += Number(o.totalSaleDinar);
      acc.cost += Number(o.totalCostDinar);
      acc.profit += Number(o.profitDinar);
      return acc;
    },
    { sale: 0, cost: 0, profit: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>تقارير المتجر</h1>
          <p className={`mt-1 ${ad.muted}`}>
            الربح = مجموع (سعر البيع − سعر الشراء) × الكمية ضمن الطلبات المؤكدة.
          </p>
        </div>
        <Link href="/admin/store" className={ad.link}>
          ← المتجر
        </Link>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>ملخص آخر {safeDays} يوم</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <div className={ad.muted}>مبيعات</div>
            <div className="mt-1 text-lg font-extrabold text-slate-800">
              {formatDinarAsAlfWithUnit(totals.sale)}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <div className={ad.muted}>تكلفة شراء</div>
            <div className="mt-1 text-lg font-extrabold text-slate-800">
              {formatDinarAsAlfWithUnit(totals.cost)}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className={ad.muted}>ربح</div>
            <div className="mt-1 text-lg font-extrabold text-emerald-900">
              {formatDinarAsAlfWithUnit(totals.profit)}
            </div>
          </div>
        </div>
      </section>

      <section className={ad.section}>
        <h2 className={ad.h2}>آخر الطلبات المؤكدة</h2>
        {orders.length === 0 ? (
          <p className={`mt-3 ${ad.muted}`}>لا يوجد طلبات مؤكدة ضمن الفترة.</p>
        ) : (
          <div className={`mt-3 ${ad.listDivide}`}>
            {orders.slice(0, 50).map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <div className={ad.listTitle}>طلب #{o.orderNumber}</div>
                  <div className={ad.listMuted}>
                    مبيعات: {formatDinarAsAlfWithUnit(o.totalSaleDinar)} · ربح:{" "}
                    {formatDinarAsAlfWithUnit(o.profitDinar)}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(o.createdAt).toLocaleString("ar-IQ-u-nu-latn")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

