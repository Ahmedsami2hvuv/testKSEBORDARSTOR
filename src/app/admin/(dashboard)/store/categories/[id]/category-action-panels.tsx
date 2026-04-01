"use client";

import { useState } from "react";
import { ad } from "@/lib/admin-ui";
import { StoreCategoryCreateForm } from "../store-category-create-form";
import { StoreProductCreateForm } from "../../products/store-product-create-form";

type Panel = "branch" | "product" | null;

export function CategoryActionPanels({
  categoryId,
  categories,
}: {
  categoryId: string;
  categories: { id: string; name: string }[];
}) {
  const [openPanel, setOpenPanel] = useState<Panel>(null);

  return (
    <section className={ad.section}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={ad.btnPrimary}
          onClick={() => setOpenPanel((p) => (p === "branch" ? null : "branch"))}
        >
          إضافة فرع
        </button>
        <button
          type="button"
          className={ad.btnDark}
          onClick={() => setOpenPanel((p) => (p === "product" ? null : "product"))}
        >
          إضافة منتج
        </button>
      </div>

      {openPanel === "branch" ? (
        <div className="mt-4">
          <h2 className={ad.h2}>إضافة فرع داخل هذا القسم</h2>
          <div className="mt-3">
            <StoreCategoryCreateForm categories={categories} initialParentId={categoryId} />
          </div>
        </div>
      ) : null}

      {openPanel === "product" ? (
        <div className="mt-4">
          <h2 className={ad.h2}>إنشاء منتج داخل هذا الفرع</h2>
          <div className="mt-3">
            <StoreProductCreateForm
              categories={categories}
              initialPrimaryCategoryId={categoryId}
              preselectedCategoryIds={[categoryId]}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

