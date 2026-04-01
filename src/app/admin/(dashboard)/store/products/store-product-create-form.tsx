"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  createStoreProductWithVariant,
  type StoreProductFormState,
} from "./actions";

export function StoreProductCreateForm({
  categories,
  initialPrimaryCategoryId,
  preselectedCategoryIds,
}: {
  categories: { id: string; name: string }[];
  initialPrimaryCategoryId?: string;
  preselectedCategoryIds?: string[];
}) {
  const [state, action, pending] = useActionState<StoreProductFormState, FormData>(
    createStoreProductWithVariant,
    {},
  );

  return (
    <form action={action} className="grid gap-3 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <label className={ad.label}>الاسم</label>
        <input name="name" className={`${ad.input} mt-1 w-full`} />
      </div>
      <div className="lg:col-span-1">
        <label className={ad.label}>القسم الرئيسي</label>
        <select
          name="primaryCategoryId"
          className={`${ad.select} mt-1 w-full`}
          defaultValue={initialPrimaryCategoryId ?? ""}
        >
          <option value="">— اختر —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-1">
        <label className={ad.label}>الحالة</label>
        <input className={`${ad.input} mt-1 w-full`} value="جاهز للإضافة" readOnly />
      </div>

      <div className="lg:col-span-3">
        <label className={ad.label}>نشر المنتج في الفروع/الأقسام</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="categoryIds"
                value={c.id}
                defaultChecked={preselectedCategoryIds?.includes(c.id)}
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3">
        <label className={ad.label}>وصف</label>
        <textarea
          name="description"
          className={`${ad.input} mt-1 w-full min-h-24`}
          placeholder="اختياري"
        />
      </div>

      <div className="lg:col-span-3">
        <label className={ad.label}>صور المنتج (يمكن اختيار أكثر من صورة)</label>
        <input
          name="imageFiles"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className={`${ad.input} mt-1 w-full`}
          required
        />
      </div>

      <div className="lg:col-span-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
        <div className="text-sm font-bold text-sky-900">المتغير الأول</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className={ad.label}>سعر البيع (بالألف)</label>
            <input
              name="salePriceAlf"
              className={`${ad.input} mt-1 w-full font-mono`}
              placeholder="مثال: 25"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className={ad.label}>سعر الشراء (بالألف)</label>
            <input
              name="costPriceAlf"
              className={`${ad.input} mt-1 w-full font-mono`}
              placeholder="مثال: 18"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className={ad.label}>لون</label>
            <input name="color" className={`${ad.input} mt-1 w-full`} placeholder="أسود" />
          </div>
          <div>
            <label className={ad.label}>قياس</label>
            <input name="size" className={`${ad.input} mt-1 w-full`} placeholder="XL" />
          </div>
          <div>
            <label className={ad.label}>شكل</label>
            <input name="shape" className={`${ad.input} mt-1 w-full`} placeholder="دائري" />
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-wrap items-center gap-3">
        <button type="submit" className={ad.btnPrimary} disabled={pending}>
          إضافة
        </button>
        {state?.error ? <span className={ad.error}>{state.error}</span> : null}
        {state?.ok ? <span className={ad.success}>تمت الإضافة.</span> : null}
      </div>
    </form>
  );
}

