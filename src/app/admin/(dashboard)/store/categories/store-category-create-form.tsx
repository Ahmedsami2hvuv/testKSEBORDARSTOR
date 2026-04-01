"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { createStoreCategory, type StoreCategoryFormState } from "./actions";

export function StoreCategoryCreateForm({
  categories,
  initialParentId,
}: {
  categories: { id: string; name: string }[];
  initialParentId?: string;
}) {
  const [state, action, pending] = useActionState<StoreCategoryFormState, FormData>(
    createStoreCategory,
    {},
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-1">
        <label className={ad.label}>الاسم</label>
        <input name="name" className={`${ad.input} mt-1 w-full`} placeholder="مثال: أحذية" />
      </div>

      <div className="sm:col-span-1">
        <label className={ad.label}>الحالة</label>
        <input className={`${ad.input} mt-1 w-full`} value="جاهز للإضافة" readOnly />
      </div>

      <div className="sm:col-span-1">
        <label className={ad.label}>صورة القسم/الفرع</label>
        <input
          name="imageFile"
          type="file"
          accept="image/*"
          capture="environment"
          className={`${ad.input} mt-1 w-full`}
          required
        />
      </div>

      <div className="sm:col-span-1">
        <label className={ad.label}>القسم الأب (اختياري)</label>
        <select
          name="parentId"
          className={`${ad.select} mt-1 w-full`}
          defaultValue={initialParentId ?? ""}
        >
          <option value="">— بدون —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-1">
        <label className={ad.label}>الترتيب</label>
        <input
          name="sortOrder"
          className={`${ad.input} mt-1 w-full font-mono`}
          defaultValue="0"
          inputMode="numeric"
        />
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

