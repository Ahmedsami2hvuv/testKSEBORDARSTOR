"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import {
  bulkAssignOrdersByPreparer,
  type PreparerActionState,
} from "./actions";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";

function buildPreparerOrderDetailHref(
  auth: { p: string; exp: string; s: string },
  tab: string,
  q: string,
  orderId: string,
) {
  const p = new URLSearchParams();
  if (auth.p) p.set("p", auth.p);
  if (auth.exp) p.set("exp", auth.exp);
  if (auth.s) p.set("s", auth.s);
  p.set("tab", tab);
  if (q.trim()) p.set("q", q.trim());
  return `/preparer/order/${orderId}?${p.toString()}`;
}

function isAssignableBeforeCourierReceipt(status: string | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "pending" || s === "assigned";
}

const bulkInitial: PreparerActionState = {};

export function PreparerOrderTable({
  rows,
  auth,
  tab,
  qSearch,
  couriers = [],
}: {
  rows: MandoubRow[];
  auth: { p: string; exp: string; s: string };
  tab: string;
  qSearch: string;
  couriers?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkAssignOrdersByPreparer,
    bulkInitial,
  );
  const prevBulkPending = useRef(false);

  const pendingIds = useMemo(
    () => rows.filter((r) => isAssignableBeforeCourierReceipt(r.orderStatus)).map((r) => r.id),
    [rows],
  );

  const showBulkRow = couriers.length > 0 && pendingIds.length > 0;
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (prevBulkPending.current && !bulkPending && bulkState.ok) {
      setSelectedIds(new Set());
      router.refresh();
    }
    prevBulkPending.current = bulkPending;
  }, [bulkPending, bulkState.ok, router]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPending() {
    if (allPendingSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingIds));
  }

  const prepQuickBtn =
    "min-h-[38px] shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-red-950 hover:bg-red-50 sm:text-xs";

  return (
    <div>
      {bulkState.error ? (
        <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {bulkState.error}
        </div>
      ) : null}

      {showBulkRow && (
        <div className="mb-2 px-2 sm:px-4">
          <button
            type="button"
            onClick={() => setShowQuickSelect((v) => !v)}
            className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-900 hover:bg-red-100"
          >
            ⚡ تحديد سريع
            <span className="text-red-400">{showQuickSelect ? "▲" : "▼"}</span>
          </button>

          {showQuickSelect && (
            <div className="rounded-xl border border-red-100 bg-red-50/40 px-2 py-2 sm:px-3">
              <p className="mb-1.5 text-[11px] font-bold text-red-900/90 sm:text-xs">
                تحديد سريع — جديد أو بانتظار المندوب فقط
              </p>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button type="button" onClick={toggleAllPending} className={prepQuickBtn}>
                  تحديد كل القابل للإسناد
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 sm:text-xs"
                >
                  إفراغ التحديد
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <UnifiedOrderListTable
        rows={rows}
        colCount={showBulkRow ? 9 : 8}
        showSelectColumn={showQuickSelect}
        isRowSelectable={(r) => isAssignableBeforeCourierReceipt(r.orderStatus)}
        isSelected={(id) => selectedIds.has(id)}
        allSelected={allPendingSelected}
        onToggleAll={toggleAllPending}
        onToggleOne={toggleOne}
        onOpenRow={(id) => router.push(buildPreparerOrderDetailHref(auth, tab, qSearch, id))}
        selectAllTitle="تحديد الكل"
        selectAllAriaLabel="تحديد الكل"
        selectedTitle="تحديد"
        selectedAriaPrefix="تحديد"
        showStatusDotInSelectCol={false}
        renderOrderIdBadge={(o) => {
          if (!isAssignableBeforeCourierReceipt(o.orderStatus) || couriers.length === 0) return null;
          return (
            <Link
              href={`${buildPreparerOrderDetailHref(auth, tab, qSearch, o.id)}#preparer-assign`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-[14px] font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
            >
              ✓
            </Link>
          );
        }}
      />

      {showQuickSelect && selectedIds.size > 0 && (
        <form
          action={bulkAction}
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-200 bg-gradient-to-t from-emerald-50/98 to-white px-3 py-3 shadow-[0_-4px_20px_rgba(5,150,105,0.12)] sm:px-4"
        >
          <input type="hidden" name="p" value={auth.p} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="orderIds" value={Array.from(selectedIds).join(",")} />
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-emerald-950">إسناد ({selectedIds.size}) طلب لمندوب:</p>
            <div className="flex gap-2">
              <select name="courierId" required className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
                <option value="" disabled>— اختر مندوب —</option>
                {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="submit" disabled={bulkPending} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">إسناد</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
