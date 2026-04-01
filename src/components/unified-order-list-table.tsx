"use client";

import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { OrderTypeLine } from "@/components/order-type-line";

type Props = {
  rows: MandoubRow[];
  colCount: number;
  showSelectColumn: boolean;
  isRowSelectable: (row: MandoubRow) => boolean;
  isSelected: (id: string) => boolean;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onOpenRow: (id: string) => void;
  selectAllTitle: string;
  selectAllAriaLabel: string;
  selectedTitle: string;
  selectedAriaPrefix: string;
  showStatusDotInSelectCol: boolean;
  /**
   * مخصّص للعلامة داخل عمود رقم الطلب (#) بدل كرة الحالة الملونة.
   * إذا أرجعنا `null` يتم إخفاء الكرات تماماً في هذا السياق.
   */
  renderOrderIdBadge?: (row: MandoubRow) => React.ReactNode;
  renderSelectActions?: (row: MandoubRow) => React.ReactNode;
};

export function UnifiedOrderListTable({
  rows,
  colCount,
  showSelectColumn,
  isRowSelectable,
  isSelected,
  allSelected,
  onToggleAll,
  onToggleOne,
  onOpenRow,
  selectAllTitle,
  selectAllAriaLabel,
  selectedTitle,
  selectedAriaPrefix,
  showStatusDotInSelectCol,
  renderOrderIdBadge,
  renderSelectActions,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse text-base sm:text-lg ${showSelectColumn ? "min-w-[780px]" : "min-w-[720px]"}`}
      >
        <thead>
          <tr className="border-b border-sky-200 bg-sky-50 text-right">
            {showSelectColumn ? (
              <th className="sticky right-0 z-10 w-14 min-w-[3.25rem] max-w-[3.5rem] bg-sky-50 px-1 py-3.5 text-center font-bold text-sky-900 shadow-[-4px_0_8px_-2px_rgba(15,23,42,0.1)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="mx-auto h-5 w-5 rounded border-sky-400 text-sky-600 accent-sky-600"
                  title={selectAllTitle}
                  aria-label={selectAllAriaLabel}
                />
              </th>
            ) : null}
            <th className="px-2 py-3.5 font-bold text-sky-900">#</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">اسم المحل</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">المنطقة</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">نوع</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">السعر</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">التوصيل</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">الهاتف</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">وقت</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-10 text-center text-base text-slate-500 sm:text-lg"
              >
                لا توجد طلبات في هذا العرض.
              </td>
            </tr>
          ) : (
            rows.map((o) => {
              const selectable = showSelectColumn && isRowSelectable(o);
              const checked = isSelected(o.id);
              return (
                <tr
                  key={o.id}
                  onClick={() => onOpenRow(o.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenRow(o.id);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  className={`group cursor-pointer border-b border-slate-100 transition-colors ${
                    o.reversePickup
                      ? "bg-violet-50/70 hover:bg-violet-100/80"
                      : "bg-white hover:bg-sky-50/90"
                  }`}
                >
                  {showSelectColumn ? (
                    <td
                      className={`sticky right-0 z-10 w-14 min-w-[3.25rem] max-w-[3.5rem] align-top px-1 py-2.5 text-center shadow-[-4px_0_8px_-2px_rgba(15,23,42,0.1)] transition-colors ${
                        o.reversePickup ? "bg-violet-50/70 group-hover:bg-violet-100/80" : "bg-white group-hover:bg-sky-50/90"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {selectable ? (
                        <div className="flex flex-col items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleOne(o.id)}
                            className="h-5 w-5 rounded border-sky-400 text-sky-600 accent-sky-600"
                            title={selectedTitle}
                            aria-label={`${selectedAriaPrefix} ${o.shortId}`}
                          />
                          {showStatusDotInSelectCol ? (
                            <span
                              className={`inline-flex h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9 ${o.statusClass}`}
                              title={o.statusAr}
                              aria-label={o.statusAr}
                              role="img"
                            />
                          ) : null}
                          {renderSelectActions ? (
                            <div className="mt-0.5">{renderSelectActions(o)}</div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="inline-block text-slate-300" aria-hidden>
                          —
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-2 py-2.5 align-top font-mono text-sm text-slate-600 tabular-nums sm:text-base">
                    <div className="flex flex-col items-start gap-1">
                      {o.prepaidAll ? (
                        <span
                          className="text-[11px] font-black leading-none text-red-700 sm:text-xs"
                          title="كل شي واصل — لا نقد من الزبون"
                        >
                          واصل
                        </span>
                      ) : null}
                      {o.reversePickup ? (
                        <span
                          className="text-[11px] font-black leading-none text-violet-800 sm:text-xs"
                          title="تنبيه طلب عكسي استلام من الزبون وتسليم للعميل"
                        >
                          عكسي
                        </span>
                      ) : null}
                      {o.hasCourierUploadedLocation ? (
                        <span
                          className="text-[11px] font-black leading-none text-violet-700 sm:text-xs"
                          title="لوكيشن مرفوع من المندوب"
                        >
                          GPS
                        </span>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!o.hasCustomerLocation ? (
                          <span
                            className="inline-block shrink-0 rounded bg-rose-600 px-1 py-0.5 text-[9px] font-black leading-none text-white"
                            title="بدون لوكيشن للزبون"
                            aria-label="بدون لوكيشن"
                          >
                            !
                          </span>
                        ) : null}
                        {o.hasMoneyDeletedBadge ? (
                          <span
                            className="inline-block shrink-0 rounded bg-slate-500 px-1 py-0.5 text-[8px] font-black leading-none text-white"
                            title="تعديل مالي (معاملة محذوفة)"
                            aria-label="معاملة محذوفة"
                          >
                            $
                          </span>
                        ) : null}
                        {renderOrderIdBadge ? (
                          renderOrderIdBadge(o)
                        ) : !showSelectColumn || !showStatusDotInSelectCol ? (
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9 ${o.statusClass}`}
                            title={o.statusAr}
                            aria-label={o.statusAr}
                            role="img"
                          />
                        ) : null}
                        <span className="tabular-nums">{o.shortId}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="max-w-[14rem] break-words sm:max-w-[18rem]">
                      {o.assignedCourierName?.trim() ? (
                        <div className="mb-1 text-[11px] font-black text-emerald-800 sm:text-xs">
                          {o.assignedCourierName}
                        </div>
                      ) : null}
                      <span className={`inline-block rounded-md ${o.shopNameHighlightClass}`}>
                        {o.shopName}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`max-w-[12rem] px-2 py-2.5 text-sm sm:max-w-[16rem] sm:text-base ${
                      o.reversePickup ? "font-bold text-violet-900" : "text-slate-700"
                    }`}
                  >
                    {o.regionLine}
                  </td>
                  <td className="max-w-[10rem] px-2 py-2.5 text-sm text-slate-800 sm:text-base">
                    <OrderTypeLine orderType={o.orderType} />
                  </td>
                  <td className="px-2 py-2.5 font-mono tabular-nums text-slate-900">{o.priceStr}</td>
                  <td className="px-2 py-2.5 font-mono tabular-nums text-cyan-700">{o.delStr}</td>
                  <td className="px-2 py-2.5 font-mono text-sm tabular-nums text-slate-700 sm:text-base">
                    {o.customerPhone || "—"}
                  </td>
                  <td className="px-2 py-2.5 text-sm text-slate-600 sm:text-base">{o.timeLine}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
