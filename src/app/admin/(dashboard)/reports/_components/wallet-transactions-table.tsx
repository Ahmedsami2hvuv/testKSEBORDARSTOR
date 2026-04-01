import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import type { WalletTxnReportRow } from "@/lib/wallet-transactions-report";

function fmtWhen(d: Date): string {
  return d.toLocaleString("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WalletTransactionsTable({ rows }: { rows: WalletTxnReportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-sky-200 bg-white shadow-sm">
      <table className="min-w-[720px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-sky-200 bg-sky-50/90 text-sky-950">
            <th className="px-3 py-2 text-right font-bold">الوقت</th>
            <th className="px-3 py-2 text-right font-bold">النوع</th>
            <th className="px-3 py-2 text-right font-bold">صاحب المعاملة</th>
            <th className="px-3 py-2 text-right font-bold">التفاصيل</th>
            <th className="px-3 py-2 text-left font-bold" dir="ltr">
              المبلغ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                لا توجد معاملات في هذا النطاق أو للفلتر المختار.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const signed = r.signedAmountDinar;
              const amtClass =
                signed == null
                  ? "text-slate-700"
                  : signed.gt(0)
                    ? "text-emerald-800 font-bold"
                    : signed.lt(0)
                      ? "text-rose-800 font-bold"
                      : "text-slate-600";
              const amtText =
                signed == null
                  ? `${formatDinarAsAlfWithUnit(r.absoluteAmountDinar)} (تحويل)`
                  : `${signed.gt(0) ? "+" : ""}${formatDinarAsAlfWithUnit(signed)}`;
              return (
                <tr key={r.id} className="border-b border-slate-100/90 hover:bg-slate-50/80">
                  <td className="px-3 py-2 align-top whitespace-nowrap tabular-nums text-slate-700">
                    {fmtWhen(r.createdAt)}
                  </td>
                  <td className="px-3 py-2 align-top font-semibold text-slate-800">{r.category}</td>
                  <td className="px-3 py-2 align-top text-slate-700">{r.ownerLabel}</td>
                  <td className="px-3 py-2 align-top text-slate-600 leading-snug">{r.summary}</td>
                  <td className={`px-3 py-2 align-top text-left tabular-nums ${amtClass}`} dir="ltr">
                    {amtText}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <p className={`border-t border-sky-100 px-3 py-2 text-xs ${ad.muted}`}>
        المبالغ المخزّنة بالدينار الكامل؛ العرض بالألف. موجب = وارد للمحفظة المعروضة عند اختيار شخص، سالب = صادر.
        في وضع «الكل» تُعرض تحويلات المحفظة بدون اتجاه موحّد.
      </p>
    </div>
  );
}
