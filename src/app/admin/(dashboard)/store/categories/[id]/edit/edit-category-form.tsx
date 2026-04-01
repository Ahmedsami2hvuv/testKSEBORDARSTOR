"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { type StoreCategoryFormState, updateStoreCategory } from "../../actions";

export function EditCategoryForm({
  category,
  categories,
}: {
  category: {
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
    imageUrl: string;
  };
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<StoreCategoryFormState, FormData>(
    updateStoreCategory,
    {},
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={category.id} />
      <div>
        <label className={ad.label}>الاسم</label>
        <input name="name" defaultValue={category.name} className={`${ad.input} mt-1 w-full`} />
      </div>
      <div>
        <label className={ad.label}>الترتيب</label>
        <input
          name="sortOrder"
          defaultValue={String(category.sortOrder)}
          className={`${ad.input} mt-1 w-full`}
          inputMode="numeric"
        />
      </div>
      <div>
        <label className={ad.label}>القسم الأب (اختياري)</label>
        <select name="parentId" defaultValue={category.parentId ?? ""} className={`${ad.select} mt-1 w-full`}>
          <option value="">— بدون —</option>
          {categories
            .filter((c) => c.id !== category.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className={ad.label}>تغيير الصورة (اختياري)</label>
        <input
          name="imageFile"
          type="file"
          accept="image/*"
          capture="environment"
          className={`${ad.input} mt-1 w-full`}
        />
      </div>
      <div className="sm:col-span-2">
        <p className={ad.muted}>الصورة الحالية: {category.imageUrl ? "موجودة" : "غير موجودة"}</p>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" className={ad.btnPrimary} disabled={pending}>
          حفظ التعديل
        </button>
        {state?.ok ? <span className={ad.success}>تم الحفظ</span> : null}
        {state?.error ? <span className={ad.error}>{state.error}</span> : null}
      </div>
    </form>
  );
}

