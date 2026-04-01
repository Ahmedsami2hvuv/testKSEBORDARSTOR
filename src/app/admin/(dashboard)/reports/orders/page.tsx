import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";
import { orderToReportRow } from "@/lib/report-order-map";
import { ReportsFilterForm } from "../_components/reports-filter-form";
import { ReportSectionIntro, ReportsTable } from "../_components/reports-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير الطلبات — أبو الأكبر للتوصيل",
};

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function OrdersDateRangeReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);

  const [orders, couriers] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: "desc" },
      include: {
        shop: true,
        courier: true,
        submittedBy: true,
        customer: { select: { customerLocationUrl: true } },
      },
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
        <h1 className={ad.h1}>تقرير الطلبات (نطاق زمني)</h1>
        <p className={`mt-1 ${ad.lead}`}>
          جميع الطلبات المسجّلة بين التاريخين (افتراضياً آخر 30 يوماً). نوع المعاملة يجمع{" "}
          <strong className="text-sky-800">حالة الطلب</strong> ونوع الطلب إن وُجد.
        </p>
      </div>

      <ReportsFilterForm fromInput={fromInput} toInput={toInput} />

      <ReportSectionIntro>
        عدد السجلات: <strong className="text-slate-800">{rows.length}</strong>
        {" — "}
        النطاق:{" "}
        <span className="tabular-nums" dir="ltr">
          {fromInput}
        </span>{" "}
        →{" "}
        <span className="tabular-nums" dir="ltr">
          {toInput}
        </span>
      </ReportSectionIntro>

      <ReportsTable rows={rows} couriers={couriers} />

      <p className={`text-sm ${ad.muted}`}>
        لتقرير <strong>معاملات المحافظ</strong> (نقد الطلبات، أخذت/أعطيت، تحويلات) استخدم{" "}
        <Link href="/admin/reports/general" className={ad.link}>
          التقرير العام
        </Link>
        .
      </p>
    </div>
  );
}
