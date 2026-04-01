import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير التجهيز — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

type ShoppingJson = {
  products?: unknown;
  sumSellAlf?: unknown;
  sumBuyAlf?: unknown;
  extraAlf?: unknown;
  deliveryAlf?: unknown;
  regionId?: unknown;
  regionName?: unknown;
};

type ProductRow = {
  line: string;
  buyAlf: number;
  sellAlf: number;
  profitAlf: number;
};

type InvoiceRow = {
  id: string;
  orderNumber: number;
  createdAt: Date;
  dayBucket: string;
  monthBucket: string;
  regionCode: string;
  regionName: string;
  preparerName: string;
  products: ProductRow[];
  sumBuyAlf: number;
  sumSellAlf: number;
  extraAlf: number;
  deliveryAlf: number;
  orderProfitAlf: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function numOrZero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtAlf(value: number): string {
  return value.toFixed(2);
}

/**
 * حد اليوم التشغيلي يبدأ من 06:00 صباحا.
 * إذا كان الطلب قبل 06:00 يُحسب لليوم السابق.
 */
function businessDayBucket(date: Date): string {
  const shifted = new Date(date.getTime() - 6 * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** الشهر يبدأ تلقائيا كل يوم 1 من الشهر. */
function monthBucket(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseProducts(raw: unknown): ProductRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: ProductRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const line = String(row.line ?? "").trim();
    const buyAlf = numOrZero(row.buyAlf);
    const sellAlf = numOrZero(row.sellAlf);
    if (!line) continue;
    rows.push({
      line,
      buyAlf,
      sellAlf,
      profitAlf: sellAlf - buyAlf,
    });
  }
  return rows;
}

function startOfDayAtSix(dayBucket: string): Date {
  const [y, m, d] = dayBucket.split("-").map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1, 6, 0, 0, 0);
}

export default async function PreparationReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);

  const rawOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: "delivered",
      submittedByCompanyPreparerId: { not: null },
      preparerShoppingJson: { not: Prisma.AnyNull },
    },
    orderBy: { createdAt: "desc" },
    include: {
      customerRegion: { select: { id: true, name: true } },
      submittedByCompanyPreparer: { select: { name: true } },
    },
  });

  const invoices: InvoiceRow[] = rawOrders.map((o) => {
    const j = (o.preparerShoppingJson ?? null) as ShoppingJson | null;
    const products = parseProducts(j?.products);
    const sumSellAlf = numOrZero(j?.sumSellAlf);
    const sumBuyAlf = numOrZero(j?.sumBuyAlf);
    const extraAlf = numOrZero(j?.extraAlf);
    const deliveryAlf = numOrZero(j?.deliveryAlf);
    const orderProfitAlf = sumSellAlf - sumBuyAlf + extraAlf;
    const regionCode =
      String(o.customerRegion?.id ?? j?.regionId ?? "")
        .trim()
        .toUpperCase() || "—";
    const regionName = String(o.customerRegion?.name ?? j?.regionName ?? "").trim() || "—";

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      dayBucket: businessDayBucket(o.createdAt),
      monthBucket: monthBucket(o.createdAt),
      regionCode,
      regionName,
      preparerName: o.submittedByCompanyPreparer?.name?.trim() || "—",
      products,
      sumBuyAlf,
      sumSellAlf,
      extraAlf,
      deliveryAlf,
      orderProfitAlf,
    };
  });

  const totalProfitAlf = invoices.reduce((sum, x) => sum + x.orderProfitAlf, 0);

  const dailyMap = new Map<string, { totalProfitAlf: number; ordersCount: number }>();
  const monthlyMap = new Map<string, { totalProfitAlf: number; ordersCount: number }>();

  for (const inv of invoices) {
    const d = dailyMap.get(inv.dayBucket) ?? { totalProfitAlf: 0, ordersCount: 0 };
    d.totalProfitAlf += inv.orderProfitAlf;
    d.ordersCount += 1;
    dailyMap.set(inv.dayBucket, d);

    const m = monthlyMap.get(inv.monthBucket) ?? { totalProfitAlf: 0, ordersCount: 0 };
    m.totalProfitAlf += inv.orderProfitAlf;
    m.ordersCount += 1;
    monthlyMap.set(inv.monthBucket, m);
  }

  const dailyRows = Array.from(dailyMap.entries())
    .map(([bucket, v]) => {
      const start = startOfDayAtSix(bucket);
      const end = new Date(start.getTime() + DAY_MS);
      return {
        bucket,
        totalProfitAlf: v.totalProfitAlf,
        ordersCount: v.ordersCount,
        label: `${start.toLocaleDateString("ar-IQ-u-nu-latn")} 06:00 → ${end.toLocaleDateString(
          "ar-IQ-u-nu-latn",
        )} 05:59`,
      };
    })
    .sort((a, b) => (a.bucket < b.bucket ? 1 : -1));

  const monthlyRows = Array.from(monthlyMap.entries())
    .map(([bucket, v]) => ({ bucket, totalProfitAlf: v.totalProfitAlf, ordersCount: v.ordersCount }))
    .sort((a, b) => (a.bucket < b.bucket ? 1 : -1));

  const invoicesByDay = new Map<string, InvoiceRow[]>();
  for (const inv of invoices) {
    const arr = invoicesByDay.get(inv.dayBucket) ?? [];
    arr.push(inv);
    invoicesByDay.set(inv.dayBucket, arr);
  }
  const dayKeys = Array.from(invoicesByDay.keys()).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-5" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/reports" className={ad.link}>
          ← التقارير
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>تقرير التجهيز</h1>
        <p className={`mt-1 ${ad.lead}`}>
          يعرض الطلبيات المكتملة للتجهيز فقط: رقم/اسم المنطقة، تفاصيل البيع والشراء لكل فاتورة، ربح كل منتج، وربح
          الطلب الكلي. تجميع اليوم يعمل من 06:00 صباحا إلى 05:59 من اليوم التالي، والتجميع الشهري يبدأ من يوم 1.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={ad.label}>من</span>
          <input type="date" name="from" defaultValue={fromInput} className={ad.input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ad.label}>إلى</span>
          <input type="date" name="to" defaultValue={toInput} className={ad.input} />
        </label>
        <button type="submit" className={ad.btnPrimary}>
          تطبيق
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-800">إجمالي ربح التجهيز (ضمن المدة)</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{fmtAlf(totalProfitAlf)} ألف</p>
          <p className="mt-1 text-xs text-slate-600">اضغط جدول الأرباح اليومية أدناه لمراجعة نسخة كل يوم.</p>
        </div>
        <div className="rounded-xl border border-sky-300 bg-sky-50 p-4">
          <p className="text-xs text-sky-800">عدد الفواتير المكتملة</p>
          <p className="mt-1 text-2xl font-black text-sky-950">{invoices.length}</p>
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs text-amber-800">عدد الأيام المسجلة</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{dailyRows.length}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-extrabold text-slate-900">الأرباح اليومية (نسخة محفوظة لكل يوم)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead className="bg-slate-100 text-slate-800">
              <tr>
                <th className="px-3 py-2 text-start font-bold">اليوم التشغيلي</th>
                <th className="px-3 py-2 text-start font-bold">عدد الفواتير</th>
                <th className="px-3 py-2 text-start font-bold">ربح اليوم (ألف)</th>
                <th className="px-3 py-2 text-start font-bold">عرض الفواتير</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((d) => (
                <tr key={d.bucket} className="border-t border-slate-100">
                  <td className="px-3 py-2">{d.label}</td>
                  <td className="px-3 py-2 font-mono">{d.ordersCount}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-800">{fmtAlf(d.totalProfitAlf)}</td>
                  <td className="px-3 py-2">
                    <a href={`#day-${d.bucket}`} className="font-bold text-sky-700 hover:underline">
                      فتح تفاصيل هذا اليوم
                    </a>
                  </td>
                </tr>
              ))}
              {dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center text-slate-500">
                    لا توجد بيانات ضمن المدة المحددة.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-extrabold text-slate-900">الأرباح الشهرية (تصفير كل 1 بالشهر)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="bg-slate-100 text-slate-800">
              <tr>
                <th className="px-3 py-2 text-start font-bold">الشهر</th>
                <th className="px-3 py-2 text-start font-bold">عدد الفواتير</th>
                <th className="px-3 py-2 text-start font-bold">ربح الشهر (ألف)</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((m) => (
                <tr key={m.bucket} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono">{m.bucket}</td>
                  <td className="px-3 py-2 font-mono">{m.ordersCount}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-800">{fmtAlf(m.totalProfitAlf)}</td>
                </tr>
              ))}
              {monthlyRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-5 text-center text-slate-500">
                    لا توجد بيانات شهرية ضمن المدة المحددة.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900">الفواتير مقسمة على الأيام</h2>
        {dayKeys.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
            لا توجد فواتير تجهيز مكتملة ضمن المدة.
          </div>
        ) : null}

        {dayKeys.map((dayKey) => {
          const dayInvoices = (invoicesByDay.get(dayKey) ?? []).sort((a, b) =>
            a.createdAt < b.createdAt ? 1 : -1,
          );
          const dayProfit = dayInvoices.reduce((s, i) => s + i.orderProfitAlf, 0);
          const dayStart = startOfDayAtSix(dayKey);
          const dayEnd = new Date(dayStart.getTime() + DAY_MS);
          return (
            <section
              key={dayKey}
              id={`day-${dayKey}`}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  يوم {dayStart.toLocaleDateString("ar-IQ-u-nu-latn")} 06:00 →{" "}
                  {dayEnd.toLocaleDateString("ar-IQ-u-nu-latn")} 05:59
                </h3>
                <p className="text-sm font-bold text-emerald-800">
                  ربح اليوم: <span className="font-mono">{fmtAlf(dayProfit)} ألف</span>
                </p>
              </div>

              {dayInvoices.map((inv) => (
                <article key={inv.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                  <div className="mb-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <p className="text-sm">
                      <strong>الفاتورة:</strong> <span className="font-mono">#{inv.orderNumber}</span>
                    </p>
                    <p className="text-sm">
                      <strong>المنطقة:</strong> {inv.regionName} ({inv.regionCode})
                    </p>
                    <p className="text-sm">
                      <strong>المجهز:</strong> {inv.preparerName}
                    </p>
                    <p className="text-sm text-slate-600">
                      {inv.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full min-w-[36rem] text-sm">
                      <thead className="bg-slate-100 text-slate-800">
                        <tr>
                          <th className="px-3 py-2 text-start font-bold">المنتج</th>
                          <th className="px-3 py-2 text-start font-bold">شراء (ألف)</th>
                          <th className="px-3 py-2 text-start font-bold">بيع (ألف)</th>
                          <th className="px-3 py-2 text-start font-bold">ربح المنتج (ألف)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.products.map((p, idx) => (
                          <tr key={`${inv.id}-p-${idx}`} className="border-t border-slate-100">
                            <td className="px-3 py-2">{p.line}</td>
                            <td className="px-3 py-2 font-mono">{fmtAlf(p.buyAlf)}</td>
                            <td className="px-3 py-2 font-mono">{fmtAlf(p.sellAlf)}</td>
                            <td className="px-3 py-2 font-mono font-bold text-emerald-800">{fmtAlf(p.profitAlf)}</td>
                          </tr>
                        ))}
                        {inv.products.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                              لا توجد تفاصيل منتجات في JSON لهذه الفاتورة.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    <p className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                      <strong>إجمالي الشراء:</strong> <span className="font-mono">{fmtAlf(inv.sumBuyAlf)}</span>
                    </p>
                    <p className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                      <strong>إجمالي البيع:</strong> <span className="font-mono">{fmtAlf(inv.sumSellAlf)}</span>
                    </p>
                    <p className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                      <strong>أجور التجهيز:</strong> <span className="font-mono">{fmtAlf(inv.extraAlf)}</span>
                    </p>
                    <p className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                      <strong>توصيل:</strong> <span className="font-mono">{fmtAlf(inv.deliveryAlf)}</span>
                    </p>
                    <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm">
                      <strong>ربح الطلب الكلي:</strong> <span className="font-mono">{fmtAlf(inv.orderProfitAlf)}</span>
                    </p>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
