"use client";

import { useActionState } from "react";
import { softDeletePreparerMoneyEvent, type PreparerCashState } from "@/app/preparer/preparer-cash-actions";
import * as PreparerWalletActions from "@/app/preparer/wallet/actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import type { MandoubWalletLedgerLine } from "@/app/mandoub/mandoub-wallet-client";
import { ThemeSwitcher as ThemeToggle } from "@/components/theme-switcher";
import Link from "next/link";
import { UISectionConfig } from "@/lib/ui-settings";

const initialDelete: PreparerCashState = {};
const initialMiscDelete: PreparerWalletActions.EmployeeWalletMiscState = {};

function ledgerDirLabel(line: MandoubWalletLedgerLine): string {
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_IN) return "وارد معلّق";
  if (line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT) return "صادر معلّق";
  if (line.kind === MONEY_KIND_PICKUP) return "صادر";
  if (line.kind === MONEY_KIND_DELIVERY) return "وارد";
  if (line.kind === MISC_LEDGER_KIND_TAKE) return "أخذت";
  if (line.kind === MISC_LEDGER_KIND_GIVE) return "أعطيت";
  return line.kind;
}

export function PreparerWalletClient({
  ledger,
  orderLinkAuth,
  preparerDeleteAuth,
  preparerDeleteNextUrl,
  uiSettings,
}: {
  ledger: MandoubWalletLedgerLine[];
  orderLinkAuth?: { p: string; exp: string; s: string };
  preparerDeleteAuth?: { p: string; exp: string; s: string };
  preparerDeleteNextUrl?: string;
  uiSettings?: UISectionConfig | null;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(softDeletePreparerMoneyEvent, initialDelete);
  const [deleteMiscState, deleteMiscAction, deleteMiscPending] = useActionState(PreparerWalletActions.softDeleteEmployeeWalletMiscEntryFromCompanyPreparer, initialMiscDelete);

  const containerStyle = uiSettings ? {
    backgroundColor: uiSettings.backgroundColor,
    backgroundImage: uiSettings.backgroundImage ? `url(${uiSettings.backgroundImage})` : undefined,
    color: uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    backgroundSize: 'cover', backgroundPosition: 'center',
    padding: uiSettings.padding || '1.25rem'
  } : {};

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex justify-end px-1">
        <ThemeToggle />
      </div>

      <ul className="space-y-3 pb-8" style={containerStyle}>
        {ledger.map((line) => {
          const deleted = line.deletedAt != null;
          const isInPick = line.kind === MONEY_KIND_DELIVERY || line.kind === MISC_LEDGER_KIND_TAKE || line.kind === LEDGER_KIND_TRANSFER_PENDING_IN;
          const isOutPick = line.kind === MONEY_KIND_PICKUP || line.kind === MISC_LEDGER_KIND_GIVE || line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT;

          const dirLabel = ledgerDirLabel(line);
          const dateStr = new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
          const diff = (line.expectedDinar != null) ? line.amountDinar - line.expectedDinar : 0;
          const hasMismatch = line.expectedDinar != null && Math.abs(diff) > 0.01;
          const orderHref = (orderLinkAuth && line.orderId) ? `/preparer/order/${line.orderId}?${new URLSearchParams({ p: orderLinkAuth.p, exp: orderLinkAuth.exp, s: orderLinkAuth.s }).toString()}` : null;

          return (
            <li key={`${line.source}-${line.id}`}>
              <div className={`relative flex flex-col gap-1.5 rounded-2xl border-2 px-4 py-3 transition-all shadow-sm ${
                deleted ? "border-slate-300 bg-slate-100/90 text-slate-600 dark:bg-slate-800" :
                isInPick ? "border-red-600 bg-red-100/95 dark:bg-red-900/40 dark:border-red-800" :
                isOutPick ? "border-emerald-600 bg-emerald-100/95 dark:bg-emerald-900/40 dark:border-emerald-800" :
                "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
              }`}>
                <div className="flex flex-col min-w-0 pr-10 sm:pr-12">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                    <p className={`text-base font-black sm:text-lg ${!deleted ? "text-slate-950 dark:text-white" : "text-slate-500"}`}>{dirLabel} · {formatDinarAsAlfWithUnit(line.amountDinar)}</p>
                    {!deleted && line.source === "order" && line.expectedDinar != null && (
                      <div className={`inline-flex items-center gap-1 rounded-lg border-2 px-2 py-0.5 text-[11px] font-black whitespace-nowrap ${!hasMismatch ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : diff > 0 ? "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-rose-600/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                        <span>{!hasMismatch ? "✅ مطابق" : diff > 0 ? "⚠️ زيادة" : "🚨 نقص"}</span>{hasMismatch && <span className="tabular-nums">({formatDinarAsAlfWithUnit(Math.abs(diff))})</span>}
                      </div>
                    )}
                    <span className={`text-[10px] font-bold ${!deleted ? "text-slate-600 dark:text-slate-400" : "text-slate-400"}`}>({dateStr})</span>
                  </div>
                  <p className={`mt-0.5 text-sm font-bold truncate ${!deleted ? "text-slate-800 dark:text-slate-300" : "text-slate-500"}`}>{line.source === "order" ? `طلب ${line.orderNumber} — ${line.shopName}` : (line.miscLabel ?? "—")}</p>
                </div>
                {!deleted && line.source !== "transfer_pending" && (
                  <form action={line.source === "order" ? deleteAction : deleteMiscAction} className="absolute left-2 top-1/2 -translate-y-1/2 z-10" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { if (!window.confirm(`تأكيد مسح هذه الحركة؟`)) e.preventDefault(); }}>
                    <input type="hidden" name="p" value={preparerDeleteAuth!.p} /><input type="hidden" name="exp" value={preparerDeleteAuth!.exp} /><input type="hidden" name="s" value={preparerDeleteAuth!.s} /><input type="hidden" name={line.source === "order" ? "eventId" : "miscEntryId"} value={line.id} /><input type="hidden" name="next" value={preparerDeleteNextUrl} />
                    <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border-2 border-rose-500 text-sm shadow-md hover:scale-105 transition-transform">🗑️</button>
                  </form>
                )}
                {orderHref && <Link href={orderHref} className="absolute inset-0 z-0" />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
