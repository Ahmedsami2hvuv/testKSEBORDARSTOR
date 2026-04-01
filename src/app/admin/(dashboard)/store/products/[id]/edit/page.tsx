import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { EditProductForm } from "./edit-product-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditStoreProductPage({ params }: Props) {
  if (!(await isAdminSession())) redirect("/admin/login");
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.storeProduct.findUnique({ where: { id } }),
    prisma.storeCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={ad.h1}>تعديل المنتج</h1>
        <Link href="/admin/store/products" className={ad.link}>
          ← رجوع
        </Link>
      </div>
      <section className={ad.section}>
        <EditProductForm product={product} categories={categories} />
      </section>
    </div>
  );
}

