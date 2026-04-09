import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";
import { Prisma } from "@prisma/client";
import { MEAT_KEYWORDS, FISH_KEYWORDS } from "@/lib/auto-pricing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير التجهيز واللحوم — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string; type?: "all" | "meat" | "fish" }>;
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
  isMeat: boolean;
  isFish: boolean;
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

function isMeat(line: string) {
    return MEAT_KEYWORDS.some(k => line.toLowerCase().includes(k.toLowerCase()));
}
function isFish(line: string) {
    return FISH_KEYWORDS.some(k => line.toLowerCase().includes(k.toLowerCase()));
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
      isMeat: isMeat(line),
      isFish: isFish(line),
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
  const filterType = sp.type || "all";

  const rawOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: "delivered",
      orderType: "تجهيز تسوق",
      preparerShoppingJson: { not: Prisma.AnyNull },
    },
    orderBy: { createdAt: "desc" },
    include: {
      customerRegion: { select: { id: true, name: true } },
      submittedByCompanyPreparer: { select: { name: true } },
    },
  });

  let invoices: InvoiceRow[] = rawOrders.map((o) => {
    const j = (o.preparerShoppingJson ?? null) as ShoppingJson | null;
    let products = parseProducts(j?.products);

    // تطبيق الفلترة حسب النوع
    if (filterType === "meat") products = products.filter(p => p.isMeat);
    if (filterType === "fish") products = products.filter(p => p.isFish);

    if (products.length === 0 && filterType !== "all") return null as any;

    const sumSellAlf = products.reduce((s, p) => s + p.sellAlf, 0);
    const sumBuyAlf = products.reduce((s, p) => s + p.buyAlf, 0);
    const extraAlf = filterType === "all" ? numOrZero(j?.extraAlf) : 0;
    const deliveryAlf = filterType === "all" ? numOrZero(j?.deliveryAlf) : 0;
    const orderProfitAlf = sumSellAlf - sumBuyAlf + extraAlf;

    const regionCode = String(o.customerRegion?.id ?? j?.regionId ?? "").trim().toUpperCase() || "—";
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
  }).filter(Boolean);

  const totalBuyAlf = invoices.reduce((sum, x) => sum + x.sumBuyAlf, 0);
  const totalProfitAlf = invoices.reduce((sum, x) => sum + x.orderProfitAlf, 0);

  const dailyMap = new Map<string, { totalBuyAlf: number; totalProfitAlf: number; ordersCount: number }>();
  const monthlyMap = new Map<string, { totalBuyAlf: number; totalProfitAlf: number; ordersCount: number }>();

  for (const inv of invoices) {
    const d = dailyMap.get(inv.dayBucket) ?? { totalBuyAlf: 0, totalProfitAlf: 0, ordersCount: 0 };
    d.totalBuyAlf += inv.sumBuyAlf;
    d.totalProfitAlf += inv.orderProfitAlf;
    d.ordersCount += 1;
    dailyMap.set(inv.dayBucket, d);

    const m = monthlyMap.get(inv.monthBucket) ?? { totalBuyAlf: 0, totalProfitAlf: 0, ordersCount: 0 };
    m.totalBuyAlf += inv.sumBuyAlf;
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
        totalBuyAlf: v.totalBuyAlf,
        totalProfitAlf: v.totalProfitAlf,
        ordersCount: v.ordersCount,
        label: `${start.toLocaleDateString("ar-IQ-u-nu-latn")} 06:00 → ${end.toLocaleDateString("ar-IQ-u-nu-latn")} 05:59`,
      };
    })
    .sort((a, b) => (a.bucket < b.bucket ? 1 : -1));

  const monthlyRows = Array.from(monthlyMap.entries())
    .map(([bucket, v]) => ({ bucket, totalBuyAlf: v.totalBuyAlf, totalProfitAlf: v.totalProfitAlf, ordersCount: v.ordersCount }))
    .sort((a, b) => (a.bucket < b.bucket ? 1 : -1));

  const invoicesByDay = new Map<string, InvoiceRow[]>();
  for (const inv of invoices) {
    const arr = invoicesByDay.get(inv.dayBucket) ?? [];
    arr.push(inv);
    invoicesByDay.set(inv.dayBucket, arr);
  }
  const dayKeys = Array.from(invoicesByDay.keys()).sort((a, b) => (a < b ? 1 : -1));

  const reportTitle = filterType === "meat" ? "تقرير اللحوم" : filterType === "fish" ? "تقرير الأسماك" : "تقرير التجهيز العام";

  return (
    <div className="space-y-5" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/reports" className={ad.link}>
          ← التقارير
        </Link>
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
            <h1 className={ad.h1}>{reportTitle}</h1>
            <p className={`mt-1 ${ad.lead}`}>
            تفاصيل المشتريات والمبيعات والأرباح (يومي/أسبوعي/شهري).
            </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <Link href={`?from=${fromInput}&to=${toInput}&type=all`} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filterType === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>الكل</Link>
            <Link href={`?from=${fromInput}&to=${toInput}&type=meat`} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filterType === 'meat' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>اللحوم 🥩</Link>
            <Link href={`?from=${fromInput}&to=${toInput}&type=fish`} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filterType === 'fish' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>الأسماك 🐟</Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <input type="hidden" name="type" value={filterType} />
        <label className="flex flex-col gap-1">
          <span className={ad.label}>من تاريخ</span>
          <input type="date" name="from" defaultValue={fromInput} className={ad.input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ad.label}>إلى تاريخ</span>
          <input type="date" name="to" defaultValue={toInput} className={ad.input} />
        </label>
        <button type="submit" className={ad.btnPrimary}>تحديث التقرير</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs text-rose-800 font-bold">إجمالي المشتريات (شراء)</p>
          <p className="mt-1 text-2xl font-black text-rose-950">{fmtAlf(totalBuyAlf)} ألف</p>
          <p className="mt-1 text-[10px] text-rose-700 font-bold">هذا المبلغ الذي يُدفع للمحلات</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs text-emerald-800 font-bold">إجمالي صافي الربح</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{fmtAlf(totalProfitAlf)} ألف</p>
          <p className="mt-1 text-[10px] text-emerald-700 font-bold">الفرق بين البيع والشراء</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-xs text-sky-800 font-bold">عدد الطلبيات</p>
          <p className="mt-1 text-2xl font-black text-sky-950">{invoices.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs text-amber-800 font-bold">عدد الأيام التشغيلية</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{dailyRows.length}</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            📊 ملخص الأرباح اليومية
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-start font-bold">اليوم التشغيلي</th>
                <th className="px-4 py-3 text-start font-bold">عدد الطلبات</th>
                <th className="px-4 py-3 text-start font-bold text-rose-700">المشتريات (ألف)</th>
                <th className="px-4 py-3 text-start font-bold text-emerald-700">صافي الربح (ألف)</th>
                <th className="px-4 py-3 text-start font-bold">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyRows.map((d) => (
                <tr key={d.bucket} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold">{d.label}</td>
                  <td className="px-4 py-3 font-mono">{d.ordersCount}</td>
                  <td className="px-4 py-3 font-mono font-bold text-rose-700">{fmtAlf(d.totalBuyAlf)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-800">{fmtAlf(d.totalProfitAlf)}</td>
                  <td className="px-4 py-3">
                    <a href={`#day-${d.bucket}`} className="text-xs font-black bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100">استعراض الفواتير</a>
                  </td>
                </tr>
              ))}
              {dailyRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 font-bold">لا توجد بيانات لهذه الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-black text-slate-900 border-r-4 border-indigo-600 pr-3">سجل الفواتير التفصيلي</h2>
        {dayKeys.map((dayKey) => {
          const dayInvoices = (invoicesByDay.get(dayKey) ?? []).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
          const dayProfit = dayInvoices.reduce((s, i) => s + i.orderProfitAlf, 0);
          const dayBuy = dayInvoices.reduce((s, i) => s + i.sumBuyAlf, 0);
          const dayStart = startOfDayAtSix(dayKey);
          return (
            <section key={dayKey} id={`day-${dayKey}`} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 text-white p-4 rounded-2xl shadow-md">
                <h3 className="text-base font-black">يوم: {dayStart.toLocaleDateString("ar-IQ-u-nu-latn")}</h3>
                <div className="flex gap-4 text-xs">
                    <p>مشتريات: <span className="font-mono text-rose-300 font-bold">{fmtAlf(dayBuy)} ألف</span></p>
                    <p>أرباح: <span className="font-mono text-emerald-300 font-bold">{fmtAlf(dayProfit)} ألف</span></p>
                    <p>فواتير: <span className="font-mono">{dayInvoices.length}</span></p>
                </div>
              </div>

              <div className="grid gap-4">
                {dayInvoices.map((inv) => (
                  <article key={inv.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-indigo-300 transition-colors">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                            <span className="bg-indigo-600 text-white px-2 py-1 rounded-lg text-[10px] font-black">#{inv.orderNumber}</span>
                            <span className="text-sm font-bold text-slate-700">{inv.regionName}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{inv.createdAt.toLocaleTimeString("ar-IQ-u-nu-latn", { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/50 text-slate-500 text-[10px] uppercase">
                        <tr>
                          <th className="px-4 py-2 text-start">المادة</th>
                          <th className="px-4 py-2 text-start">شراء</th>
                          <th className="px-4 py-2 text-start">بيع</th>
                          <th className="px-4 py-2 text-start text-emerald-700">الربح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {inv.products.map((p, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-bold text-slate-700">{p.line}</td>
                            <td className="px-4 py-2 font-mono text-rose-600">{fmtAlf(p.buyAlf)}</td>
                            <td className="px-4 py-2 font-mono text-slate-600">{fmtAlf(p.sellAlf)}</td>
                            <td className="px-4 py-2 font-mono font-black text-emerald-600">+{fmtAlf(p.profitAlf)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="p-3 bg-indigo-50/30 flex justify-end gap-6 border-t border-slate-100">
                        <div className="text-center">
                            <p className="text-[9px] text-rose-600 font-bold uppercase">إجمالي الشراء</p>
                            <p className="text-sm font-black text-rose-900">{fmtAlf(inv.sumBuyAlf)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] text-emerald-600 font-bold uppercase">صافي الربح</p>
                            <p className="text-sm font-black text-emerald-900">{fmtAlf(inv.orderProfitAlf)}</p>
                        </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
