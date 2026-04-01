import Link from "next/link";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerSiteOrderPrepEditClient } from "../../preparer-site-order-prep-edit-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

export default async function PreparerPreparationEditPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const v = verifyCompanyPreparerPortalQuery(sp.p, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <p className="text-center font-bold text-rose-700">الرابط غير صالح</p>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: {
      shopLinks: {
        where: { canSubmitOrders: true },
        orderBy: { assignedAt: "asc" },
        include: { shop: { include: { region: true } } },
      },
    },
  });

  const auth = { p: sp.p ?? "", exp: sp.exp ?? "", s: sp.s ?? "" };
  const home = preparerPath("/preparer", auth);
  const prep = preparerPath("/preparer/preparation", auth);

  if (!preparer) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center text-slate-800">الحساب غير متاح.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, submittedByCompanyPreparerId: v.preparerId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      shopId: true,
      customerPhone: true,
      orderNoteTime: true,
      customerLandmark: true,
      customerRegionId: true,
      customerRegion: { select: { id: true, name: true, deliveryPrice: true } },
      customer: { select: { name: true } },
      preparerShoppingJson: true,
    },
  });

  if (!order || order.preparerShoppingJson == null) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center text-slate-800">الطلب غير موجود أو ليس طلب تجهيز تسوق.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  if (order.status === "delivered") {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">لا يمكن تعديل الطلب بعد تم التسليم.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  if (!order.customerRegion || !order.customerRegionId) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">لا يمكن تعديل الطلب بدون منطقة زبون.</p>
        <Link href={prep} className="mt-4 block text-center font-bold text-sky-700 underline">
          فتح تجهيز الطلبات
        </Link>
      </div>
    );
  }

  const payload = order.preparerShoppingJson as
    | {
        version?: number;
        titleLine?: unknown;
        products?: unknown;
        placesCount?: unknown;
        rawListText?: unknown;
      }
    | null;
  const productsRaw = Array.isArray(payload?.products) ? payload.products : [];
  const products = productsRaw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const row = p as Record<string, unknown>;
      const line = String(row.line ?? "").trim();
      const buyAlf = Number(row.buyAlf);
      const sellAlf = Number(row.sellAlf);
      if (!line || !Number.isFinite(buyAlf) || !Number.isFinite(sellAlf) || buyAlf < 0 || sellAlf < 0) {
        return null;
      }
      return { line, buyAlf, sellAlf };
    })
    .filter((x): x is { line: string; buyAlf: number; sellAlf: number } => x != null);

  const placesCountNum = Number(payload?.placesCount);
  if (payload?.version !== 1 || !String(payload?.titleLine ?? "").trim() || products.length === 0) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">صيغة بيانات الطلب غير صالحة للتعديل من هذه الصفحة.</p>
        <Link href={prep} className="mt-4 block text-center font-bold text-sky-700 underline">
          فتح تجهيز الطلبات
        </Link>
      </div>
    );
  }

  const canUseShop = preparer.shopLinks.some((l) => l.shop.id === order.shopId);
  if (!canUseShop) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">هذا الطلب ليس ضمن محلاتك المفعّلة للتجهيز.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  const shops = preparer.shopLinks.map((l) => ({
    id: l.shop.id,
    name: l.shop.name,
    shopRegionName: l.shop.region.name,
    shopDeliveryAlf: Number(l.shop.region.deliveryPrice.toString()) / ALF_PER_DINAR,
  }));

  return (
    <div className="kse-app-inner mx-auto max-w-6xl px-4 py-8 pb-24">
      <div className="mx-auto mb-4 max-w-lg text-sm">
        <Link href={prep} className="font-bold text-sky-800 hover:underline">
          ← تجهيز الطلبات
        </Link>
      </div>
      <div className="mx-auto max-w-lg">
        <PreparerSiteOrderPrepEditClient
          auth={auth}
          orderId={order.id}
          orderNumber={order.orderNumber}
          preparerName={preparer.name}
          shops={shops}
          homeHref={home}
          prepHref={prep}
          initialData={{
            titleLine: String(payload?.titleLine ?? "").trim(),
            products,
            placesCount: Number.isFinite(placesCountNum) && placesCountNum > 0 ? Math.floor(placesCountNum) : 1,
            rawListText: typeof payload?.rawListText === "string" ? payload.rawListText : undefined,
            shopId: order.shopId,
            customerRegionId: order.customerRegionId,
            customerRegionName: order.customerRegion.name,
            customerRegionDeliveryDinar: Number(order.customerRegion.deliveryPrice),
            customerPhone: order.customerPhone?.trim() || "",
            customerName: order.customer?.name?.trim() || "",
            orderTime: order.orderNoteTime?.trim() || "فوري",
            customerLandmark: order.customerLandmark?.trim() || "",
          }}
        />
      </div>
    </div>
  );
}
