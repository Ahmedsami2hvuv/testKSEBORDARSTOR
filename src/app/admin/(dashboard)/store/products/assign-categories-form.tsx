"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { assignProductCategories, type StoreProductAssignState } from "./actions";

export function AssignProductCategoriesForm({
  productId,
  allCategories,
  selectedCategoryIds,
  primaryCategoryId,
}: {
  productId: string;
  allCategories: { id: string; name: string }[];
  selectedCategoryIds: string[];
  primaryCategoryId: string | null;
}) {
  const [state, action, pending] = useActionState<StoreProductAssignState, FormData>(
    assignProductCategories,
    {},
  );

  return (
    <form action={action} className="mt-3 rounded-xl border border-sky-100 bg-white p-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="text-xs font-bold text-sky-800">نشر/نقل المنتج بين الفروع</div>
      <div className="mt-2">
        <label className={ad.label}>القسم الرئيسي</label>
        <select
          name="primaryCategoryId"
          defaultValue={primaryCategoryId ?? ""}
          className={`${ad.select} mt-1 w-full`}
        >
          <option value="">— بدون —</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {allCategories.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="categoryIds"
              value={c.id}
              defaultChecked={selectedCategoryIds.includes(c.id)}
            />
            <span>{c.name}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" disabled={pending} className={ad.btnDark}>
          حفظ
        </button>
        {state?.ok ? <span className={ad.success}>تم</span> : null}
        {state?.error ? <span className={ad.error}>{state.error}</span> : null}
      </div>
    </form>
  );
}

