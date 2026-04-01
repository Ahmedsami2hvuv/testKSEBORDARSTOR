import Link from "next/link";
import { cookies } from "next/headers";
import type { DelegatePortalVerifyReason } from "@/lib/delegate-link";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { fetchMandoubMoneySumsForCourier } from "@/lib/mandoub-courier-event-totals";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";
import {
  findMandoubOrderForCourier,
  mandoubOrderDetailInclude,
} from "@/lib/mandoub-order-queries";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { MandoubMoneySummarySection } from "../../mandoub-money-summary-section";
import { OrderDetailSection } from "../../order-detail-section";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تفاصيل الطلب — المندوب",
};

function invalidLinkMessage(reason: DelegatePortalVerifyReason): string {
  switch (reason) {
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. يرجى فتح الرابط الأصلي المرسل إليك.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل. تواصل مع الإدارة.";
  }
}

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{
    c?: string;
    exp?: string;
    s?: string;
    tab?: string;
    q?: string;
    loc?: string;
  }>;
};

export default async function MandoubOrderDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const cookieStore = await cookies();

  // محاولة القراءة من الرابط أو الكوكيز
  const c = sp.c || cookieStore.get("mandoub_c")?.value;
  const s = sp.s || cookieStore.get("mandoub_s")?.value;
  const exp = sp.exp || cookieStore.get("mandoub_exp")?.value;

  const v = verifyDelegatePortalQuery(c, exp, s);

  if (!v.ok) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">لا يمكن فتح الطلب</p>
            <p className="mt-2 text-sm text-slate-600">{invalidLinkMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const courier = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { blocked: true, mandoubTotalsResetAt: true, vehicleType: true },
  });
  if (!courier || courier.blocked) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-800">الحساب معطل</p>
          </div>
        </div>
      </div>
    );
  }

  const baseAuth = { c: c!, exp: exp || "", s: s! };
  const baseQuery = new URLSearchParams();
  if (baseAuth.c) baseQuery.set("c", baseAuth.c);
  if (baseAuth.exp) baseQuery.set("exp", baseAuth.exp);
  if (baseAuth.s) baseQuery.set("s", baseAuth.s);

  const order = await findMandoubOrderForCourier(orderId, v.courierId);

  if (!order) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-amber-300 p-8 text-center">
            <p className="text-lg font-bold text-amber-900">الطلب غير موجود أو غير مسند إليك</p>
            <Link href={`/mandoub?${baseQuery.toString()}`} className="mt-4 inline-block font-bold text-sky-800 underline">
              العودة للطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const moneySums = await fetchMandoubMoneySumsForCourier(v.courierId, courier.mandoubTotalsResetAt);
  const activeOrdersForTotals = await prisma.order.findMany({
    where: {
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [{ assignedCourierId: v.courierId }, { courierEarningForCourierId: v.courierId }],
    },
    include: mandoubOrderDetailInclude,
  });

  const orderMetrics = computeMandoubTotalsForCourier(
    activeOrdersForTotals.map(o => ({...o, moneyEvents: o.moneyEvents.map(e => ({...e, courierId: e.courierId ?? undefined}))})),
    v.courierId,
    courier.mandoubTotalsResetAt
  );

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-base leading-relaxed text-slate-800">
      <div className="kse-app-inner mx-auto max-w-6xl px-3 py-4 pb-24 text-base sm:px-4 sm:text-lg">
        <MandoubMoneySummarySection
          totalsBaseline={courier.mandoubTotalsResetAt}
          sumDeliveryInDinar={Number(moneySums.sumDeliveryIn)}
          sumPickupOutDinar={Number(moneySums.sumPickupOut)}
          remainingNetDinar={Number(moneySums.remainingNet)}
          sumEarningsDinar={Number(orderMetrics.sumEarnings)}
          courierVehicleType={courier.vehicleType}
          hrefWalletLedger={(l) => `/mandoub/wallet?${baseQuery.toString()}${l !== 'all' ? '&ledger=' + l : ''}`}
          hideTitle hideResetText
        />

        <OrderDetailSection
          order={order}
          closeHref={`/mandoub?${baseQuery.toString()}`}
          auth={baseAuth}
          nextUrl={`/mandoub/order/${orderId}?${baseQuery.toString()}`}
          viewerCourierId={v.courierId}
        />
      </div>
    </div>
  );
}
