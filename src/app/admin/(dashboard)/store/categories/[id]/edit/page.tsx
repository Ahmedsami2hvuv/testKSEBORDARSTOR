import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { EditCategoryForm } from "./edit-category-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditStoreCategoryPage({ params }: Props) {
  if (!(await isAdminSession())) redirect("/admin/login");
  const { id } = await params;

  const [category, categories] = await Promise.all([
    prisma.storeCategory.findUnique({ where: { id } }),
    prisma.storeCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={ad.h1}>تعديل القسم/الفرع</h1>
        <Link href={`/admin/store/categories/${id}`} className={ad.link}>
          ← رجوع
        </Link>
      </div>
      <section className={ad.section}>
        <EditCategoryForm category={category} categories={categories} />
      </section>
    </div>
  );
}

