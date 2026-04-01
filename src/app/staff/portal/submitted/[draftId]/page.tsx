import Link from "next/link";
import type { StaffEmployeePortalVerifyReason } from "@/lib/staff-employee-portal-link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { StaffSubmittedDraftEditClient } from "./staff-submitted-draft-edit-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ se?: string; exp?: string; s?: string }>;
};

function invalidMessage(reason: StaffEmployeePortalVerifyReason): string {
  switch (reason) {
    case "missing":
      return "الرابط غير مكتمل. تأكد من نسخه كاملاً.";
    case "bad_signature":
      return "الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
  }
}

export default async function StaffSubmittedDraftEditPage({ params, searchParams }: Props) {
  const { draftId } = await params;
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح الطلب</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    select: { id: true, name: true, active: true, portalToken: true },
  });
  if (!staff || !staff.active || staff.portalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح الطلب</p>
            <p className="mt-2 text-sm text-slate-600">الحساب غير مفعّل أو الرابط غير صالح.</p>
          </div>
        </div>
      </div>
    );
  }

  const draft = await prisma.companyPreparerShoppingDraft.findUnique({
    where: { id: draftId },
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
      data: true,
      createdAt: true,
      preparer: { select: { name: true } },
    },
  });
  if (!draft) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">المسودة غير موجودة</p>
          </div>
        </div>
      </div>
    );
  }

  const meta = draft.data && typeof draft.data === "object" ? (draft.data as Record<string, unknown>) : {};
  const owner = String(meta.fromStaffEmployeeId ?? "").trim();
  if (!owner || owner !== staff.id) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">لا صلاحية</p>
            <p className="mt-2 text-sm text-slate-600">هذه المسودة لا تخص حسابك.</p>
          </div>
        </div>
      </div>
    );
  }

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();
  const draftForClient = {
    ...draft,
    customerRegion: draft.customerRegion
      ? {
          ...draft.customerRegion,
          deliveryPrice: draft.customerRegion.deliveryPrice.toString(),
        }
      : null,
  };

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-2xl">
        <div className="mb-3 text-sm">
          <Link
            href={`/staff/portal/submitted?${authQ}`}
            className="font-bold text-sky-700 hover:underline"
          >
            ← الرجوع إلى الطلبات المرفوعة
          </Link>
        </div>
        <StaffSubmittedDraftEditClient
          auth={{ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }}
          staffName={staff.name}
          draft={draftForClient}
        />
      </div>
    </div>
  );
}

