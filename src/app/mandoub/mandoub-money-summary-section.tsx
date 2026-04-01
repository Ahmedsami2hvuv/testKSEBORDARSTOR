import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export function MandoubMoneySummarySection({
  totalsBaseline,
  sumDeliveryInDinar,
  sumPickupOutDinar,
  remainingNetDinar,
  sumEarningsDinar,
  adminTotalDinar,
  courierVehicleType,
  hrefWalletLedger,
  hideTitle = false,
  hideResetText = false,
  showAdminBox = false,
}: {
  totalsBaseline: Date | null;
  sumDeliveryInDinar: number;
  sumPickupOutDinar: number;
  remainingNetDinar: number;
  sumEarningsDinar: number;
  adminTotalDinar?: number;
  courierVehicleType: string | null;
  hrefWalletLedger: (ledger: "ward" | "sader" | "all") => string;
  hideTitle?: boolean;
  hideResetText?: boolean;
  showAdminBox?: boolean;
}) {
  return (
    <section
      aria-label="ملخص الأموال"
      className="mb-2 rounded-xl border border-slate-200/90 bg-white/75 px-2 py-2 shadow-sm backdrop-blur-sm sm:px-3"
    >
      {!hideTitle ? (
        <h2 className="mb-1.5 px-0.5 text-[11px] font-bold text-slate-600 sm:text-xs">ملخص الأموال</h2>
      ) : null}
      {!hideResetText && totalsBaseline ? (
        <p className="mb-2 rounded-md border border-slate-200/80 bg-slate-50/90 px-1.5 py-1 text-[9px] font-medium leading-snug text-slate-600 sm:text-[10px]">
          منذ آخر <strong className="text-slate-800">تصفير</strong>:{" "}
          <span className="tabular-nums">
            {totalsBaseline.toLocaleString("ar-IQ-u-nu-latn", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </p>
      ) : null}
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:overflow-visible sm:pb-0">
        <Link
          href={hrefWalletLedger("ward")}
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-red-500 bg-red-50/95 px-1.5 py-1.5 text-center shadow-sm ring-red-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
          title="ما استلمته من الزبون عند تم التسليم — عرض معاملات الوارد"
        >
          <span className="text-[9px] font-bold leading-tight text-red-900 sm:text-[10px]">الوارد</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-red-800 sm:text-base">
            {formatDinarAsAlfWithUnit(sumDeliveryInDinar)}
          </span>
        </Link>
        <Link
          href={hrefWalletLedger("sader")}
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-emerald-600 bg-emerald-50/95 px-1.5 py-1.5 text-center shadow-sm ring-emerald-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
          title="ما سلّمته للعميل عند تم الاستلام — عرض معاملات الصادر"
        >
          <span className="text-[9px] font-bold leading-tight text-emerald-900 sm:text-[10px]">الصادر</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-emerald-800 sm:text-base">
            {formatDinarAsAlfWithUnit(sumPickupOutDinar)}
          </span>
        </Link>
        <Link
          href={hrefWalletLedger("all")}
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-blue-600 bg-blue-50/95 px-1.5 py-1.5 text-center shadow-sm ring-blue-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
          title="وارد − صادر — سجل كامل في المحفظة"
        >
          <span className="text-[9px] font-bold leading-tight text-blue-900 sm:text-[10px]">المتبقي</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-blue-800 sm:text-base">
            {formatDinarAsAlfWithUnit(remainingNetDinar)}
          </span>
        </Link>
        <div
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border border-amber-300 bg-amber-50/90 px-1.5 py-1.5 text-center shadow-sm sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
          title={
            courierVehicleType === "bike"
              ? "نصف التوصيل لكل طلب مُسلَّم"
              : "ثلثي كلفة التوصيل لكل طلب مُسلَّم"
          }
        >
          <span className="text-[9px] font-bold leading-tight text-amber-950 sm:text-[10px]">أرباحي</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-amber-900 sm:text-base">
            {formatDinarAsAlfWithUnit(sumEarningsDinar)}
          </span>
        </div>
        {showAdminBox && adminTotalDinar !== undefined ? (
          <div
            className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-violet-400 bg-violet-50/95 px-1.5 py-1.5 text-center shadow-sm sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
            title="إجمالي مستحقات الإدارة — لا يتأثر بالتصفير"
          >
            <span className="text-[9px] font-bold leading-tight text-violet-900 sm:text-[10px]">الإدارة</span>
            <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-violet-800 sm:text-base">
              {formatDinarAsAlfWithUnit(adminTotalDinar)}
            </span>
            <span className="mt-0.5 text-[7px] leading-tight text-violet-500 sm:text-[8px]">لا يتصفر</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
