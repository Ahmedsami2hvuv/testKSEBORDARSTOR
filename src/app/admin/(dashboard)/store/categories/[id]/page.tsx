import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { CategoryActionPanels } from "./category-action-panels";

type Props = { params: Promise<{ id: string }> };

export default async function StoreCategoryDetailsPage({ params }: Props) {
  if (!(await isAdminSession())) redirect("/admin/login");
  const { id } = await params;

  const [category, allCategories, children, products] = await Promise.all([
    prisma.storeCategory.findUnique({ where: { id } }),
    prisma.storeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.storeCategory.findMany({ where: { parentId: id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.storeProduct.findMany({
      where: {
        OR: [{ categoryId: id }, { categories: { some: { categoryId: id } } }],
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>القسم: {category.name}</h1>
          <p className={ad.muted}>من هنا تضيف أفرع داخل هذا القسم وتعرض المنتجات التابعة له.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/store/categories/${category.id}/edit`} className={ad.link}>
            تعديل القسم
          </Link>
          <Link href="/admin/store/categories" className={ad.link}>
            ← كل الأقسام
          </Link>
        </div>
      </div>

      <CategoryActionPanels
        categoryId={category.id}
        categories={allCategories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <section className={ad.section}>
        <h2 className={ad.h2}>الأفرع الداخلية</h2>
        {children.length === 0 ? (
          <p className={ad.muted}>لا يوجد أفرع داخلية بعد.</p>
        ) : (
          <div className={ad.listDivide}>
            {children.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <div className={ad.listTitle}>{c.name}</div>
                  <div className={ad.listMuted}>ترتيب: {c.sortOrder}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/store/categories/${c.id}`} className={ad.link}>
                    فتح الفرع
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

      <section className={ad.section}>
        <h2 className={ad.h2}>منتجات هذا القسم</h2>
        {products.length === 0 ? (
          <p className={ad.muted}>لا يوجد منتجات مرتبطة بعد.</p>
        ) : (
          <div className={ad.listDivide}>
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <div className={ad.listTitle}>{p.name}</div>
                  <div className={ad.listMuted}>متاح للتعديل من صفحة المنتجات</div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/admin/store/products" className={ad.link}>
                    إدارة المنتج
                  </Link>
                  <Link href={`/admin/store/products/${p.id}/edit`} className={ad.link}>
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

