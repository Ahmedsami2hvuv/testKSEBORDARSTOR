"use client";

import Link from "next/link";
import { useActionState } from "react";
import { softDeletePreparerMoneyEvent, type PreparerCashState } from "@/app/preparer/preparer-cash-actions";
import * as PreparerWalletActions from "@/app/preparer/wallet/actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { moneyLedgerAmountClass, WALLET_LEDGER_VISIBLE_DAYS } from "@/lib/money-entry-ui";
import {
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import type { MandoubWalletLedgerLine } from "@/app/mandoub/mandoub-wallet-client";

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

/** مطابقة المبلغ للمفروض — نفس منطق محفظة المندوب */
function orderMoneyIndicator(line: MandoubWalletLedgerLine): string | null {
  if (line.expectedDinar == null) return null;
  const expected = line.expectedDinar;
  const amount = line.amountDinar;
  if (line.matchesExpected === true) return "✅";
  if (amount > expected) return "⬆️";
  if (amount < expected) return "⬇️";
  return "✅";
}

const LEDGER_ORDER_ICON_BOX =
  "flex h-8 w-8 shrink-0 items-center justify-center sm:h-9 sm:w-9";
const LEDGER_ORDER_ICON_TEXT = "text-2xl leading-none sm:text-[1.75rem]";

export function PreparerWalletClient({
  walletInStr,
  walletOutStr,
  walletRemainStr,
  dailySalaryStr,
  monthlySalaryStr,
  ledger,
  hideWalletSummary = false,
  orderLinkAuth,
  preparerDeleteAuth,
  preparerDeleteNextUrl,
}: {
  walletInStr?: string;
  walletOutStr?: string;
  walletRemainStr?: string;
  dailySalaryStr?: string;
  monthlySalaryStr?: string;
  ledger: MandoubWalletLedgerLine[];
  /** إخفاء مربعات الملخص العلوية (مثلاً محفظة المجهز حيث تُعرض الأرقام مع الأزرار في قسم التحويل) */
  hideWalletSummary?: boolean;
  /** تفعيل فتح الطلب عند النقر على سطر الفاتورة/الطلب */
  orderLinkAuth?: { p: string; exp: string; s: string };
  /** مع رابط العودة بعد الحذف — يفعّل زر مسح حركات الطلب المسجّلة من المجهز */
  preparerDeleteAuth?: { p: string; exp: string; s: string };
  preparerDeleteNextUrl?: string;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeletePreparerMoneyEvent,
    initialDelete,
  );
  const [deleteMiscState, deleteMiscAction, deleteMiscPending] = useActionState(
    PreparerWalletActions.softDeleteEmployeeWalletMiscEntryFromCompanyPreparer,
    initialMiscDelete,
  );
  const canDeleteOrderLines = Boolean(
    preparerDeleteAuth && preparerDeleteNextUrl?.trim(),
  );

  const showFullSummary =
    !hideWalletSummary &&
    walletInStr &&
    walletOutStr &&
    dailySalaryStr &&
    monthlySalaryStr;
  const showSimpleBalance =
    !hideWalletSummary && !showFullSummary && walletRemainStr;

  return (
    <div className="space-y-5">
      {showFullSummary ? (
        <div className="kse-glass-dark border border-violet-200/90 p-4 shadow-sm sm:p-5">
          <p className="text-base font-bold text-violet-900 sm:text-lg">ملخص المحفظة</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-red-200 bg-red-50/90 p-3">
              <p className="text-xs font-bold text-red-900 sm:text-sm">وارد</p>
              <p className="mt-1 text-xl font-black tabular-nums text-red-950 sm:text-2xl">{walletInStr}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3">
              <p className="text-xs font-bold text-emerald-900 sm:text-sm">صادر</p>
              <p className="mt-1 text-xl font-black tabular-nums text-emerald-950 sm:text-2xl">{walletOutStr}</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/90 p-3">
              <p className="text-xs font-bold text-violet-900 sm:text-sm">متبقي</p>
              <p className="mt-1 text-xl font-black tabular-nums text-violet-950 sm:text-2xl">{walletRemainStr}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3">
              <p className="text-xs font-bold text-amber-900 sm:text-sm">راتب يومي</p>
              <p className="mt-1 text-xl font-black tabular-nums text-amber-950 sm:text-2xl">{dailySalaryStr}</p>
            </div>
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 sm:col-span-2">
              <p className="text-xs font-bold text-emerald-900 sm:text-sm">راتب شهري</p>
              <p className="mt-1 text-xl font-black tabular-nums text-emerald-950 sm:text-2xl">{monthlySalaryStr}</p>
            </div>
          </div>
        </div>
      ) : showSimpleBalance ? (
        <div className="kse-glass-dark border border-violet-300 p-4 shadow-sm sm:p-5">
          <p className="text-base font-bold text-violet-900 sm:text-lg">رصيد المحفظة</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-violet-950 sm:text-3xl">{walletRemainStr}</p>
        </div>
      ) : null}

      <div>
        {deleteState.error || deleteMiscState.error ? (
          <p className="mb-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
            {deleteState.error || deleteMiscState.error}
          </p>
        ) : null}
        <ul className="space-y-3">
          {ledger.length === 0 ? (
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-600">
              لا توجد حركات في آخر {WALLET_LEDGER_VISIBLE_DAYS} أيام ضمن هذا العرض.
            </li>
          ) : (
            ledger.map((line) => {
              const deleted = line.deletedAt != null;
              const isOrderPickup = line.source === "order" && line.kind === MONEY_KIND_PICKUP;
              const isOrderDelivery = line.source === "order" && line.kind === MONEY_KIND_DELIVERY;
              const isMiscGive = line.kind === MISC_LEDGER_KIND_GIVE;
              const isMiscTake = line.kind === MISC_LEDGER_KIND_TAKE;
              const isXferPendingOut = line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT;
              const isXferPendingIn = line.kind === LEDGER_KIND_TRANSFER_PENDING_IN;
              const isOutPick = isOrderPickup || isMiscGive || isXferPendingOut;
              const isInPick = isOrderDelivery || isMiscTake || isXferPendingIn;
              const dirLabel = ledgerDirLabel(line);

              const showOrderDelete =
                canDeleteOrderLines && line.source === "order" && !deleted && preparerDeleteAuth && preparerDeleteNextUrl;
              const showMiscDelete =
                canDeleteOrderLines &&
                line.source === "misc" &&
                !deleted &&
                (line.kind === MISC_LEDGER_KIND_TAKE || line.kind === MISC_LEDGER_KIND_GIVE) &&
                preparerDeleteAuth &&
                preparerDeleteNextUrl;
              const showDeleteButton = showOrderDelete || showMiscDelete;
              const canOpenOrder = Boolean(orderLinkAuth && line.orderId);
              const orderHref = canOpenOrder
                ? `/preparer/order/${line.orderId}?${new URLSearchParams({
                    p: orderLinkAuth!.p,
                    exp: orderLinkAuth!.exp,
                    s: orderLinkAuth!.s,
                  }).toString()}`
                : "";

              const isOrderLine = line.source === "order";
              const isShoppingPrepInvoiceLine =
                line.source === "misc" &&
                Boolean(
                  line.miscLabel?.trim().startsWith("رقم الطلب:") ||
                    line.miscLabel?.includes("صادر المبلغ تجهيز تسوق") ||
                    line.miscLabel?.includes("فاتورة شراء طلبية تجهيز") ||
                    line.miscLabel?.includes("فرق تعديل شراء طلبية تجهيز") ||
                    (line.miscLabel?.includes("المنطقة:") && line.miscLabel?.includes("طلب #")),
                );
              const showMoneyIcon = isOrderLine && line.expectedDinar != null;
              const moneyIcon = showMoneyIcon ? orderMoneyIndicator(line) : null;
              const dateStr = new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", {
                dateStyle: "medium",
                timeStyle: "short",
              });

              const padClass = (() => {
                if (!isOrderLine) {
                  return showDeleteButton ? "p-2 pe-10 sm:pe-12" : "p-2";
                }
                if (showOrderDelete && moneyIcon) return "p-2 pe-28 text-right sm:pe-32";
                if (showOrderDelete) return "p-2 pe-10 text-right sm:pe-12";
                if (moneyIcon) return "p-2 pe-14 text-right sm:pe-16";
                return "p-2 text-right";
              })();

              const orderBlock = (
                <>
                  <p className="text-base font-bold text-slate-900 sm:text-lg">
                    {dirLabel} ·{" "}
                    <span className={moneyLedgerAmountClass}>
                      {formatDinarAsAlfWithUnit(line.amountDinar)}
                    </span>
                    <span className="ms-2 text-[11px] font-semibold text-slate-600 sm:text-xs">{dateStr}</span>
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800 sm:text-base">
                    طلب <span className="tabular-nums">{line.orderNumber}</span> — {line.shopName}
                    {line.regionName ? ` · ${line.regionName}` : null}
                  </p>
                  {line.orderNotes?.trim() ? (
                    <p className="mt-1 text-sm font-semibold text-slate-700 sm:text-base">
                      الملاحظات: {line.orderNotes}
                    </p>
                  ) : null}
                </>
              );

              return (
                <li key={`${line.source}-${line.id}`}>
                  <div
                    className={`relative flex flex-col gap-3 rounded-xl border-2 px-3 py-3 sm:flex-row sm:items-stretch sm:px-4 ${
                      deleted
                        ? "border-slate-300 bg-slate-100/90 text-slate-600"
                        : isOutPick
                          ? "border-emerald-600 bg-lime-200/90 text-emerald-950 shadow-sm"
                          : isInPick
                            ? "border-red-600 bg-red-300/90 text-red-950 shadow-sm"
                            : "border-slate-200 bg-slate-50/90"
                    }`}
                  >
                    {moneyIcon ? (
                      <div
                        className={`absolute left-2 top-2 ${LEDGER_ORDER_ICON_BOX}`}
                        aria-hidden
                        title={
                          line.matchesExpected === true
                            ? "المبلغ مطابق للمفروض"
                            : line.amountDinar > (line.expectedDinar ?? 0)
                              ? "المعاملة أكبر من المبلغ المفروض"
                              : "المعاملة أقل من المبلغ المفروض"
                        }
                      >
                        <span className={LEDGER_ORDER_ICON_TEXT}>{moneyIcon}</span>
                      </div>
                    ) : null}

                    <div className={`min-w-0 flex-1 ${deleted ? "line-through decoration-slate-400" : ""}`}>
                      {isOrderLine ? (
                        canOpenOrder ? (
                          <Link
                            href={orderHref}
                            className={`block rounded-lg transition hover:bg-white/40 ${padClass}`}
                          >
                            {orderBlock}
                          </Link>
                        ) : (
                          <div className={`rounded-lg ${padClass}`}>{orderBlock}</div>
                        )
                      ) : canOpenOrder ? (
                        <Link
                          href={orderHref}
                          className="block rounded-lg p-2 pe-10 text-right transition hover:bg-white/40 sm:pe-12"
                          title="فتح الطلب"
                        >
                          {isShoppingPrepInvoiceLine ? (
                            <>
                              <p className="text-base font-bold text-slate-900 sm:text-lg">
                                {dirLabel} ·{" "}
                                <span className={moneyLedgerAmountClass}>
                                  {formatDinarAsAlfWithUnit(line.amountDinar)}
                                </span>{" "}
                                <span className="font-bold text-slate-900">
                                  طلبية تسوق
                                  {line.regionName?.trim() ? ` ${line.regionName.trim()}` : ""}
                                </span>
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800 sm:text-base">
                                {line.miscLabel ?? "—"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-base font-bold text-slate-900 sm:text-lg">
                                {dirLabel} ·{" "}
                                <span className={moneyLedgerAmountClass}>
                                  {formatDinarAsAlfWithUnit(line.amountDinar)}
                                </span>
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800 sm:text-base">
                                {line.miscLabel ?? "—"}
                              </p>
                              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">افتح الطلب</p>
                              <p className="mt-1 text-xs text-slate-600 sm:text-sm">{dateStr}</p>
                            </>
                          )}
                        </Link>
                      ) : (
                        <div className="rounded-lg p-2 pe-10 text-right sm:pe-12">
                          {isShoppingPrepInvoiceLine ? (
                            <>
                              <p className="text-base font-bold text-slate-900 sm:text-lg">
                                {dirLabel} ·{" "}
                                <span className={moneyLedgerAmountClass}>
                                  {formatDinarAsAlfWithUnit(line.amountDinar)}
                                </span>{" "}
                                <span className="font-bold text-slate-900">
                                  طلبية تسوق
                                  {line.regionName?.trim() ? ` ${line.regionName.trim()}` : ""}
                                </span>
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800 sm:text-base">
                                {line.miscLabel ?? "—"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-base font-bold text-slate-900 sm:text-lg">
                                {dirLabel} ·{" "}
                                <span className={moneyLedgerAmountClass}>
                                  {formatDinarAsAlfWithUnit(line.amountDinar)}
                                </span>
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800 sm:text-base">
                                {line.miscLabel ?? "—"}
                              </p>
                              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                {line.source === "transfer_pending"
                                  ? line.kind === LEDGER_KIND_TRANSFER_PENDING_IN
                                    ? "تحويل أموال — بانتظار موافقتك"
                                    : "تحويل أموال — بانتظار المستلم"
                                  : "معاملة محفظة"}
                              </p>
                              <p className="mt-1 text-xs text-slate-600 sm:text-sm">{dateStr}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {showOrderDelete ? (
                      <form
                        action={deleteAction}
                        className={`absolute top-2 ${moneyIcon ? "left-14 sm:left-14" : "left-2 sm:left-3"}`}
                        onSubmit={(e) => {
                          if (
                            !window.confirm(
                              `تأكيد مسح «${dirLabel}» بمبلغ ${formatDinarAsAlfWithUnit(line.amountDinar)}؟ تُلغى من المحفظة ومن الطلب، وقد تتغيّر حالة الطلب.`,
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="p" value={preparerDeleteAuth.p} />
                        <input type="hidden" name="exp" value={preparerDeleteAuth.exp} />
                        <input type="hidden" name="s" value={preparerDeleteAuth.s} />
                        <input type="hidden" name="eventId" value={line.id} />
                        <input type="hidden" name="next" value={preparerDeleteNextUrl} />
                        <button
                          type="submit"
                          disabled={deletePending}
                          aria-label="مسح الحركة من المحفظة والطلب"
                          title="مسح الحركة من المحفظة والطلب"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500 bg-white text-sm leading-none shadow-sm hover:bg-rose-50 disabled:opacity-60 sm:h-9 sm:w-9 sm:text-base"
                        >
                          🗑️
                        </button>
                      </form>
                    ) : showMiscDelete ? (
                      <form
                        action={deleteMiscAction}
                        className="absolute left-2 top-2 sm:left-3"
                        onSubmit={(e) => {
                          if (
                            !window.confirm(
                              `تأكيد مسح معاملة «${dirLabel}» بمبلغ ${formatDinarAsAlfWithUnit(line.amountDinar)}؟`,
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="p" value={preparerDeleteAuth.p} />
                        <input type="hidden" name="exp" value={preparerDeleteAuth.exp} />
                        <input type="hidden" name="s" value={preparerDeleteAuth.s} />
                        <input type="hidden" name="miscEntryId" value={line.id} />
                        <input type="hidden" name="next" value={preparerDeleteNextUrl} />
                        <button
                          type="submit"
                          disabled={deleteMiscPending}
                          aria-label="مسح معاملة أخذت/أعطيت"
                          title="مسح معاملة أخذت/أعطيت"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500 bg-white text-sm leading-none shadow-sm hover:bg-rose-50 disabled:opacity-60 sm:h-9 sm:w-9 sm:text-base"
                        >
                          🗑️
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
