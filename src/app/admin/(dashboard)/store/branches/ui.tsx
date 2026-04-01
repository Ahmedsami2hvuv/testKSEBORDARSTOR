"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { createStoreBranch, createStockMovement, type StoreBranchFormState } from "./actions";

export function BranchCreateForm({
  shops,
}: {
  shops: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<StoreBranchFormState, FormData>(
    createStoreBranch,
    {},
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={ad.label}>اسم الفرع</label>
        <input name="name" className={`${ad.input} mt-1 w-full`} placeholder="المخزن الرئيسي" />
      </div>
      <div>
        <label className={ad.label}>صورة الفرع</label>
        <input
          name="imageFile"
          type="file"
          accept="image/*"
          capture="environment"
          className={`${ad.input} mt-1 w-full`}
          required
        />
      </div>
      <div>
        <label className={ad.label}>ربط مع Shop (اختياري)</label>
        <select name="shopId" className={`${ad.select} mt-1 w-full`}>
          <option value="">— بدون —</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button type="submit" className={ad.btnPrimary} disabled={pending}>
          إضافة
        </button>
        {state?.error ? <span className={ad.error}>{state.error}</span> : null}
        {state?.ok ? <span className={ad.success}>تمت الإضافة.</span> : null}
      </div>
    </form>
  );
}

export function StockMovementForm({
  branches,
  variants,
}: {
  branches: { id: string; name: string }[];
  variants: {
    id: string;
    optionValues: unknown;
    product: { name: string };
  }[];
}) {
  const [state, action, pending] = useActionState<StoreBranchFormState, FormData>(
    createStockMovement,
    {},
  );

  return (
    <form action={action} className="grid gap-3 lg:grid-cols-3">
      <div>
        <label className={ad.label}>الفرع</label>
        <select name="branchId" className={`${ad.select} mt-1 w-full`}>
          <option value="">— اختر —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <label className={ad.label}>المتغير</label>
        <select name="variantId" className={`${ad.select} mt-1 w-full`}>
          <option value="">— اختر —</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.product.name} — {JSON.stringify(v.optionValues)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={ad.label}>النوع</label>
        <select name="kind" className={`${ad.select} mt-1 w-full`}>
          <option value="in">إدخال</option>
          <option value="out">إخراج</option>
          <option value="adjust">تسوية</option>
        </select>
      </div>
      <div>
        <label className={ad.label}>الكمية</label>
        <input name="quantity" className={`${ad.input} mt-1 w-full font-mono`} inputMode="numeric" />
      </div>
      <div className="lg:col-span-1">
        <label className={ad.label}>ملاحظة</label>
        <input name="note" className={`${ad.input} mt-1 w-full`} placeholder="اختياري" />
      </div>

      <div className="lg:col-span-3 flex flex-wrap items-center gap-3">
        <button type="submit" className={ad.btnPrimary} disabled={pending}>
          تسجيل الحركة
        </button>
        {state?.error ? <span className={ad.error}>{state.error}</span> : null}
        {state?.ok ? <span className={ad.success}>تم الحفظ.</span> : null}
      </div>
    </form>
  );
}

