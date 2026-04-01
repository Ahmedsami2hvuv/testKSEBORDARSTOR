import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AddVariantToCartButton } from "@/components/store-cart";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { getPrimaryStoredProductImage } from "@/lib/store-image-utils";

export const metadata = {
  title: "المتجر",
};

export const dynamic = "force-dynamic";

type StoreCategoryLite = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number | null;
};

type StoreProductLite = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrls: string | null;
  category: { name: string } | null;
  variants: Array<{ id: string; salePriceDinar: any }>;
};

export default async function StoreHomePage() {
  // ملاحظة: قد تكون نماذج المتجر غير مفعّلة في عميل Prisma ببعض البيئات، لذلك نستخدم cast آمن للـ build.
  const prismaAny = prisma as any;
  const [categories, products] = await Promise.all([
    prismaAny.storeCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true, imageUrl: true, sortOrder: true },
    }),
    prismaAny.storeProduct.findMany({
      where: { active: true },
      orderBy: [{ createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrls: true,
        category: { select: { name: true } },
        variants: {
          where: { active: true },
          orderBy: { salePriceDinar: "asc" },
          take: 1,
          select: { id: true, salePriceDinar: true },
        },
      },
    }),
  ]) as [StoreCategoryLite[], StoreProductLite[]];

  return (
    <div className="kse-app-bg min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-2 py-4 sm:px-4 sm:py-8">
        <div className="mt-2 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800">
                <span aria-hidden>✨</span>
                متجر متكامل
              </div>
              <h2 className="mt-3 text-xl font-extrabold text-slate-900 sm:text-2xl">
                تسوق بسهولة من خصيب ستور
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                اختر المنتج، أضفه للسلة فوراً، وأكمل الطلب كضيف بدون تعقيد.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#products"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-md shadow-cyan-500/20 transition hover:from-cyan-300 hover:to-blue-400"
              >
                ابدأ التسوق
              </a>
              <a
                href="#categories"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                الأقسام
              </a>
            </div>
          </div>
        </div>

        {categories.length > 0 ? (
          <div id="categories" className="mt-10">
            <h2 className="text-sm font-bold text-slate-800">الأقسام</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories
                .filter((c: StoreCategoryLite) => !c.parentId)
                .slice(0, 12)
                .map((c: StoreCategoryLite) => (
                  <Link
                    key={c.id}
                    href={`/store?category=${c.slug}`}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.name} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-500">
                          بدون صورة
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-900">{c.name}</div>
                      <div className="rounded-xl bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800 transition group-hover:bg-sky-200">
                        اختر →
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        ) : null}

        <div id="products" className="mt-10">
          <h2 className="text-sm font-bold text-slate-800">منتجات مقترحة</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: StoreProductLite) => {
              const cheapest = p.variants[0];
              const price = cheapest?.salePriceDinar;
              const canQuickAdd = cheapest?.id;
              const primaryImage = getPrimaryStoredProductImage(p.imageUrls);
              return (
                <Link
                  key={p.id}
                  href={`/store/product/${encodeURIComponent(p.slug)}`}
                  className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative overflow-hidden rounded-2xl bg-slate-100 aspect-[4/3]">
                    {primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryImage}
                        alt={p.name}
                        className="absolute inset-0 h-full w-full object-cover transition hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-500">
                        بدون صورة
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-sky-600/20 via-transparent to-transparent" />
                  </div>

                  <div className="mt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 line-clamp-1">{p.name}</div>
                        {p.category?.name ? (
                          <div className="mt-1 text-xs font-semibold text-sky-700">{p.category.name}</div>
                        ) : null}
                      </div>
                      {price ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-900">
                          {formatDinarAsAlfWithUnit(price)}
                        </div>
                      ) : null}
                    </div>

                    {p.description ? (
                      <div className="mt-3 line-clamp-2 text-sm text-slate-600">{p.description}</div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-400">بدون وصف</div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {canQuickAdd ? (
                        <AddVariantToCartButton variantId={canQuickAdd} />
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

