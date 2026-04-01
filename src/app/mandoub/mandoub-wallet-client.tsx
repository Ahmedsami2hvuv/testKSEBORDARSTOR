"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  moneyMiscSaderAmountInputClass,
  moneyMiscWardAmountInputClass,
  moneyTransferAmountInputClass,
  WALLET_LEDGER_VISIBLE_DAYS,
} from "@/lib/money-entry-ui";
import {
  isManualDeletionReason,
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";

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
  /** اسم المنطقة (لمعاملات الطلب فقط) */
  regionName?: string;
  /** ملخص/ملاحظات الطلب للعرض في بطاقة السجل (اختياري) */
  orderNotes?: string | null;
  /** معاملات «أخذت/أعطيت» خارج الطلبات */
  miscLabel: string | null;
  deletedAt: string | null;
  deletedReason: MandoubWalletDeletionReason;
  deletedByDisplayName: string | null;
  /** المبلغ المفروض (اختياري لمعاملات الطلب فقط) */
  expectedDinar?: number | null;
  /** هل المبلغ مطابق للمفروض (اختياري لمعاملات الطلب فقط) */
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
/** المجهز في المحل (جدول Employee) — ليس الزبون (Customer) */
export type TransferTargetEmployeeUi = {
  id: string;
  name: string;
  shopName: string;
  phone: string;
};

function buildOrderHref(auth: { c: string; exp: string; s: string }, orderId: string) {
  const p = new URLSearchParams();
  if (auth.c) p.set("c", auth.c);
  if (auth.exp) p.set("exp", auth.exp);
  if (auth.s) p.set("s", auth.s);
  p.set("tab", "all");
  return `/mandoub/order/${orderId}?${p.toString()}`;
}

function deletionCaption(reason: MandoubWalletDeletionReason, by: string | null): string {
  if (reason === "status_revert") return "أُلغيت تلقائياً عند تغيير حالة الطلب";
  if (isManualDeletionReason(reason)) {
    const who = by?.trim() || "—";
    return `محذوف يدوياً — بواسطة: ${who}`;
  }
  if (reason) return "محذوف";
  return "";
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

function orderMoneyIndicator(line: MandoubWalletLedgerLine): string | null {
  if (line.expectedDinar == null) return null;
  const expected = line.expectedDinar;
  const amount = line.amountDinar;
  if (line.matchesExpected === true) return "✅";
  if (amount > expected) return "⬆️";
  if (amount < expected) return "⬇️";
  return "✅";
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
  ledger,
  pendingIncoming,
  transferTargetCouriers,
  transferTargetEmployees,
  availableForTransferStr,
  pendingOutgoingCount,
}: {
  auth: { c: string; exp: string; s: string };
  walletPathWithQuery: string;
  walletLedgerHrefs: { site: string; ward: string; sader: string; all: string };
  ledgerFilter: MandoubLedgerFilter;
  /** متبقي من الطلبات (وارد الطلبات − صادر الطلبات) للفترة */
  siteRemainingNetStr: string;
  /** وارد المحفظة: أخذت + تحويل وارد معلّق */
  walletInFromWalletStr: string;
  /** صادر المحفظة: أعطيت + تحويل صادر معلّق */
  walletOutFromWalletStr: string;
  sumEarningsStr: string;
  walletRemainStr: string;
  /** متبقي المحفظة − أرباحي */
  handToAdminStr: string;
  ledger: MandoubWalletLedgerLine[];
  pendingIncoming: PendingIncomingTransferUi[];
  transferTargetCouriers: TransferTargetCourierUi[];
  transferTargetEmployees: TransferTargetEmployeeUi[];
  availableForTransferStr: string;
  pendingOutgoingCount: number;
}) {
  const router = useRouter();
  const [miscPanel, setMiscPanel] = useState<null | "take" | "give">(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [toKind, setToKind] = useState<"" | "courier" | "employee" | "admin">("");
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeleteMandoubMoneyEvent,
    initialCash,
  );
  const [miscDelState, miscDelAction, miscDelPending] = useActionState(
    softDeleteMandoubMiscWalletEntry,
    initialCash,
  );
  const [miscSubmitState, miscSubmitAction, miscSubmitPending] = useActionState(
    submitMandoubMiscWalletEntry,
    initialCash,
  );
  const [createState, createAction, createPending] = useActionState(
    createWalletPeerTransferFromCourier,
    initialTransfer,
  );
  const [respondState, respondAction, respondPending] = useActionState(
    respondWalletPeerTransferByCourier,
    initialTransfer,
  );

  const errMsg =
    deleteState.error ||
    miscDelState.error ||
    miscSubmitState.error ||
    createState.error ||
    respondState.error ||
    null;

  return (
    <div className="space-y-5">
      {pendingIncoming.length > 0 ? (
        <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 sm:px-4">
          <p className="text-base font-black text-slate-900 sm:text-lg">
            لديك {pendingIncoming.length} تحويل{pendingIncoming.length > 1 ? "ات" : ""} بانتظار موافقتك
          </p>
          <ul className="mt-3 space-y-3">
            {pendingIncoming.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4">
                <p className="text-base font-bold text-slate-900">
                  <span className={moneyLedgerAmountClass}>
                    {formatDinarAsAlfWithUnit(p.amountDinar)}
                  </span>{" "}
                  — من {p.fromLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  مكان التسليم: {p.handoverLocation}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(p.createdAt).toLocaleString("ar-IQ-u-nu-latn", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={respondAction}>
                    <input type="hidden" name="c" value={auth.c} />
                    <input type="hidden" name="exp" value={auth.exp} />
                    <input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="next" value={walletPathWithQuery} />
                    <input type="hidden" name="transferId" value={p.id} />
                    <input type="hidden" name="accept" value="1" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className="min-h-[44px] rounded-xl border border-slate-400 bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                    >
                      قبول
                    </button>
                  </form>
                  <form action={respondAction}>
                    <input type="hidden" name="c" value={auth.c} />
                    <input type="hidden" name="exp" value={auth.exp} />
                    <input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="next" value={walletPathWithQuery} />
                    <input type="hidden" name="transferId" value={p.id} />
                    <input type="hidden" name="accept" value="0" />
                    <button
                      type="submit"
                      disabled={respondPending}
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      رفض
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {errMsg ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {errMsg}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Link
            href={walletLedgerHrefs.site}
            className={`kse-glass-dark block rounded-xl border p-2.5 shadow-sm transition sm:p-4 ${
              ledgerFilter === "site"
                ? "border-slate-500 bg-slate-100"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
            title="عرض حركات الطلبات من الموقع فقط"
          >
            <p className="text-sm font-bold text-slate-800 sm:text-base">الموقع</p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl">
              {siteRemainingNetStr}
            </p>
          </Link>
          <Link
            href={walletLedgerHrefs.ward}
            className={`kse-glass-dark block rounded-xl border p-2.5 shadow-sm transition sm:p-4 ${
              ledgerFilter === "ward"
                ? "border-slate-500 bg-slate-100"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
            title="عرض وارد المحفظة فقط (أخذت + تحويل وارد معلّق)"
          >
            <p className="text-sm font-bold text-slate-800 sm:text-base">وارد المحفظة</p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl">
              {walletInFromWalletStr}
            </p>
          </Link>
          <Link
            href={walletLedgerHrefs.sader}
            className={`kse-glass-dark block rounded-xl border p-2.5 shadow-sm transition sm:p-4 ${
              ledgerFilter === "sader"
                ? "border-slate-500 bg-slate-100"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
            title="عرض صادر المحفظة فقط (أعطيت + تحويل صادر معلّق)"
          >
            <p className="text-sm font-bold text-slate-800 sm:text-base">صادر المحفظة</p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl">
              {walletOutFromWalletStr}
            </p>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="kse-glass-dark border border-slate-300 bg-white p-2.5 shadow-sm sm:p-4">
            <p className="text-sm font-bold text-slate-800 sm:text-base">أرباحي</p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl">
              {sumEarningsStr}
            </p>
          </div>
          <div className="kse-glass-dark border border-slate-300 bg-white p-2.5 shadow-sm sm:p-4">
            <p className="text-sm font-bold text-slate-800 sm:text-base">متبقي المحفظة</p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900 sm:text-2xl">
              {walletRemainStr}
            </p>
          </div>
          <div className="kse-glass-dark border border-slate-300 bg-white p-2.5 shadow-sm sm:p-4 text-center">
            <p className="text-sm font-bold text-slate-800 sm:text-base">للإدارة</p>
            <p className="mt-1 text-lg font-black tabular-nums text-indigo-700 sm:text-2xl">
              {handToAdminStr}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-indigo-50/30 px-3 py-3 sm:px-4">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">أخذت · تحويل · أعطيت</h2>
        <p className="mt-2 text-xs font-bold text-slate-800 sm:text-sm">
          متاح للتحويل (صافٍ):{" "}
          <span className="tabular-nums text-slate-900">{availableForTransferStr}</span>
          {pendingOutgoingCount > 0 ? (
            <span className="ms-2 text-amber-800">— معلّق صادر: {pendingOutgoingCount}</span>
          ) : null}
        </p>
        <div className="mt-3 flex w-full gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setTransferOpen(false);
              setMiscPanel((p) => (p === "take" ? null : "take"));
            }}
            className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition sm:min-h-[44px] sm:px-4 ${
              miscPanel === "take"
                ? "border-red-600 bg-red-600 text-white ring-2 ring-red-300"
                : "border-red-500 bg-white text-red-900 hover:bg-red-50"
            }`}
          >
            أخذت
          </button>
          <button
            type="button"
            onClick={() => {
              setMiscPanel(null);
              setTransferOpen((o) => !o);
            }}
            className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition sm:min-h-[44px] sm:px-4 ${
              transferOpen
                ? "border-violet-600 bg-violet-600 text-white ring-2 ring-violet-300"
                : "border-violet-500 bg-violet-100 text-violet-950 hover:bg-violet-200/90"
            }`}
          >
            تحويل
          </button>
          <button
            type="button"
            onClick={() => {
              setTransferOpen(false);
              setMiscPanel((p) => (p === "give" ? null : "give"));
            }}
            className={`min-h-[48px] flex-1 rounded-xl border-2 px-2 py-2.5 text-base font-black shadow-sm transition sm:min-h-[44px] sm:px-4 ${
              miscPanel === "give"
                ? "border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-300"
                : "border-emerald-600 bg-white text-emerald-900 hover:bg-emerald-50"
            }`}
          >
            أعطيت
          </button>
        </div>
        {miscPanel === "take" || miscPanel === "give" ? (
          <form
            action={miscSubmitAction}
            className={`mt-4 space-y-3 rounded-xl border-2 p-3 shadow-sm ${
              miscPanel === "take"
                ? "border-red-500 bg-red-100/90"
                : "border-emerald-600 bg-lime-100/90"
            }`}
          >
            <input type="hidden" name="c" value={auth.c} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="next" value={walletPathWithQuery} />
            <input type="hidden" name="direction" value={miscPanel} />
            <label className="block text-sm font-bold text-slate-800">
              المبلغ (دينار) <span className="text-rose-600">*</span>
              <input
                name="amountAlf"
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className={`mt-1 ${
                  miscPanel === "take" ? moneyMiscWardAmountInputClass : moneyMiscSaderAmountInputClass
                }`}
              />
            </label>
            <label className="block text-sm font-bold text-slate-800">
              اسم المعاملة <span className="text-rose-600">*</span>
              <input
                name="label"
                required
                maxLength={200}
                autoComplete="off"
                placeholder="مثال: تحويل من الإدارة، تسديد لزبون…"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={miscSubmitPending}
              className="w-full rounded-xl border-2 border-indigo-600 bg-indigo-600 py-3 text-base font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {miscSubmitPending
                ? "جارٍ الحفظ…"
                : miscPanel === "take"
                  ? "تسجيل «أخذت»"
                  : "تسجيل «أعطيت»"}
            </button>
          </form>
        ) : null}
        {transferOpen ? (
          <form
            action={createAction}
            className="mt-4 space-y-3 rounded-xl border border-violet-200/90 bg-violet-50/95 p-3 shadow-sm"
          >
            <input type="hidden" name="c" value={auth.c} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="next" value={walletPathWithQuery} />

            <fieldset>
              <legend className="text-sm font-bold text-slate-800">المستلم</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["courier", "مندوب"],
                    ["employee", "مجهز"],
                    ["admin", "الإدارة"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
                      toKind === value
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-violet-200/90 bg-violet-100/80 text-violet-950"
                    }`}
                  >
                    <input
                      type="radio"
                      name="toKind"
                      value={value}
                      className="sr-only"
                      checked={toKind === value}
                      onChange={() => setToKind(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {toKind === "courier" ? (
              <label className="block text-sm font-bold text-slate-800">
                اختر المندوب <span className="text-rose-600">*</span>
                <select
                  name="toCourierId"
                  required
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
                  defaultValue=""
                >
                  <option value="" disabled>
                    — اختر مندوباً —
                  </option>
                  {transferTargetCouriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {toKind === "employee" ? (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">
                  اختر المجهز <span className="text-rose-600">*</span>
                  <select
                    name="toEmployeeId"
                    required
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      — اختر مجهزاً —
                    </option>
                    {transferTargetEmployees.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.name} · {em.shopName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <label className="block text-sm font-bold text-slate-800">
              مكان التسليم <span className="text-rose-600">*</span>
              <input
                name="handoverLocation"
                required
                maxLength={500}
                autoComplete="off"
                placeholder="مثال: أمام المحل، مستودع المنطقة…"
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base font-medium text-slate-900"
              />
            </label>

            <label className="block text-sm font-bold text-slate-800">
              المبلغ (دينار) <span className="text-rose-600">*</span>
              <input
                name="amountAlf"
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className={moneyTransferAmountInputClass}
              />
            </label>

            <button
              type="submit"
              disabled={createPending || !toKind}
              className="w-full rounded-xl border-2 border-violet-700 bg-violet-700 py-3 text-base font-black text-white shadow-sm hover:bg-violet-800 disabled:opacity-60"
            >
              {createPending ? "جارٍ الإرسال…" : "إرسال التحويل"}
            </button>
          </form>
        ) : null}
      </div>

      <div>
        {ledgerFilter !== "all" ? (
          <p className="mb-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2 py-1.5 text-xs font-semibold text-slate-800 sm:text-sm">
            العرض:{" "}
            {ledgerFilter === "ward"
              ? "وارد المحفظة فقط (أخذت، تحويل وارد معلّق)"
              : ledgerFilter === "sader"
                ? "صادر المحفظة فقط (أعطيت، تحويل صادر معلّق)"
                : "حركات الطلبات من الموقع فقط"}{" "}
            —{" "}
            <Link href={walletLedgerHrefs.all} className="font-bold text-sky-700 underline">
              عرض الكل
            </Link>
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
              const isXferPendingIn = line.kind === LEDGER_KIND_TRANSFER_PENDING_IN;
              const isXferPendingOut = line.kind === LEDGER_KIND_TRANSFER_PENDING_OUT;
              const dirLabel = ledgerDirLabel(line);
              const delCap = deletionCaption(line.deletedReason, line.deletedByDisplayName);
              const href = buildOrderHref(auth, line.orderId);
              const isOrder = line.source === "order";

              // حماية التحويلات المقبولة من الحذف
              // التحويلات المسجلة كـ miscLabel تحتوي عادة على كلمة "تحويل"
              const isPermanentTransfer = line.miscLabel?.includes("تحويل") || line.source === "transfer_pending";

              return (
                <li key={`${line.source}-${line.id}`}>
                  <div
                    className={`relative flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-stretch sm:px-4 ${
                      deleted
                        ? "border-slate-300 bg-slate-100/90 text-slate-600"
                        : "border-slate-300 bg-white text-slate-900 shadow-sm"
                    }`}
                  >
                    {isOrder ? (
                      <button
                        type="button"
                        className={`min-w-0 flex-1 rounded-lg p-2 pl-10 text-right transition hover:bg-white/40 ${
                          deleted ? "line-through decoration-slate-400" : ""
                        }`}
                        onClick={() => router.push(href)}
                      >
                        <p className="text-base font-bold text-slate-900 sm:text-lg">
                          {dirLabel} ·{" "}
                          <span className={moneyLedgerAmountClass}>
                            {formatDinarAsAlfWithUnit(line.amountDinar)}
                          </span>
                          <span className="ms-2 text-[11px] font-semibold text-slate-600 sm:text-xs">
                            {new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800 sm:text-base">
                          طلب <span className="tabular-nums">{line.orderNumber}</span> — {line.shopName}
                          {line.regionName ? ` · ${line.regionName}` : null}
                        </p>
                        {deleted && delCap ? (
                          <p className="mt-2 text-xs font-bold text-rose-800 sm:text-sm">{delCap}</p>
                        ) : null}
                      </button>
                    ) : (
                      <div
                        className={`min-w-0 flex-1 rounded-lg p-2 pl-10 text-right ${
                          deleted ? "line-through decoration-slate-400" : ""
                        }`}
                      >
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
                            ? isXferPendingIn
                              ? "تحويل أموال — بانتظار موافقتك"
                              : "تحويل أموال — بانتظار المستلم"
                            : "خارج الطلبات"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                          {new Date(line.createdAt).toLocaleString("ar-IQ-u-nu-latn", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        {deleted && delCap ? (
                          <p className="mt-2 text-xs font-bold text-rose-800 sm:text-sm">{delCap}</p>
                        ) : null}
                      </div>
                    )}
                    {!deleted && !isPermanentTransfer ? (
                      isOrder ? (
                        <form
                          action={deleteAction}
                          className="absolute left-2 top-2 sm:left-3 sm:top-3"
                          onSubmit={(e) => {
                            if (
                              !window.confirm(
                                `تأكيد مسح حركة «${dirLabel}» بمبلغ ${formatDinarAsAlfWithUnit(line.amountDinar)}؟ تُلغى من المحفظة ومن الطلب معاً، وقد تتغيّر حالة الطلب.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="c" value={auth.c} />
                          <input type="hidden" name="exp" value={auth.exp} />
                          <input type="hidden" name="s" value={auth.s} />
                          <input type="hidden" name="eventId" value={line.id} />
                          <input type="hidden" name="next" value={walletPathWithQuery} />
                          <button
                            type="submit"
                            disabled={deletePending}
                            aria-label="حذف الحركة من المحفظة والطلب"
                            title="حذف الحركة من المحفظة والطلب"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500 bg-white text-sm leading-none shadow-sm hover:bg-rose-50 disabled:opacity-60 sm:h-9 sm:w-9 sm:text-base"
                          >
                            🗑️
                          </button>
                        </form>
                      ) : (
                        <form
                          action={miscDelAction}
                          className="absolute left-2 top-2 sm:left-3 sm:top-3"
                          onSubmit={(e) => {
                            if (
                              !window.confirm(
                                `تأكيد مسح «${dirLabel}» — ${line.miscLabel ?? ""} — بمبلغ ${formatDinarAsAlfWithUnit(line.amountDinar)}؟ تُلغى من المحفظة فقط.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="c" value={auth.c} />
                          <input type="hidden" name="exp" value={auth.exp} />
                          <input type="hidden" name="s" value={auth.s} />
                          <input type="hidden" name="miscEntryId" value={line.id} />
                          <input type="hidden" name="next" value={walletPathWithQuery} />
                          <button
                            type="submit"
                            disabled={miscDelPending}
                            aria-label="حذف المعاملة من المحفظة"
                            title="حذف المعاملة من المحفظة"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500 bg-white text-sm leading-none shadow-sm hover:bg-rose-50 disabled:opacity-60 sm:h-9 sm:w-9 sm:text-base"
                          >
                            🗑️
                          </button>
                        </form>
                      )
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
