import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { StoreCategoryCreateForm } from "./store-category-create-form";

export const metadata = {
  title: "أقسام المتجر — لوحة الإدارة",
};

export default async function AdminStoreCategoriesPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const categories = await prisma.storeCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>أقسام المتجر</h1>
          <p className={`mt-1 ${ad.muted}`}>يمكن إنشاء فروع داخل فروع عبر parent.</p>
        </div>
        <Link href="/admin/store" className={ad.link}>
          ← المتجر
        </Link>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>إضافة قسم</h2>
        <div className="mt-4">
          <StoreCategoryCreateForm categories={categories} />
        </div>
      </section>

      <section className={ad.section}>
        <h2 className={ad.h2}>القائمة</h2>
        {categories.length === 0 ? (
          <p className={`mt-3 ${ad.muted}`}>لا يوجد أقسام بعد.</p>
        ) : (
          <div className={`mt-3 ${ad.listDivide}`}>
            {categories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <div className={ad.listTitle}>{c.name}</div>
                  <div className={ad.listMuted}>
                    {c.parentId ? (
                      <>
                        الأب:{" "}
                        <span className="font-medium">
                          {categoryNameById.get(c.parentId) ?? "غير معروف"}
                        </span>{" "}
                        ·{" "}
                      </>
                    ) : null}
                    ترتيب: {c.sortOrder}
                    {c.imageUrl ? " · لديه صورة" : " · بدون صورة"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/store/categories/${c.id}`} className={ad.link}>
                    دخول القسم
                  </Link>
                  <Link href={`/admin/store/categories/${c.id}/edit`} className={ad.link}>
                    تعديل
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

