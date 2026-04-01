import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { REPORT_STATUS_AR } from "@/lib/report-order-map";
import type { ReportTableRow } from "@/lib/report-types";
import { ReportsFilterForm } from "../reports/_components/reports-filter-form";
import { ReportSectionIntro, ReportsTable } from "../reports/_components/reports-table";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ from?: string; to?: string; preparerId?: string; status?: string }>;
};

function orderTransactionTypeLabel(status: string, orderType: string | null | undefined): string {
  const st = REPORT_STATUS_AR[status] ?? status;
  const ot = orderType?.trim();
  return ot ? `${st} — ${ot}` : st;
}

function orderToPreparationRow(o: {
  id: string;
  orderNumber: number;
  status: string;
  orderType: string;
  totalAmount: unknown;
  createdAt: Date;
  shop: { name: string };
  courier: { name: string } | null;
  submittedByCompanyPreparer: { name: string } | null;
  customer: { customerLocationUrl: string | null } | null;
  customerLocationUrl: string;
}): ReportTableRow {
  return {
    orderId: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    shopName: o.shop.name,
    preparerName: o.submittedByCompanyPreparer?.name?.trim() || "—",
    courierName: o.courier?.name?.trim() || "—",
    transactionType: orderTransactionTypeLabel(o.status, o.orderType),
    amount: o.totalAmount != null ? formatDinarAsAlf(o.totalAmount) : "—",
    dateLabel: o.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    missingCustomerLocation: !hasCustomerLocationUrl(o.customerLocationUrl, o.customer?.customerLocationUrl),
  };
}

export default async function PreparationOrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);
  const preparerId = (sp.preparerId ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();

  const statusWhere =
    statusFilter === "pending" ||
    statusFilter === "assigned" ||
    statusFilter === "delivering" ||
    statusFilter === "delivered"
      ? { status: statusFilter }
      : {};

  const [orders, companyPreparers, couriers] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        submittedByCompanyPreparerId: { not: null },
        ...(preparerId ? { submittedByCompanyPreparerId: preparerId } : {}),
        ...statusWhere,
      },
      orderBy: { createdAt: "desc" },
      include: {
        shop: { select: { name: true } },
        courier: { select: { name: true } },
        submittedByCompanyPreparer: { select: { name: true } },
        customer: { select: { customerLocationUrl: true } },
      },
    }),
    prisma.companyPreparer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.courier.findMany({
      where: courierAssignableWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: ReportTableRow[] = orders.map((o) =>
    orderToPreparationRow({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      orderType: o.orderType,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      shop: o.shop,
      courier: o.courier,
      submittedByCompanyPreparer: o.submittedByCompanyPreparer,
      customer: o.customer,
      customerLocationUrl: o.customerLocationUrl,
    }),
  );

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/reports" className={ad.link}>
          ← التقارير
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin/preparers" className={ad.link}>
          المجهزين
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>تجهيز الطلبات</h1>
        <p className={`mt-1 ${ad.lead}`}>الطلبات التي رُفعت عبر بوابة المجهّز — الفواتير تبقى هنا حتى بعد التصفير اليومي للمجهز.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/orders/new"
            className="inline-flex min-h-[40px] items-center rounded-xl border-2 border-violet-500 bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
          >
            إضافة طلبية
          </Link>
          <Link
            href="/admin/preparation-orders"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            كل الطلبات
          </Link>
          <Link
            href="/admin/preparation-orders?status=delivered"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
          >
            طلبات كاملة
          </Link>
          <Link
            href="/admin/preparation-orders?status=pending"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 hover:bg-sky-100"
          >
            طلبات جديدة
          </Link>
          <Link
            href="/admin/reports"
            className={`${ad.link} inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold`}
          >
            تقرير بيع وشراء
          </Link>
          <Link
            href="/admin/preparation-orders/profits"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-100"
          >
            أرباح
          </Link>
        </div>
      </div>

      <ReportsFilterForm fromInput={fromInput} toInput={toInput}>
        <label className="flex min-w-[12rem] flex-col gap-1">
          <span className={ad.label}>المجهز</span>
          <select name="preparerId" defaultValue={preparerId} className={ad.select}>
            <option value="">كل المجهزين</option>
            {companyPreparers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </ReportsFilterForm>

      <ReportSectionIntro>
        عدد السجلات: <strong className="text-slate-800">{rows.length}</strong>
        {preparerId ? (
          <>
            {" — "}
            المجهز:
            <strong className="text-slate-800">
              {companyPreparers.find((p) => p.id === preparerId)?.name ?? preparerId}
            </strong>
          </>
        ) : null}
      </ReportSectionIntro>

      <ReportsTable rows={rows} couriers={couriers} />
    </div>
  );
}

