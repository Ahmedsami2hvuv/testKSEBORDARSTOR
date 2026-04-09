"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import {
  uploadCustomerDoorPhotoFromView,
  deleteCustomerDoorPhotoAction,
  type CustomerDoorPhotoState,
} from "./customer-door-photo-actions";

const initial: CustomerDoorPhotoState = {};

export function CustomerDoorPhotoQuick({
  orderId,
  hasImage,
}: {
  orderId: string;
  hasImage?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    uploadCustomerDoorPhotoFromView.bind(null, orderId),
    initial,
  );
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من مسح صورة باب الزبون؟")) return;
    setDeleting(true);
    try {
      await deleteCustomerDoorPhotoAction(orderId);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          name="customerDoorPhoto"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
          }}
        />
        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-lg border border-sky-400 bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-200 disabled:opacity-60"
          onClick={() => {
            const el = fileRef.current;
            if (!el) return;
            el.setAttribute("capture", "environment");
            el.click();
          }}
        >
          {pending ? "جارٍ الرفع..." : "كاميرا"}
        </button>
        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          onClick={() => {
            const el = fileRef.current;
            if (!el) return;
            el.removeAttribute("capture");
            el.click();
          }}
        >
          {pending ? "جارٍ الرفع..." : "معرض"}
        </button>
        {hasImage && (
          <button
            type="button"
            disabled={pending || deleting}
            onClick={handleDelete}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            {deleting ? "جارٍ المسح..." : "مسح الصورة"}
          </button>
        )}
      </form>
      {state.error ? <p className="text-xs font-medium text-rose-600">{state.error}</p> : null}
      {state.ok ? <p className="text-xs font-medium text-emerald-700">تم تحديث صورة الباب</p> : null}
    </div>
  );
}
