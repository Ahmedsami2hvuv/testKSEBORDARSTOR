"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  assignPendingOrderToCourier,
  rejectPendingOrder,
  type AssignOrderState,
  type RejectOrderState,
} from "../actions";
import {
  bulkUpdateOrdersStatus,
  type BulkOrdersState,
} from "../bulk-actions";
import { orderStatusPendingCardBorderBg } from "@/lib/order-status-style";
import { OrderTypeLine } from "@/components/order-type-line";
import { OrderStatusRadioGroup } from "@/components/order-status-radio-group";

export type PendingOrderRow = {
  id: string;
  orderNumber: number;
  routeMode: "single" | "double";
  shopName: string;
  regionName: string;
  orderType: string;
  customerOrderTime: string;
  createdAtLabel: string;
  summary: string;
  customerPhone: string;
  customerAlternatePhone: string;
  customerDoorPhotoUrl: string;
  totalAmount: string | null;
  deliveryPrice: string | null;
  submittedByName: string | null;
  submissionLabel: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
  /** لون تنبيه عند غياب لوكيشن الزبون */
  hasCustomerLocation: boolean;
  /** لوكيشن الزبون مرفوع من المندوب بزر GPS (customerLocationSetByCourierAt) */
  hasCourierUploadedLocation: boolean;
  /** طلب عكسي */
  reversePickup?: boolean;
};

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function PendingAssignPanel({
  orderId,
  couriers,
  customerPhone,
  customerAlternatePhone,
  defaultCustomerLocationUrl,
  defaultCustomerLandmark,
  defaultCustomerDoorPhotoUrl,
}: {
  orderId: string;
  couriers: { id: string; name: string }[];
  customerPhone: string;
  customerAlternatePhone: string;
  defaultCustomerLocationUrl: string;
  defaultCustomerLandmark: string;
  defaultCustomerDoorPhotoUrl: string;
}) {
  const bound = assignPendingOrderToCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);

  if (couriers.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        لا يوجد مندوبون — أضف مندوباً من{" "}
        <Link href="/admin/couriers" className="font-bold underline">
          المندوبين
        </Link>
        .
      </p>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-300";

  const locPrefill = defaultCustomerLocationUrl.trim();
  const altPhone = customerAlternatePhone.trim();
  const doorPhoto = defaultCustomerDoorPhotoUrl.trim();
  const canOpenLoc =
    locPrefill.startsWith("http://") ||
    locPrefill.startsWith("https://") ||
    locPrefill.startsWith("geo:");

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <p className="text-sm font-bold text-emerald-900">إسناد للمندوب</p>
      <p className="text-xs text-emerald-800/90">
        اختر المندوب، والصق أو عدّل <strong className="font-bold">رابط لوكيشن الزبون</strong>، ثم اضغط موافقة.
        يمكنك إضافة أقرب نقطة دالة أو صورة باب (اختياري).
      </p>
      <div className="rounded-lg border border-emerald-200 bg-white/80 p-2 text-xs text-slate-800">
        <p>
          <span className="font-semibold text-slate-600">رقم الزبون:</span>{" "}
          <span className="font-mono tabular-nums">{customerPhone || "—"}</span>
        </p>
        {altPhone ? (
          <p className="mt-1">
            <span className="font-semibold text-slate-600">الرقم الثاني:</span>{" "}
            <span className="font-mono tabular-nums">{altPhone}</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">لا يوجد رقم ثانٍ محفوظ لهذا الزبون.</p>
        )}
      </div>

      <div className="rounded-lg border border-emerald-200 bg-white/70 p-2">
        <p className="text-xs font-semibold text-slate-800">صورة باب الزبون</p>
        {doorPhoto ? (
          <a href={doorPhoto} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doorPhoto}
              alt="صورة باب الزبون"
              className="h-28 w-28 rounded-lg border border-emerald-200 object-cover"
            />
          </a>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">لا توجد صورة باب محفوظة لهذا الطلب.</p>
        )}
      </div>

      <OrderStatusRadioGroup
        name="courierId"
        defaultValue=""
        required
        legend="المندوب"
        legendClassName="text-xs font-semibold text-slate-800"
        options={couriers.map((c) => ({ value: c.id, label: c.name }))}
      />

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-800">
          رابط لوكيشن الزبون — يُنسَخ من الطلب في الخانة (يمكن تعديله)
        </span>
        {locPrefill ? (
          <div className="flex flex-wrap items-center gap-2">
            {canOpenLoc ? (
              <a
                href={locPrefill}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-sky-400 bg-sky-50 px-3 text-xs font-bold text-sky-900 shadow-sm hover:bg-sky-100"
              >
                فتح اللوكيشن للتحقق ↗
              </a>
            ) : null}
            <p className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900/90">
              <span className="font-semibold">من الطلب:</span>{" "}
              <span className="break-all font-mono">{locPrefill}</span>
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-950">
            لا يوجد رابط لوكيشن في الطلب — الصق رابطاً هنا إن توفّر لاحقاً.
          </p>
        )}
        <textarea
          name="customerLocationUrl"
          rows={3}
          defaultValue={locPrefill}
          placeholder="الصق رابط خرائط Google أو غيره (يُملأ تلقائياً من الطلب إن وُجد)"
          className={`${inputClass} resize-y font-mono text-xs`}
          dir="ltr"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-800">أقرب نقطة دالة (اختياري)</span>
        <input
          name="customerLandmark"
          defaultValue={defaultCustomerLandmark}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-800">صورة باب الزبون (اختياري)</span>
        <input
          name="customerDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-slate-700 file:me-2 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-2 file:py-1.5 file:text-xs file:font-bold file:text-white"
        />
      </label>

      {state.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? <span>…</span> : <CheckIcon />}
        {pending ? "جارٍ الإسناد…" : "موافقة وإسناد للمندوب"}
      </button>
    </form>
  );
}

function RejectButton({ orderId }: { orderId: string }) {
  const bound = rejectPendingOrder.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as RejectOrderState);

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
      >
        {pending ? "…" : "رفض"}
      </button>
      {state.error ? (
        <span className="mt-1 block text-[10px] text-rose-600" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function PendingOrdersClient({
  orders,
  couriers,
  initialAssignOrderId,
}: {
  orders: PendingOrderRow[];
  couriers: { id: string; name: string }[];
  initialAssignOrderId?: string | null;
}) {
  const router = useRouter();
  const [assignOpenId, setAssignOpenId] = useState<string | null>(() => {
    if (
      initialAssignOrderId &&
      orders.some((o) => o.id === initialAssignOrderId)
    ) {
      return initialAssignOrderId;
    }
    return null;
  });

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedCount = selected.size;
  const visibleIds = orders.map((o) => o.id);
  const allSelected =
    selectedCount > 0 && visibleIds.every((id) => selected.has(id));

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
  const selectedIdsArr = Array.from(selected);

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

  useEffect(() => {
    if (bulkState.ok) setSelected(new Set());
  }, [bulkState.ok]);

  return (
    <div className="space-y-2">
      {orders.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-white/60 px-3 py-2">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="تحديد الكل"
            />
            تحديد الكل
          </label>

          {selectedCount ? (
            <span className="text-xs font-bold text-sky-800 tabular-nums">
              تم اختيار {selectedCount}
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-500">اختر طلبات للقيام بإجراء جماعي</span>
          )}
        </div>
      ) : null}

      {selectedCount ? (
        <div className="rounded-2xl border border-sky-200 bg-white/70 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                إجراء جماعي على {selectedCount} طلب
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
                <span className="text-xs font-bold text-slate-600">
                  الحالة الجديدة
                </span>
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
                  <span className="text-xs font-bold text-slate-600">
                    المندوب
                  </span>
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

      {orders.map((o) => {
        const assignOpen = assignOpenId === o.id;
        return (
          <div
            key={o.id}
            className={`overflow-hidden rounded-xl border transition ${
              assignOpen ? "border-emerald-300 bg-emerald-50/20" : `${orderStatusPendingCardBorderBg()} hover:border-red-300`
            } ${
              o.reversePickup ? "border-violet-400 bg-violet-50/45 ring-2 ring-violet-200" : ""
            } ${
              !o.hasCustomerLocation
                ? "border-rose-400 bg-rose-50/50 ring-2 ring-rose-200"
                : ""
            }`}
          >
            <div
              role="link"
              tabIndex={0}
              className={`flex cursor-pointer flex-col gap-2 px-2 py-3 outline-none ring-sky-400 sm:flex-row sm:items-start sm:gap-3 sm:px-3 sm:py-2 ${
                assignOpen
                  ? "hover:bg-emerald-50/50 active:bg-emerald-100/60"
                  : "hover:bg-red-100/40 active:bg-red-100/70"
              }`}
              onClick={() => router.push(`/admin/orders/${o.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/admin/orders/${o.id}`);
                }
              }}
              aria-label={`عرض الطلب رقم ${o.orderNumber}`}
            >
              <div
                className="relative z-20 flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch sm:border-sky-100 sm:border-e sm:pe-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
              <label
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-white/70 text-sky-800 shadow-sm transition hover:bg-sky-50"
                aria-label={`تحديد الطلب ${o.orderNumber}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggleOne(o.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
                <button
                  type="button"
                  onClick={() =>
                    setAssignOpenId((id) => (id === o.id ? null : o.id))
                  }
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition ${
                    assignOpen
                      ? "border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-300"
                      : "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                  title="اختيار المندوب ولوكيشن الزبون"
                  aria-expanded={assignOpen}
                  aria-label="فتح إسناد الطلب للمندوب"
                >
                  <CheckIcon />
                </button>
                <Link
                  href={`/admin/orders/${o.id}/edit`}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-sky-50 text-sky-800 transition hover:bg-sky-100"
                  title="تعديل الطلب"
                  aria-label="تعديل الطلب"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <PencilIcon />
                </Link>
                <div className="sm:hidden">
                  <RejectButton orderId={o.id} />
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {!o.hasCustomerLocation ? (
                    <span className="shrink-0 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                      بدون لوكيشن
                    </span>
                  ) : null}
                  {o.hasCourierUploadedLocation ? (
                    <span
                      className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-800"
                      title="لوكيشن مرفوع من المندوب (GPS)"
                      aria-label="لوكيشن مرفوع من المندوب"
                    >
                      GPS
                    </span>
                  ) : null}
                  {o.reversePickup ? (
                    <span className="shrink-0 rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">
                      طلب عكسي
                    </span>
                  ) : null}
                  <span className="shrink-0 rounded-md bg-sky-100 px-2 py-0.5 text-sm font-black tabular-nums text-sky-900">
                    #{o.orderNumber}
                  </span>
                  <span className="min-w-0 break-words text-base font-bold leading-snug text-slate-900">
                    {o.shopName?.trim() || "—"}
                  </span>
                  {o.totalAmount != null ? (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-800">
                      {o.totalAmount}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                  <p className="min-w-0 break-words">
                    <span className="font-medium text-slate-500">منطقة الزبون: </span>
                    {o.regionName}
                  </p>
                  <p className="min-w-0 break-words">
                    <span className="font-medium text-slate-500">نوع الطلب: </span>
                    <OrderTypeLine
                      orderType={o.orderType}
                      restClassName="font-semibold text-emerald-900"
                    />
                    {o.routeMode === "double" ? (
                      <span className="ms-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                        وجهتين
                      </span>
                    ) : null}
                  </p>
                  <p className="min-w-0 break-words">
                    <span className="font-medium text-slate-500">وقت الطلب: </span>
                    {o.customerOrderTime}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500">
                    <span className="font-medium text-slate-400">أُضيف: </span>
                    {o.createdAtLabel}
                  </p>
                </div>
              </div>

              <div
                className="hidden shrink-0 items-start pt-0.5 sm:flex"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <RejectButton orderId={o.id} />
              </div>
            </div>

            {assignOpen ? (
              <div
                className="border-t border-emerald-200 bg-emerald-50/40 px-3 py-3"
                role="region"
                aria-label={`إسناد الطلب ${o.orderNumber}`}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <PendingAssignPanel
                  orderId={o.id}
                  couriers={couriers}
                  customerPhone={o.customerPhone}
                  customerAlternatePhone={o.customerAlternatePhone}
                  defaultCustomerLocationUrl={o.customerLocationUrl}
                  defaultCustomerLandmark={o.customerLandmark}
                  defaultCustomerDoorPhotoUrl={o.customerDoorPhotoUrl}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
