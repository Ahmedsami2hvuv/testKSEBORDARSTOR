import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import type { Prisma } from "@prisma/client";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";
import { orderToReportRow } from "@/lib/report-order-map";
import { ReportsFilterForm } from "../_components/reports-filter-form";
import { ReportSectionIntro, ReportsTable } from "../_components/reports-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير المحلات — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string; shopId?: string }>;
};

export default async function ShopsReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);
  const shopId = (sp.shopId ?? "").trim();

  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: from, lte: to },
  };
  if (shopId) {
    where.shopId = shopId;
  }

  const [orders, shops, couriers] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        shop: true,
        courier: true,
        submittedBy: true,
        customer: { select: { customerLocationUrl: true } },
      },
    }),
    prisma.shop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.courier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = orders.map(orderToReportRow);

  return (
    <div className="space-y-4" dir="rtl">
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
        <h1 className={ad.h1}>تقرير المحلات</h1>
        <p className={`mt-1 ${ad.lead}`}>
          طلبات حسب المحل مع إمكانية عرض محل واحد لمراجعة الصادر والوارد الزمني.
        </p>
      </div>

      <ReportsFilterForm fromInput={fromInput} toInput={toInput}>
        <label className="flex min-w-[12rem] flex-col gap-1">
          <span className={ad.label}>المحل</span>
          <select name="shopId" defaultValue={shopId} className={ad.select}>
            <option value="">كل المحلات</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </ReportsFilterForm>

      <ReportSectionIntro>
        عدد السجلات: <strong className="text-slate-800">{rows.length}</strong>
        {shopId ? (
          <>
            {" — "}
            المحل:{" "}
            <strong className="text-slate-800">
              {shops.find((s) => s.id === shopId)?.name ?? shopId}
            </strong>
          </>
        ) : null}
      </ReportSectionIntro>

      <ReportsTable rows={rows} couriers={couriers} />
    </div>
  );
}
