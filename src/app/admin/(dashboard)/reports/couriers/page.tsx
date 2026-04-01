import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { getCourierReportSummary } from "@/lib/courier-report-aggregate";
import { buildDelegatePortalUrl } from "@/lib/delegate-link";
import { formatYMDLocal, parseDateRangeFromSearchParams } from "@/lib/report-dates";
import { buildCourierShareMessage } from "@/lib/whatsapp";
import { ReportsFilterForm } from "../_components/reports-filter-form";
import { CouriersReportRowMenu } from "./couriers-report-row-menu";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير المندوبين — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function CouriersReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp, {
    defaults: "month",
  });

  const summary = await getCourierReportSummary(from, to);
  const rangeLabel = `${formatYMDLocal(from)} — ${formatYMDLocal(to)}`;
  const baseUrl = getPublicAppUrl();

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
        <h1 className={ad.h1}>تقرير المندوبين</h1>
        <p className={`mt-1 ${ad.lead}`}>
          اختر <strong className="text-sky-900">من يوم</strong> إلى{" "}
          <strong className="text-sky-900">إلى يوم</strong> لعرض ملخص لكل مندوب نشط (غير مخفٍ وغير
          محظور). الأرقام بالألف؛ الوارد والصادر من حركات المندوب المسجّلة في النطاق الزمني.
        </p>
      </div>

      <ReportsFilterForm
        fromInput={fromInput}
        toInput={toInput}
        fromLabel="من يوم"
        toLabel="إلى يوم"
      />

      <p className={`text-sm ${ad.muted}`}>
        النطاق: <strong className="text-slate-800">{rangeLabel}</strong>
        {" — "}
        عدد المندوبين في القائمة:{" "}
        <strong className="text-slate-800">{summary.length}</strong>
      </p>

      <div className="overflow-x-auto rounded-xl border border-sky-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[56rem] border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="border-b border-sky-200 bg-sky-50/90 text-sky-950">
              <th className="px-3 py-3 text-right font-bold">اسم المندوب</th>
              <th className="px-3 py-3 text-center font-bold text-red-900">وارد</th>
              <th className="px-3 py-3 text-center font-bold text-emerald-900">صادر</th>
              <th className="px-3 py-3 text-center font-bold">عدد الطلبات</th>
              <th className="px-3 py-3 text-center font-bold">التوصيل</th>
              <th className="px-3 py-3 text-center font-bold">ربح التوصيل</th>
              <th className="px-3 py-3 text-center font-bold">خيارات</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  لا يوجد مندوبون مؤهّلون للعرض (أضف مندوبين أو ألغِ الإخفاء/الحظر من صفحة
                  المندوب).
                </td>
              </tr>
            ) : (
              summary.map((row) => {
                const delegatePortalUrl = buildDelegatePortalUrl(row.courierId, baseUrl);
                return (
                  <tr
                    key={row.courierId}
                    className="border-b border-sky-100 transition hover:bg-sky-50/50"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-slate-900">{row.name}</span>
                      <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                        {row.phone}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-red-900">
                      {row.incomingAlf}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-emerald-900">
                      {row.outgoingAlf}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold tabular-nums text-sky-900">
                      {row.ordersCount}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-900">
                      {row.deliveryFeesAlf}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-emerald-900">
                      {row.earningAlf}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <CouriersReportRowMenu
                        courierId={row.courierId}
                        courierName={row.name}
                        courierPhone={row.phone}
                        delegatePortalUrl={delegatePortalUrl}
                        shareMessage={buildCourierShareMessage({
                          courierName: row.name,
                          delegatePortalUrl,
                        })}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className={`text-xs ${ad.muted}`}>
        <strong>وارد</strong>: مبالغ «من الزبون» المسجّلة في النطاق. <strong>صادر</strong>: «للعميل»
        في النطاق. <strong>عدد الطلبات</strong>: طلبات أُنشئت للمندوب ضمن التواريخ.{" "}
        <strong>التوصيل</strong>: جمع كلفة التوصيل لتلك الطلبات. <strong>ربح التوصيل</strong>: مجموع
        أجر المندوب للطلبات المُسلَّمة ضمن النطاق. لإخفاء مندوب عن <strong>قوائم الإسناد</strong> أو
        لحظره عن لوحة المندوب، اختر «خيارات» ثم «تعديل المندوب».
      </p>
    </div>
  );
}
