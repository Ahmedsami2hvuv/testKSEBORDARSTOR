import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { StoreProductCreateForm } from "./store-product-create-form";
import { AssignProductCategoriesForm } from "./assign-categories-form";

export const metadata = {
  title: "منتجات المتجر — لوحة الإدارة",
};

export default async function AdminStoreProductsPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const [categories, products] = await Promise.all([
    prisma.storeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.storeProduct.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        category: true,
        categories: { include: { category: true } },
      },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>منتجات المتجر</h1>
          <p className={`mt-1 ${ad.muted}`}>
            السعر والشراء على مستوى المتغير (لون/قياس/شكل).
          </p>
        </div>
        <Link href="/admin/store" className={ad.link}>
          ← المتجر
        </Link>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>إضافة منتج (مع متغير واحد كبداية)</h2>
        <div className="mt-4">
          <StoreProductCreateForm categories={categories} />
        </div>
      </section>

      <section className={ad.section}>
        <h2 className={ad.h2}>آخر المنتجات</h2>
        {products.length === 0 ? (
          <p className={`mt-3 ${ad.muted}`}>لا يوجد منتجات بعد.</p>
        ) : (
          <div className={`mt-3 ${ad.listDivide}`}>
            {products.map((p) => (
              <div key={p.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className={ad.listTitle}>{p.name}</div>
                    <div className={ad.listMuted}>
                      {p.category ? <>القسم الرئيسي: {p.category.name} · </> : null}
                      منشور في:{" "}
                      {p.categories.length > 0
                        ? p.categories.map((x) => x.category.name).join("، ")
                        : "غير محدد"}
                      {" · "}متغيرات: {p.variants.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/store/products/${p.id}/edit`} className={ad.link}>
                      تعديل
                    </Link>
                  </div>
                </div>

                {p.variants.length > 0 ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {p.variants.map((v) => (
                      <div key={v.id} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                        <div className="text-sm font-semibold text-slate-800">متغير</div>
                        <div className="mt-1 text-sm text-slate-600">
                          بيع: {formatDinarAsAlfWithUnit(v.salePriceDinar)} · شراء:{" "}
                          {formatDinarAsAlfWithUnit(v.costPriceDinar)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 font-mono">
                          خيارات: {JSON.stringify(v.optionValues)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <AssignProductCategoriesForm
                  productId={p.id}
                  allCategories={categories.map((c) => ({ id: c.id, name: c.name }))}
                  selectedCategoryIds={p.categories.map((x) => x.categoryId)}
                  primaryCategoryId={p.categoryId}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

