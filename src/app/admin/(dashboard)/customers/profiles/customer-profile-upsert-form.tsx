"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { AdminRegionSearchPicker, type AdminRegionOption } from "@/components/admin-region-search-picker";
import {
  upsertCustomerPhoneProfile,
  type CustomerProfileFormState,
} from "./actions";

const initial: CustomerProfileFormState = {};

export function CustomerProfileUpsertForm({
  regions,
}: {
  regions: AdminRegionOption[];
}) {
  const [state, formAction, pending] = useActionState(
    upsertCustomerPhoneProfile,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const [regionId, setRegionId] = useState<string>("");

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRegionId("");
      phoneRef.current?.focus();
    }
  }, [state.ok]);

  if (regions.length === 0) {
    return (
      <p className={ad.warn}>
        أضف منطقة واحدة على الأقل من صفحة «المناطق» قبل حفظ تفاصيل الزبائن.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>رقم هاتف الزبون</span>
          <input
            ref={phoneRef}
            name="phone"
            required
            inputMode="numeric"
            autoComplete="tel"
            placeholder="07xxxxxxxx"
            className={`${ad.input} font-mono tabular-nums`}
          />
          <span className="text-xs text-slate-500">
            سجل واحد لكل (رقم + منطقة). إن وُجد يُحدَّث اللوكيشن، أقرب نقطة، الرقم الثاني،
            الملاحظات، وصورة الباب إن رفعت صورة جديدة.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>المنطقة</span>
          <AdminRegionSearchPicker
            name="regionId"
            regions={regions}
            value={regionId}
            onValueChange={setRegionId}
            allowEmpty={false}
            placeholder="اكتب جزءاً من اسم المنطقة للبحث…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>رابط اللوكيشن (اختياري)</span>
          <input
            name="locationUrl"
            type="text"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>أقرب نقطة دالة (اختياري)</span>
          <input
            name="landmark"
            type="text"
            className={ad.input}
            placeholder="مثال: باب أزرق، مجاور مخبز…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>رقم هاتف ثانٍ (اختياري)</span>
          <input
            name="alternatePhone"
            inputMode="numeric"
            className={`${ad.input} font-mono tabular-nums`}
            placeholder="07xxxxxxxx"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>ملاحظات (اختياري — للمرجع لاحقاً)</span>
          <textarea
            name="notes"
            rows={3}
            className={`${ad.input} min-h-[5rem] resize-y`}
            placeholder="مثال: باب أزرق، الطابق الثاني…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>صورة باب الزبون (اختياري)</span>
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className={ad.input}
          />
          <span className="text-xs text-slate-500">
            JPG أو PNG أو Webp — حتى 10 ميجابايت
          </span>
        </label>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className={ad.success}>تم حفظ التفاصيل بنجاح.</p>
      ) : null}
      <button type="submit" disabled={pending} className={ad.btnPrimary}>
        {pending ? "جارٍ الحفظ…" : "حفظ التفاصيل"}
      </button>
    </form>
  );
}
