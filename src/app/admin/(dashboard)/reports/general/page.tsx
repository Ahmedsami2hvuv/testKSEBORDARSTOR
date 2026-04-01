import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";
import {
  loadWalletTransactionReport,
  parsePartyFilterFromSearchParams,
} from "@/lib/wallet-transactions-report";
import { WalletTransactionsFilterForm } from "../_components/wallet-transactions-filter-form";
import { WalletTransactionsTable } from "../_components/wallet-transactions-table";
import { ReportSectionIntro } from "../_components/reports-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير عام — معاملات المحافظ — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string; party?: string }>;
};

export default async function GeneralWalletReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);
  const partyFilter = parsePartyFilterFromSearchParams(sp);

  const [rows, couriers, employeesRaw, preparers] = await Promise.all([
    loadWalletTransactionReport(from, to, partyFilter),
    prisma.courier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      where: {
        walletForCompanyPreparer: { is: null },
      },
      select: {
        id: true,
        name: true,
        shop: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.companyPreparer.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const employees = employeesRaw.map((e) => ({
    id: e.id,
    name: e.name,
    shopName: e.shop.name,
  }));

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/reports" className={ad.navButton}>
          ← التقارير
        </Link>
        <Link href="/admin" className={ad.navButton}>
          الرئيسية
        </Link>
      </div>
      <div>
        <h1 className={ad.h1}>تقرير عام — معاملات المحافظ</h1>
        <p className={`mt-1 ${ad.lead}`}>
          سجل معاملات النقد: نقد الطلبات (استلام/تسليم)، أخذت/أعطيت للمندوبين وموظفي المحلات والمجهزين، وتحويلات
          المحفظة. يمكنك تصفية حسب <strong className="text-sky-800">التاريخ</strong> و
          <strong className="text-sky-800"> صاحب المعاملة</strong> (مندوب، موظف محل، مجهز شركة، أو الكل).
        </p>
      </div>

      <WalletTransactionsFilterForm
        fromInput={fromInput}
        toInput={toInput}
        partyFilter={partyFilter}
        couriers={couriers}
        employees={employees}
        preparers={preparers}
      />

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

      <WalletTransactionsTable rows={rows} />

      <p className={`text-sm ${ad.muted}`}>
        لعرض <strong>طلبات</strong> فقط في نطاق زمني (جدول الطلبات السابق) استخدم{" "}
        <Link href="/admin/reports/orders" className={ad.link}>
          تقرير الطلبات
        </Link>
        . لمسح بيانات المحافظ من قاعدة البيانات بالكامل عند الحاجة، راجع{" "}
        <Link href="/admin/reports/wallet-ledger" className={ad.link}>
          مستودع معاملات المحافظ
        </Link>
        .
      </p>
    </div>
  );
}
