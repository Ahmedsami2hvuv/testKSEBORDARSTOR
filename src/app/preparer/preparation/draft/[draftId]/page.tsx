import Link from "next/link";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerShoppingDraftEditClient } from "./preparer-shopping-draft-edit-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

export default async function PreparerShoppingDraftPage({ params, searchParams }: Props) {
  const { draftId } = await params;
  const sp = await searchParams;
  const v = verifyCompanyPreparerPortalQuery(sp.p, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <p className="text-center font-bold text-rose-700">الرابط غير صالح</p>
      </div>
    );
  }

  const auth = { p: sp.p ?? "", exp: sp.exp ?? "", s: sp.s ?? "" };
  const prepHref = preparerPath("/preparer/preparation", auth);

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    select: { id: true },
  });
  if (!preparer) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <p className="text-center text-slate-800">الحساب غير متاح.</p>
        <Link href={prepHref} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة إلى تجهيز الطلبات
        </Link>
      </div>
    );
  }

  const draft = await prisma.companyPreparerShoppingDraft.findFirst({
    where: { id: draftId, preparerId: preparer.id },
    select: {
      id: true,
      status: true,
      titleLine: true,
      rawListText: true,
      customerRegionId: true,
      customerRegion: { select: { id: true, name: true, deliveryPrice: true } },
      customerPhone: true,
      customerName: true,
      customerLandmark: true,
      orderTime: true,
      placesCount: true,
      data: true,
      sentOrderId: true,
      createdAt: true,
    },
  });

  if (!draft) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <p className="text-center font-bold text-rose-700">المسودة غير موجودة.</p>
        <Link href={prepHref} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة إلى تجهيز الطلبات
        </Link>
      </div>
    );
  }

  return (
    <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-4 text-sm">
        <Link href={prepHref} className="font-bold text-sky-800 hover:underline">
          ← العودة إلى خانة التجهيز
        </Link>
      </div>
      <PreparerShoppingDraftEditClient auth={auth} draft={draft} />
    </div>
  );
}
