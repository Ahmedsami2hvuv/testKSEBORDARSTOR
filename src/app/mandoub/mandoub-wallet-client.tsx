"use client";

import { useActionState, useState } from "react";
import {
  createWalletPeerTransferFromCourier,
  respondWalletPeerTransferByCourier,
  type WalletPeerTransferState,
} from "@/app/wallet-peer-transfer-actions";
import {
  softDeleteMandoubMiscWalletEntry,
  softDeleteMandoubMoneyEvent,
  submitMandoubMiscWalletEntry,
  type MandoubCashState,
} from "./cash-actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  moneyLedgerAmountClass,
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { UISectionConfig } from "@/lib/ui-settings";

export type MandoubWalletDeletionReason =
  | "manual_admin"
  | "manual_courier"
  | "manual_preparer"
  | "status_revert"
  | null;

export type MandoubWalletLedgerLine = {
  source: "order" | "misc" | "transfer_pending";
  id: string;
  kind: string;
  amountDinar: number;
  createdAt: string;
  orderId: string;
  orderNumber: number;
  shopName: string;
  regionName?: string;
  orderNotes?: string | null;
  miscLabel: string | null;
  deletedAt: string | null;
  deletedReason: MandoubWalletDeletionReason;
  deletedByDisplayName: string | null;
  expectedDinar?: number | null;
  matchesExpected?: boolean;
};

const initialCash: MandoubCashState = {};
const initialTransfer: WalletPeerTransferState = {};

export type PendingIncomingTransferUi = {
  id: string;
  amountDinar: number;
  fromLabel: string;
  handoverLocation: string;
  createdAt: string;
};

export type TransferTargetCourierUi = { id: string; name: string };
export type TransferTargetEmployeeUi = { id: string; name: string; shopName: string; phone: string };

function buildOrderHref(auth: { c: string; exp: string; s: string }, orderId: string) {
  const p = new URLSearchParams();
  if (auth.c) p.set("c", auth.c);
  if (auth.exp) p.set("exp", auth.exp);
  if (auth.s) p.set("s", auth.s);
  p.set("tab", "all");
  return `/mandoub/order/${orderId}?${p.toString()}`;
}

function ledgerDirLabel(line: MandoubWalletLedgerLine): string {
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT) return "صادر معلّق";
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_IN) return "وارد معلّق";
  if (line.kind === MONEY_KIND_PICKUP) return "صادر";
  if (line.kind === MONEY_KIND_DELIVERY) return "وارد";
  if (line.kind === MISC_LEDGER_KIND_TAKE) return "أخذت";
  if (line.kind === MISC_LEDGER_KIND_GIVE) return "أعطيت";
  return line.kind;
}

export type MandoubLedgerFilter = "ward" | "sader" | "site" | "all";

export function MandoubWalletClient({
  auth,
  walletPathWithQuery,
  walletLedgerHrefs,
  ledgerFilter,
  siteRemainingNetStr,
  walletInFromWalletStr,
  walletOutFromWalletStr,
  sumEarningsStr,
  walletRemainStr,
  handToAdminStr,
  cashInHandStr,
  ledger,
  pendingIncoming,
  transferTargetCouriers,
  transferTargetEmployees,
  availableForTransferStr,
  pendingOutgoingCount,
  tipDailyStr,
  tipMonthlyStr,
  uiSettings,
}: {
  auth: { c: string; exp: string; s: string };
  walletPathWithQuery: string;
  walletLedgerHrefs: { site: string; ward: string; sader: string; all: string };
  ledgerFilter: MandoubLedgerFilter;
  siteRemainingNetStr: string;
  walletInFromWalletStr: string;
  walletOutFromWalletStr: string;
  sumEarningsStr: string;
  walletRemainStr: string;
  handToAdminStr: string;
  cashInHandStr: string;
  ledger: MandoubWalletLedgerLine[];
  pendingIncoming: PendingIncomingTransferUi[];
  transferTargetCouriers: TransferTargetCourierUi[];
  transferTargetEmployees: TransferTargetEmployeeUi[];
  availableForTransferStr: string;
  pendingOutgoingCount: number;
  tipDailyStr?: string;
  tipMonthlyStr?: string;
  uiSettings?: UISectionConfig | null;
}) {
  const [miscPanel, setMiscPanel] = useState<null | "take" | "give">(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [toKind, setToKind] = useState<"" | "courier" | "employee" | "admin">("");

  const [deleteState, deleteAction, deletePending] = useActionState(softDeleteMandoubMoneyEvent, initialCash);
  const [miscDelState, miscDelAction, miscDelPending] = useActionState(softDeleteMandoubMiscWalletEntry, initialCash);
  const [miscSubmitState, miscSubmitAction, miscSubmitPending] = useActionState(submitMandoubMiscWalletEntry, initialCash);
  const [createState, createAction, createPending] = useActionState(createWalletPeerTransferFromCourier, initialTransfer);
  const [respondState, respondAction, respondPending] = useActionState(respondWalletPeerTransferByCourier, initialTransfer);

  // ستايل المحفظة الديناميكي
  const containerStyle = uiSettings ? {
    backgroundColor: uiSettings.backgroundColor,
    backgroundImage: uiSettings.backgroundImage ? `url(${uiSettings.backgroundImage})` : undefined,
    color: uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: uiSettings.padding || '1.25rem'
  } : {};

  const renderAccountingBlock = (id: string) => {
    switch (id) {
      case "wallet_in_out":
        return (
          <div key="in_out" className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link href={walletLedgerHrefs.sader} className={`kse-glass-dark block rounded-xl border p-3 shadow-sm transition ${ledgerFilter === "sader" ? "border-slate-500 bg-slate-100 dark:bg-slate-800" : "border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800"}`}>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">صادر المحفظة</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{walletOutFromWalletStr}</p>
            </Link>
            <Link href={walletLedgerHrefs.ward} className={`kse-glass-dark block rounded-xl border p-3 shadow-sm transition ${ledgerFilter === "ward" ? "border-slate-500 bg-slate-100 dark:bg-slate-800" : "border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800"}`}>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">وارد المحفظة</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{walletInFromWalletStr}</p>
            </Link>
          </div>
        );
      case "site_and_remain":
        return (
          <div key="site_remain" className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link href={walletLedgerHrefs.site} className={`kse-glass-dark block rounded-xl border p-3 shadow-sm transition ${ledgerFilter === "site" ? "border-slate-500 bg-slate-100 dark:bg-slate-800" : "border-slate-300 bg-white dark:bg-slate-900/50 dark:border-slate-800"}`}>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">الموقع</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{siteRemainingNetStr}</p>
            </Link>
            <div className="kse-glass-dark rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">متبقي المحفظة</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{walletRemainStr}</p>
            </div>
          </div>
        );
      case "cash_in_hand":
        return (
          <div key="cash" className="kse-glass-dark rounded-2xl border-2 border-emerald-500 bg-emerald-100 p-5 shadow-lg dark:bg-emerald-900/30 dark:border-emerald-800 text-center">
            <p className="text-base font-black text-emerald-900 dark:text-emerald-400">الموجود عندي (كاش)</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-emerald-950 sm:text-4xl dark:text-emerald-100">{cashInHandStr}</p>
            <p className="mt-2 text-xs font-bold text-emerald-800 sm:text-sm dark:text-emerald-500">يساوي: (للإدارة {handToAdminStr} + أرباحي {sumEarningsStr})</p>
          </div>
        );
      case "earnings_and_admin":
        return (
          <div key="earnings" className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="kse-glass-dark rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">أرباحي</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{sumEarningsStr}</p>
            </div>
            <div className="kse-glass-dark rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-400 sm:text-sm">للإدارة</p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">{handToAdminStr}</p>
            </div>
          </div>
        );
      case "tips_blocks":
        return (
          <div key="tips" className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="kse-glass-dark rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm dark:bg-amber-900/20 dark:border-amber-800">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-400 sm:text-sm">إكراميات الفترة</p>
              <p className="mt-1 text-lg font-black tabular-nums text-amber-950 sm:text-2xl dark:text-amber-100">{tipDailyStr || "0 ألف"}</p>
            </div>
            <div className="kse-glass-dark rounded-xl border border-sky-300 bg-sky-50 p-3 shadow-sm dark:bg-sky-900/20 dark:border-sky-800">
              <p className="text-xs font-bold text-sky-900 dark:text-sky-400 sm:text-sm">إكراميات الشهر</p>
              <p className="mt-1 text-lg font-black tabular-nums text-sky-950 sm:text-2xl dark:text-sky-100">{tipMonthlyStr || "0 ألف"}</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  const layout = uiSettings?.layoutOrder && uiSettings.layoutOrder.length > 0
    ? uiSettings.layoutOrder
    : ["wallet_in_out", "site_and_remain", "cash_in_hand", "earnings_and_admin", "tips_blocks"];

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex justify-end px-1">
        <ThemeSwitcher />
      </div>

      {pendingIncoming.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-4 dark:bg-amber-900/20 dark:border-amber-800 shadow-sm animate-in fade-in">
          <p className="text-base font-black text-slate-900 dark:text-amber-400">لديك {pendingIncoming.length} تحويل بانتظار موافقتك</p>
          <ul className="mt-3 space-y-3">
            {pendingIncoming.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:bg-slate-900 dark:border-slate-800">
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">{formatDinarAsAlfWithUnit(p.amountDinar)} — من {p.fromLabel}</p>
                <div className="mt-3 flex gap-2">
                  <form action={respondAction}>
                    <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} /><input type="hidden" name="next" value={walletPathWithQuery} /><input type="hidden" name="transferId" value={p.id} /><input type="hidden" name="accept" value="1" />
                    <button type="submit" disabled={respondPending} className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">قبول</button>
                  </form>
                  <form action={respondAction}>
                    <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} /><input type="hidden" name="next" value={walletPathWithQuery} /><input type="hidden" name="transferId" value={p.id} /><input type="hidden" name="accept" value="0" />
                    <button type="submit" disabled={respondPending} className="rounded-xl border border-rose-500 px-6 py-2 text-sm font-black text-rose-600 dark:bg-slate-800 hover:bg-rose-50">رفض</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* المربعات الحسابية مرتبة ديناميكياً */}
      <div className="space-y-3" style={containerStyle}>
        {layout.map(id => renderAccountingBlock(id))}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-indigo-50/30 px-4 py-4 dark:from-slate-900 dark:to-slate-800 shadow-inner">
        <h2 className="text-base font-black text-slate-900 dark:text-slate-100">أخذت · تحويل · أعطيت</h2>
        <div className="mt-4 flex w-full gap-2 sm:gap-3">
          <button type="button" onClick={() => { setTransferOpen(false); setMiscPanel(p => p === "take" ? null : "take"); }} className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition ${miscPanel === "take" ? "border-red-600 bg-red-600 text-white" : "border-red-500 bg-white text-red-900 dark:bg-slate-800 dark:text-red-400"}`}>أخذت</button>
          <button type="button" onClick={() => { setMiscPanel(null); setTransferOpen(o => !o); }} className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition ${transferOpen ? "border-violet-600 bg-violet-600 text-white" : "border-violet-500 bg-violet-100 text-violet-950 dark:bg-slate-800 dark:text-violet-400"}`}>تحويل</button>
          <button type="button" onClick={() => { setTransferOpen(false); setMiscPanel(p => p === "give" ? null : "give"); }} className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition ${miscPanel === "give" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-600 bg-white text-emerald-900 dark:bg-slate-800 dark:text-emerald-400"}`}>أعطيت</button>
        </div>

        {(miscPanel || transferOpen) && (
          <form action={transferOpen ? createAction : miscSubmitAction} className={`mt-4 space-y-3 rounded-xl border-2 p-4 shadow-xl ${transferOpen ? "border-violet-200 bg-white dark:bg-slate-900 dark:border-slate-700" : miscPanel === "take" ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-emerald-600 bg-lime-50 dark:bg-emerald-950/20"}`}>
            <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} /><input type="hidden" name="next" value={walletPathWithQuery} />
            {!transferOpen && <input type="hidden" name="direction" value={miscPanel!} />}
            {transferOpen && (
              <div className="flex gap-2">
                {([["courier", "مندوب"], ["employee", "مجهز"], ["admin", "الإدارة"]] as const).map(([v, l]) => (
                  <label key={v} className={`flex-1 text-center py-2.5 rounded-xl border-2 text-xs font-black cursor-pointer transition-all ${toKind === v ? "border-violet-600 bg-violet-600 text-white shadow-md" : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"}`}>
                    <input type="radio" name="toKind" value={v} className="sr-only" checked={toKind === v} onChange={e => setToKind(e.target.value as any)} /> {l}
                  </label>
                ))}
              </div>
            )}
            {transferOpen && toKind === "courier" && (
              <select name="toCourierId" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm">
                <option value="">— اختر المندوب —</option>
                {transferTargetCouriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {transferOpen && toKind === "employee" && (
              <select name="toEmployeeId" required className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm">
                <option value="">— اختر المجهز —</option>
                {transferTargetEmployees.map(em => <option key={em.id} value={em.id}>{em.name} ({em.shopName})</option>)}
              </select>
            )}
            <input name={transferOpen ? "handoverLocation" : "label"} required placeholder={transferOpen ? "مكان التسليم..." : "اسم المعاملة..."} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm shadow-inner" />
            <input name="amountAlf" required inputMode="decimal" placeholder="المبلغ بالألف..." className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 p-3 rounded-xl font-black text-xl text-center shadow-inner" />
            <button type="submit" disabled={createPending || miscSubmitPending} className="w-full rounded-xl bg-indigo-600 py-4 text-base font-black text-white shadow-lg">إتمام العملية</button>
          </form>
        )}
      </div>

      <ul className="space-y-3 pb-8">
        {ledger.map((line) => {
          const deleted = line.deletedAt != null;
          const isOutPick = line.kind === MONEY_KIND_PICKUP || line.kind === MISC_LEDGER_KIND_GIVE || line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT;
          const isInPick = line.kind === MONEY_KIND_DELIVERY || line.kind === MISC_LEDGER_KIND_TAKE || line.kind === LEDGER_KIND_TRANSFER_PENDING_IN;
          const dirLabel = ledgerDirLabel(line);
          const dateStr = new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
          const diff = (line.expectedDinar != null) ? line.amountDinar - line.expectedDinar : 0;
          const hasMismatch = line.expectedDinar != null && Math.abs(diff) > 0.01;
          const orderHref = line.source === "order" ? buildOrderHref(auth, line.orderId) : null;

          const content = (
            <div className={`relative flex flex-col gap-1 rounded-2xl border-2 px-4 py-3 transition-all shadow-sm backdrop-blur-[2px] ${
              deleted ? "border-slate-300 bg-slate-100/90 text-slate-600 dark:bg-slate-800" :
              isInPick ? "border-rose-500/60 bg-rose-500/20 dark:bg-rose-500/25 dark:border-rose-500/50" :
              isOutPick ? "border-emerald-500/60 bg-emerald-500/20 dark:bg-emerald-500/25 dark:border-emerald-500/50" :
              "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
            }`}>
              <div className="flex flex-col min-w-0 pr-10 sm:pr-12">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                  <p className={`text-base font-black sm:text-lg truncate ${!deleted ? "text-slate-950 dark:text-white" : "text-slate-500"}`}>
                    {dirLabel} · {formatDinarAsAlfWithUnit(line.amountDinar)}
                  </p>

                  {!deleted && line.source === "order" && line.expectedDinar != null && (
                    <div className={`inline-flex items-center gap-1 rounded-lg border-2 px-2 py-0.5 text-[11px] font-black whitespace-nowrap ${
                      !hasMismatch ? "border-emerald-600 bg-emerald-500 text-white dark:text-emerald-50 shadow-sm" :
                      diff > 0 ? "border-amber-600 bg-amber-500 text-white dark:text-amber-700 shadow-sm" :
                      "border-rose-600 bg-rose-500 text-white dark:text-rose-50 shadow-sm"
                    }`}>
                      <span>{!hasMismatch ? "✅ مطابق" : diff > 0 ? "⚠️ زيادة" : "🚨 نقص"}</span>
                      {hasMismatch && <span className="tabular-nums">({formatDinarAsAlfWithUnit(Math.abs(diff))})</span>}
                    </div>
                  )}

                  <span className={`text-[10px] font-bold ${!deleted ? "text-slate-600 dark:text-slate-400" : "text-slate-400"}`}>({dateStr})</span>
                </div>

                <p className={`mt-0.5 text-sm font-bold truncate ${!deleted ? "text-slate-800 dark:text-slate-300" : "text-slate-500"}`}>
                  {line.source === "order" ? `طلب ${line.orderNumber} — ${line.shopName}` : (line.miscLabel ?? "—")}
                </p>
              </div>

              {!deleted && line.source !== "transfer_pending" && (
                <form action={line.source === "order" ? deleteAction : miscDelAction} className="absolute left-2 top-1/2 -translate-y-1/2 z-10" onClick={(e) => e.stopPropagation()}>
                  <input type="hidden" name="c" value={auth.c} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
                  <input type="hidden" name={line.source === "order" ? "eventId" : "miscEntryId"} value={line.id} />
                  <input type="hidden" name="next" value={walletPathWithQuery} />
                  <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border-2 border-rose-500 text-sm shadow-md hover:scale-105 transition-transform" title="حذف">🗑️</button>
                </form>
              )}
            </div>
          );

          return (
            <li key={`${line.source}-${line.id}`}>
              {orderHref ? (
                <Link href={orderHref} className="block active:opacity-80 transition-opacity">
                  {content}
                </Link>
              ) : content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
