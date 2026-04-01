import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";
import {
  filterWalletTxnRowsByQuery,
  loadWalletTransactionReport,
  parsePartyFilterFromSearchParams,
  partyFilterToQueryParam,
} from "@/lib/wallet-transactions-report";
import { WalletTransactionsFilterForm } from "../_components/wallet-transactions-filter-form";
import { ReportSectionIntro } from "../_components/reports-table";
import { WalletLedgerPurgeForm } from "./purge-form";
import { WalletLedgerInteractiveTable } from "./wallet-ledger-interactive-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "مستودع معاملات المحافظ — التقارير — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string; party?: string; q?: string }>;
};

export default async function WalletLedgerReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);
  const partyFilter = parsePartyFilterFromSearchParams(sp);
  const q = (sp.q ?? "").trim();

  const [rawRows, couriers, employeesRaw, preparers] = await Promise.all([
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

  const rows = filterWalletTxnRowsByQuery(rawRows, q);

  const returnParams = new URLSearchParams();
  if (fromInput) returnParams.set("from", fromInput);
  if (toInput) returnParams.set("to", toInput);
  const partyQ = partyFilterToQueryParam(partyFilter);
  if (partyQ) returnParams.set("party", partyQ);
  if (q) returnParams.set("q", q);
  const returnUrl = `/admin/reports/wallet-ledger?${returnParams.toString()}`;

  const serializedRows = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    category: r.category,
    summary: r.summary,
    ownerLabel: r.ownerLabel,
    signedAmountDinar: r.signedAmountDinar?.toString() ?? null,
    absoluteAmountDinar: r.absoluteAmountDinar.toString(),
    orderId: r.orderId ?? null,
  }));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin/reports" className={ad.navButton}>
          ← التقارير
        </Link>
        <Link href="/admin" className={ad.navButton}>
          الرئيسية
        </Link>
      </div>
      <div>
        <h1 className={ad.h1}>مستودع معاملات المحافظ</h1>
        <p className={`mt-1 ${ad.lead}`}>
          اختر <strong className="text-sky-800">من تاريخ</strong> و<strong className="text-sky-800">إلى تاريخ</strong> واضغط
          «تطبيق» لعرض المعاملات (نقد الطلبات، أخذت/أعطيت، تحويلات). صفِّ حسب{" "}
          <strong className="text-sky-800">صاحب المعاملة</strong>، واستخدم{" "}
          <strong className="text-sky-800">بحث في النتائج</strong> لتصفية بالاسم أو النوع أو المبلغ أو رقم الطلب
          أو أي نص يظهر في الجدول.
        </p>
      </div>

      <WalletTransactionsFilterForm
        fromInput={fromInput}
        toInput={toInput}
        partyFilter={partyFilter}
        couriers={couriers}
        employees={employees}
        preparers={preparers}
        searchQuery={q}
        showSearch
      />

      <ReportSectionIntro>
        عدد السجلات بعد البحث: <strong className="text-slate-800">{rows.length}</strong>
        {q ? (
          <>
            {" "}
            (من أصل <strong className="tabular-nums">{rawRows.length}</strong> في النطاق)
          </>
        ) : null}
        {" — "}
        من{" "}
        <span className="tabular-nums" dir="ltr">
          {fromInput}
        </span>{" "}
        إلى{" "}
        <span className="tabular-nums" dir="ltr">
          {toInput}
        </span>
      </ReportSectionIntro>

      <WalletLedgerInteractiveTable rows={serializedRows} returnUrl={returnUrl} />

      <p className={`text-sm ${ad.muted}`}>
        لعرض <strong>طلبات</strong> فقط في نطاق زمني استخدم{" "}
        <Link href="/admin/reports/orders" className={ad.link}>
          تقرير الطلبات
        </Link>
        . لنفس منطق المعاملات مع عنوان «تقرير عام» راجع{" "}
        <Link href="/admin/reports/general" className={ad.link}>
          التقرير العام
        </Link>
        .
      </p>

      <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ${ad.section}`}>
        <h2 className="text-base font-bold text-slate-900">منطقة خطرة — مسح السجل بالكامل</h2>
        <p className="mt-1 text-sm text-slate-600">
          إذا احتجت إفراغ كل حركات المحافظ من قاعدة البيانات (بعد مراجعة النطاق أعلاه)، استخدم النموذج التالي.
        </p>
      </div>

      <WalletLedgerPurgeForm />
    </div>
  );
}
