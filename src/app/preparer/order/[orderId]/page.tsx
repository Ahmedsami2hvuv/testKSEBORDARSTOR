import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerCourierAssignWhere } from "@/lib/courier-assignable";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerAssignCourierFab } from "../../preparer-assign-courier-fab";
import { PreparerOrderDetailSection } from "../../preparer-order-detail-section";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
import { mandoubOrderDetailInclude } from "@/lib/mandoub-order-queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string; tab?: string; q?: string }>;
};

function invalidMsg(reason: string) {
  switch (reason) {
    case "expired": return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من الإدارة.";
    case "bad_signature":
    case "missing": return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret": return "إعداد الخادم غير مكتمل.";
    default: return "تعذّر التحقق.";
  }
}

export default async function PreparerOrderDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const cookieStore = await cookies();

  // جلب بيانات التوثيق من الرابط أو الكوكيز
  const p = sp.p || (await cookieStore).get("preparer_p")?.value;
  const exp = sp.exp || (await cookieStore).get("preparer_exp")?.value;
  const s = sp.s || (await cookieStore).get("preparer_s")?.value;

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
          <p className="text-lg font-bold text-rose-700">لا يمكن فتح الطلب</p>
          <p className="mt-2 text-sm text-slate-600">{invalidMsg(v.reason)}</p>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });

  if (!preparer) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-800">الحساب غير متاح</p>
        </div>
      </div>
    );
  }

  const order: MandoubOrderDetailPayload | null = await prisma.order.findUnique({
    where: { id: orderId },
    include: mandoubOrderDetailInclude,
  });

  if (!order) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-800">الطلب غير موجود</p>
        </div>
      </div>
    );
  }

  const { normalizeIraqMobileLocal11 } = await import("@/lib/whatsapp");
  const phoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
  const phoneProfile = phoneNorm && order.customerRegionId ? await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone: phoneNorm, regionId: order.customerRegionId } },
  }) : null;

  const secondPhoneNorm = order.secondCustomerPhone ? normalizeIraqMobileLocal11(order.secondCustomerPhone) : null;
  const secondPhoneProfile = secondPhoneNorm && order.secondCustomerRegionId ? await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone: secondPhoneNorm, regionId: order.secondCustomerRegionId } },
  }) : null;

  const auth = { p: p!, exp: exp!, s: s! };
  const homeHref = preparerPath("/preparer", auth);

  const couriers = await prisma.courier.findMany({
    where: preparerCourierAssignWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const canAssign = (order.status === "pending" || order.status === "assigned") && couriers.length > 0;

  return (
    <div className="kse-app-inner mx-auto max-w-lg px-3 py-4 pb-24 sm:px-4">
      <div className="mb-4">
        <Link href={homeHref} className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100">
          ← الطلبات
        </Link>
      </div>

      <PreparerOrderDetailSection
        order={order}
        closeHref={homeHref}
        auth={auth}
        nextUrl={preparerPath(`/preparer/order/${orderId}`, auth)}
        preparerId={preparer.id}
        phoneProfile={phoneProfile}
        secondPhoneProfile={secondPhoneProfile}
      />

      {canAssign && (
        <PreparerAssignCourierFab
          auth={auth}
          orderId={order.id}
          couriers={couriers.map((c) => ({ id: c.id, name: c.name }))}
          defaultCourierId={order.assignedCourierId}
        />
      )}
    </div>
  );
}
