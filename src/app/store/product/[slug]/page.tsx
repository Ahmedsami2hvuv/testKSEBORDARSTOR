import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StoreCartMiniLink, AddVariantToCartButton } from "@/components/store-cart";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { parseStoredProductImages } from "@/lib/store-image-utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `منتج: ${slug}` };
}

export default async function StoreProductPage({ params }: Props) {
  const rawSlug = (await params).slug;
  const slug = decodeURIComponent(rawSlug).trim();

  const product = await prisma.storeProduct.findFirst({
    where: {
      AND: [
        { active: true },
        {
          OR: [{ slug }, { slug: rawSlug }],
        },
      ],
    },
    include: {
      variants: { where: { active: true }, orderBy: { createdAt: "asc" } },
      category: true,
    },
  });
  if (!product) notFound();

  const images = parseStoredProductImages(product.imageUrls);
  const primaryImage = images[0] ?? "";

  return (
    <div className="kse-app-bg min-h-screen">
      <div className="kse-app-inner mx-auto w-full max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/store" className="text-sm font-semibold text-sky-700 underline underline-offset-4">
            ← رجوع للمتجر
          </Link>
          <StoreCartMiniLink />
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 aspect-[4/3]">
            {primaryImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryImage}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-500">
                بدون صورة
              </div>
            )}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {images.slice(0, 8).map((src, i) => (
                <a
                  key={`${src}-${i}`}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${product.name}-${i + 1}`} className="h-20 w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            {product.name}
          </h1>
          {product.category ? (
            <p className="mt-2 text-sm font-semibold text-sky-700">
              القسم: {product.category.name}
            </p>
          ) : null}
          {product.description ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              {product.description}
            </p>
          ) : null}

          <div className="mt-6">
            <h2 className="text-sm font-bold text-slate-800">المتغيرات</h2>
            {product.variants.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">لا يوجد متغيرات متاحة حالياً.</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {product.variants.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-bold text-slate-900">متغير</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {(() => {
                        const mapKey: Record<string, string> = { color: "لون", size: "قياس", shape: "شكل" };
                        const ov = v.optionValues as unknown;
                        if (ov && typeof ov === "object" && !Array.isArray(ov)) {
                          const obj = ov as Record<string, unknown>;
                          const entries = Object.entries(obj).filter(([, val]) => val != null && String(val).trim() !== "");
                          if (entries.length === 0) return "—";
                          return entries.map(([k, val]) => `${mapKey[k] ?? k}: ${String(val)}`).join(" · ");
                        }
                        return ov == null ? "—" : String(ov);
                      })()}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-sky-800">
                      السعر: {formatDinarAsAlfWithUnit(v.salePriceDinar)}
                    </div>
                    <div className="mt-3">
                      <AddVariantToCartButton variantId={v.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/store/checkout"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-md shadow-cyan-500/30 transition hover:from-emerald-300 hover:to-cyan-300"
          >
            الذهاب للسلة وإتمام الطلب
          </Link>
        </div>
      </div>
    </div>
  );
}

