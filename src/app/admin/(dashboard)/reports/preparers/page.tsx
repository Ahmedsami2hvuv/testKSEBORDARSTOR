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
  title: "طلبات موظفي المحل — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string; employeeId?: string }>;
};

export default async function PreparersReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);
  const employeeId = (sp.employeeId ?? "").trim();

  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: from, lte: to },
    submittedByEmployeeId: { not: null },
  };
  if (employeeId) {
    where.submittedByEmployeeId = employeeId;
  }

  const [orders, employees, couriers] = await Promise.all([
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
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, shop: { select: { name: true } } },
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
        <Link href="/admin/shops" className={ad.link}>
          المحلات — موظفو المحل
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>طلبات موظفي المحل</h1>
        <p className={`mt-1 ${ad.lead}`}>
          الطلبات التي رفعها موظف محل عبر رابط إدخال الطلب — ليس تقرير «المجهزين» (فريق الإدارة). يمكن تصفية
          النتائج بموظف محدد.
        </p>
      </div>

      <ReportsFilterForm fromInput={fromInput} toInput={toInput}>
        <label className="flex min-w-[12rem] flex-col gap-1">
          <span className={ad.label}>موظف المحل</span>
          <select
            name="employeeId"
            defaultValue={employeeId}
            className={ad.select}
          >
            <option value="">كل موظفي المحل</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.shop.name}
              </option>
            ))}
          </select>
        </label>
      </ReportsFilterForm>

      <ReportSectionIntro>
        عدد السجلات: <strong className="text-slate-800">{rows.length}</strong>
        {employeeId ? (
          <>
            {" — "}
            الموظف:{" "}
            <strong className="text-slate-800">
              {employees.find((e) => e.id === employeeId)?.name ?? employeeId}
            </strong>
          </>
        ) : null}
      </ReportSectionIntro>

      <ReportsTable rows={rows} couriers={couriers} />
    </div>
  );
}
