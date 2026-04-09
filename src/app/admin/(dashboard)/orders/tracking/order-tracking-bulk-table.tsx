"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BulkOrdersState } from "../bulk-actions";
import { bulkUpdateOrdersStatus } from "../bulk-actions";
import type { TrackingTableRow } from "./order-tracking-table-body";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { mandoubShopNameVividClass } from "@/lib/order-status-style";

const STATUS_UI: Record<string, { ar: string; dot: string }> = {
  pending: { ar: "جديد", dot: "bg-red-500 ring-2 ring-red-200/70" },
  assigned: { ar: "بانتظار المندوب", dot: "bg-amber-400 ring-2 ring-amber-200/80" },
  delivering: { ar: "عند المندوب", dot: "bg-cyan-500 ring-2 ring-cyan-200/80" },
  delivered: { ar: "تم التسليم", dot: "bg-emerald-500 ring-2 ring-emerald-200/80" },
  cancelled: { ar: "ملغي", dot: "bg-slate-500 ring-2 ring-slate-200/80" },
  archived: { ar: "مؤرشف", dot: "bg-violet-500 ring-2 ring-violet-200/80" },
};

const QUICK_STATUS_VALUES = [
  { value: "all", label: "أي حالة" },
  { value: "pending", label: "جديد" },
  { value: "assigned", label: "بانتظار المندوب" },
  { value: "delivering", label: "عند المندوب" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغي" },
  { value: "archived", label: "مؤرشف" },
] as const;

export function OrderTrackingBulkTable({
  rows,
  couriers,
}: {
  rows: TrackingTableRow[];
  couriers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [quickStatus, setQuickStatus] = useState<string>("all");
  const [quickCourier, setQuickCourier] = useState<string>("any");

  const selectedCount = selected.size;
  const allSelected = selectedCount > 0 && visibleIds.every((id) => selected.has(id));

  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkUpdateOrdersStatus,
    {} as BulkOrdersState,
  );

  const [targetStatus, setTargetStatus] = useState<string>("assigned");
  const [courierId, setCourierId] = useState<string>("");

  const needsCourier =
    targetStatus === "assigned" ||
    targetStatus === "delivering" ||
    targetStatus === "delivered";

  const selectedIdsArr = useMemo(() => Array.from(selected), [selected]);
  const unifiedRows: MandoubRow[] = useMemo(
    () =>
      rows.map((r) => {
        const ui = STATUS_UI[r.orderStatus] ?? {
          ar: r.orderStatus,
          dot: "bg-slate-500 ring-2 ring-slate-200/80",
        };
        return {
          id: r.id,
          shortId: String(r.orderNumber),
          orderStatus: r.orderStatus,
          assignedCourierName: r.courierName?.trim() || "",
          shopName: r.shopCustomerLabel,
          shopNameHighlightClass: mandoubShopNameVividClass(r.orderStatus, false),
          regionLine: r.regionName,
          orderType: r.routeModeLabel
            ? `${r.orderType} • ${r.routeModeLabel}`
            : r.orderType,
          priceStr: r.totalLabel,
          delStr: r.deliveryLabel,
          customerPhone: r.customerPhone,
          timeLine: r.courierName || "—",
          statusAr: ui.ar,
          statusClass: ui.dot,
          hasCustomerLocation: !r.missingCustomerLocation,
          hasCourierUploadedLocation: r.hasCourierUploadedLocation,
          hasMoneyDeletedBadge: false,
          prepaidAll: false,
          reversePickup: isReversePickupOrderType(r.orderType),
          wardMismatchType: r.wardMismatchType,
          saderMismatchType: r.saderMismatchType,
          createdAt: r.createdAt,
        };
      }),
    [rows],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function selectByVisibleStatus(status: string) {
    const next = new Set<string>();
    for (const r of rows) {
      if (status !== "all" && r.orderStatus !== status) continue;
      next.add(r.id);
    }
    setSelected(next);
  }

  function selectMatchingQuickFilters() {
    const next = new Set<string>();
    for (const r of rows) {
      if (quickStatus !== "all" && r.orderStatus !== quickStatus) continue;
      if (quickCourier !== "any") {
        if (r.assignedCourierId !== quickCourier) continue;
      }
      next.add(r.id);
    }
    setSelected(next);
  }

  function selectAllVisible() {
    setSelected(new Set(visibleIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  useEffect(() => {
    if (bulkState.ok) setSelected(new Set());
  }, [bulkState.ok]);

  return (
    <div className="space-y-3">
      {visibleIds.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowQuickSelect((v) => !v)}
            className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100"
          >
            ⚡ تحديد سريع
            <span className="text-sky-400">{showQuickSelect ? "▲" : "▼"}</span>
          </button>

          {showQuickSelect && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2.5">
              <p className="mb-2 text-xs font-bold text-slate-700">
                اختر حالة و/أو مندوباً ثم اضغط «تحديد المطابقين»
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-xs font-bold text-slate-600">
                  الحالة الحالية
                  <select
                    value={quickStatus}
                    onChange={(e) => setQuickStatus(e.target.value)}
                    className="min-h-[40px] rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 outline-none"
                  >
                    {QUICK_STATUS_VALUES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-xs font-bold text-slate-600">
                  المندوب المسند
                  <select
                    value={quickCourier}
                    onChange={(e) => setQuickCourier(e.target.value)}
                    className="min-h-[40px] min-w-[10rem] rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="any">أي مندوب</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={selectMatchingQuickFilters}
                  className="min-h-[40px] rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-800"
                >
                  تحديد المطابقين
                </button>
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="min-h-[40px] rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-sky-50"
                >
                  تحديد الكل الظاهر
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  إفراغ التحديد
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {selectedCount ? (
        <div className="rounded-2xl border border-sky-200 bg-white/70 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                تم اختيار {selectedCount} طلب
              </p>
              {bulkState.error ? (
                <p className="mt-1 text-sm font-bold text-rose-600">
                  {bulkState.error}
                </p>
              ) : null}
              {bulkPending ? (
                <p className="mt-1 text-xs font-bold text-sky-800">جارٍ التطبيق…</p>
              ) : null}
            </div>

            <form action={bulkAction} className="flex flex-wrap items-end gap-2">
              {selectedIdsArr.map((id) => (
                <input key={id} type="hidden" name="orderIds" value={id} />
              ))}

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-bold text-slate-600">الحالة الجديدة</span>
                <select
                  name="targetStatus"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="assigned">مسند للمندوب</option>
                  <option value="delivering">بالتوصيل</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي/مرفوض</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </label>

              {needsCourier ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-bold text-slate-600">المندوب</span>
                  <select
                    name="courierId"
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="">اختر مندوب…</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="courierId" value="" />
              )}

              <button
                type="submit"
                disabled={bulkPending || (needsCourier && !courierId)}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-200/80 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 disabled:opacity-60"
              >
                تطبيق
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <UnifiedOrderListTable
        rows={unifiedRows}
        colCount={9}
        showSelectColumn
        isRowSelectable={() => true}
        isSelected={(id) => selected.has(id)}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onOpenRow={(id) => router.push(`/admin/orders/${id}`)}
        selectAllTitle="تحديد الكل"
        selectAllAriaLabel="تحديد كل الطلبات الظاهرة"
        selectedTitle="تحديد"
        selectedAriaPrefix="تحديد الطلب"
        showStatusDotInSelectCol={false}
        renderOrderIdBadge={() => null}
        renderSelectActions={(row) =>
          row.orderStatus === "pending" ? (
            <Link
              href={`/admin/orders/pending?assignOrder=${encodeURIComponent(row.id)}`}
              title="إسناد للمندوب"
              aria-label="إسناد الطلب للمندوب"
              className="inline-flex min-h-[28px] items-center justify-center rounded-md border border-emerald-500 bg-emerald-600 px-2 text-[11px] font-black text-white shadow-sm transition hover:bg-emerald-700"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.2}
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </Link>
          ) : null
        }
      />
    </div>
  );
}
