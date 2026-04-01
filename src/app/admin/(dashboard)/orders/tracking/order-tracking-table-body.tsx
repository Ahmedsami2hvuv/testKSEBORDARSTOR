"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { orderStatusRowClassInteractive } from "@/lib/order-status-style";
import { OrderTypeLine } from "@/components/order-type-line";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { EditPencilLink } from "./edit-pencil-link";

export type TrackingTableRow = {
  id: string;
  orderNumber: number;
  /** حالة الطلب الخام — لعرض زر الإسناد للـ pending */
  orderStatus: string;
  /** للتحديد السريع حسب المندوب في صفحة التتبع */
  assignedCourierId: string | null;
  shopCustomerLabel: string;
  regionName: string;
  orderType: string;
  routeModeLabel: string;
  totalLabel: string;
  deliveryLabel: string;
  customerPhone: string;
  courierName: string;
  missingCustomerLocation: boolean;
  /** لوكيشن الزبون مرفوع من المندوب بزر GPS (customerLocationSetByCourierAt) */
  hasCourierUploadedLocation: boolean;
};

function AssignCheckLink({ orderId }: { orderId: string }) {
  return (
    <Link
      href={`/admin/orders/pending?assignOrder=${encodeURIComponent(orderId)}`}
      title="إسناد للمندوب (الطلبات الجديدة)"
      aria-label="إسناد الطلب للمندوب"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500 bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </Link>
  );
}

export function OrderTrackingTableBody({ rows }: { rows: TrackingTableRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
          لا توجد طلبات مطابقة.
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((o) => (
        <tr
          key={o.id}
          role="link"
          tabIndex={0}
          className={`cursor-pointer border-b border-sky-100 transition ${orderStatusRowClassInteractive(o.orderStatus)}${
            o.missingCustomerLocation ? " ring-2 ring-inset ring-rose-400/60" : ""
          }`}
          onClick={() => router.push(`/admin/orders/${o.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(`/admin/orders/${o.id}`);
            }
          }}
        >
          <td
            className="px-2 py-2 text-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <EditPencilLink href={`/admin/orders/${o.id}/edit`} />
          </td>
          <td
            className="px-2 py-2 text-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {o.orderStatus === "pending" ? <AssignCheckLink orderId={o.id} /> : (
              <span className="inline-block h-9 w-9" aria-hidden />
            )}
          </td>
          <td className="px-2 py-2 font-mono font-bold tabular-nums text-sky-800">
            {o.missingCustomerLocation ? (
              <span className="me-1 inline-block rounded bg-rose-600 px-1 py-0.5 text-[9px] font-black text-white">
                !
              </span>
            ) : null}
            {o.hasCourierUploadedLocation ? (
              <span
                className="me-1 inline-block rounded bg-violet-600 px-1 py-0.5 text-[9px] font-black text-white"
                title="لوكيشن مرفوع من المندوب (GPS)"
                aria-label="لوكيشن مرفوع من المندوب"
              >
                GPS
              </span>
            ) : null}
            {o.orderNumber}
          </td>
          <td className="max-w-[14rem] px-2 py-2 text-sm text-slate-800">{o.shopCustomerLabel}</td>
          <td
            className={`max-w-[6rem] px-2 py-2 text-xs ${
              isReversePickupOrderType(o.orderType)
                ? "font-bold text-violet-900"
                : "text-slate-600"
            }`}
          >
            {o.regionName}
          </td>
          <td className="max-w-[10rem] px-2 py-2 text-xs text-slate-700">
            <OrderTypeLine orderType={o.orderType} className="text-xs text-slate-700" />
            {o.routeModeLabel ? (
              <span className="ms-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                {o.routeModeLabel}
              </span>
            ) : null}
          </td>
          <td className="px-2 py-2 font-mono tabular-nums text-slate-900">{o.totalLabel}</td>
          <td className="px-2 py-2 font-mono tabular-nums text-cyan-700">{o.deliveryLabel}</td>
          <td className="px-2 py-2 font-mono text-xs tabular-nums text-slate-700">{o.customerPhone}</td>
          <td className="max-w-[6rem] px-2 py-2 text-xs text-emerald-800">{o.courierName}</td>
        </tr>
      ))}
    </>
  );
}
