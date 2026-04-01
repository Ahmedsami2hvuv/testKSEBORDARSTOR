"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { type StoreProductFormState, updateStoreProduct } from "../../actions";

export function EditProductForm({
  product,
  categories,
}: {
  product: {
    id: string;
    name: string;
    description: string;
    categoryId: string | null;
    imageUrls: string;
  };
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<StoreProductFormState, FormData>(updateStoreProduct, {});

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={product.id} />
      <div>
        <label className={ad.label}>اسم المنتج</label>
        <input name="name" defaultValue={product.name} className={`${ad.input} mt-1 w-full`} />
      </div>
      <div>
        <label className={ad.label}>القسم الرئيسي</label>
        <select
          name="primaryCategoryId"
          defaultValue={product.categoryId ?? ""}
          className={`${ad.select} mt-1 w-full`}
        >
          <option value="">— بدون —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={ad.label}>الوصف</label>
        <textarea
          name="description"
          defaultValue={product.description}
          className={`${ad.input} mt-1 w-full`}
          rows={3}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={ad.label}>إضافة صور جديدة للمنتج (اختياري)</label>
        <input
          name="imageFiles"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className={`${ad.input} mt-1 w-full`}
        />
      </div>
      <div className="sm:col-span-2">
        <p className={ad.muted}>الصور الحالية: {product.imageUrls ? "موجودة" : "غير موجودة"}</p>
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

