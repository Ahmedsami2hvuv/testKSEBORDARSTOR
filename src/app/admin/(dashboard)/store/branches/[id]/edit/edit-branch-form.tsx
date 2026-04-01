"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { type StoreBranchFormState, updateStoreBranch } from "../../actions";

export function EditBranchForm({
  branch,
  shops,
}: {
  branch: { id: string; name: string; shopId: string | null; imageUrl: string };
  shops: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<StoreBranchFormState, FormData>(
    updateStoreBranch,
    {},
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={branch.id} />
      <div>
        <label className={ad.label}>اسم الفرع</label>
        <input name="name" defaultValue={branch.name} className={`${ad.input} mt-1 w-full`} />
      </div>
      <div>
        <label className={ad.label}>ربط مع Shop (اختياري)</label>
        <select name="shopId" defaultValue={branch.shopId ?? ""} className={`${ad.select} mt-1 w-full`}>
          <option value="">— بدون —</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={ad.label}>تغيير صورة الفرع (اختياري)</label>
        <input
          name="imageFile"
          type="file"
          accept="image/*"
          capture="environment"
          className={`${ad.input} mt-1 w-full`}
        />
      </div>
      <div className="sm:col-span-2">
        <p className={ad.muted}>الصورة الحالية: {branch.imageUrl ? "موجودة" : "غير موجودة"}</p>
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

