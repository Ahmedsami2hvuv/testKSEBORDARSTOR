"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { setStoreOrderStatus, type StoreOrderAdminState } from "./actions";

export function StoreOrderStatusActions({
  id,
  current,
}: {
  id: string;
  current: "pending" | "confirmed" | "cancelled";
}) {
  const [state, action, pending] = useActionState<StoreOrderAdminState, FormData>(
    setStoreOrderStatus,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={current}
        className={`${ad.select} text-sm`}
        disabled={pending}
      >
        <option value="pending">pending</option>
        <option value="confirmed">confirmed</option>
        <option value="cancelled">cancelled</option>
      </select>
      <button type="submit" className={ad.btnDark} disabled={pending}>
        حفظ
      </button>
      {state?.error ? <span className={ad.error}>{state.error}</span> : null}
      {state?.ok ? <span className={ad.success}>تم.</span> : null}
    </form>
  );
}

