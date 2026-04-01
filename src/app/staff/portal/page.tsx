import Link from "next/link";
import type { StaffEmployeePortalVerifyReason } from "@/lib/staff-employee-portal-link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
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

export default async function StaffPortalPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح بوابة الموظف</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const emp = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!emp || !emp.active || emp.portalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح بوابة الموظف</p>
            <p className="mt-2 text-sm text-slate-600">الرابط غير صالح أو الحساب غير مفعّل.</p>
          </div>
        </div>
      </div>
    );
  }

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  return (
    <div className="kse-app-bg min-h-screen px-4 py-10 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-md">
        <div className="kse-glass-dark rounded-2xl border border-sky-200 p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">أبو الأكبر للتوصيل</p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">بوابة الموظف</h1>
          <p className="mt-2 text-sm text-slate-700">
            أهلاً <span className="font-black text-sky-900">{emp.name}</span>
          </p>
          <div className="mt-5 grid gap-2">
            <Link
              href={`/staff/portal/preparation?${authQ}`}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:from-violet-700 hover:to-sky-700"
            >
              إنشاء طلب تجهيز (تحليل)
            </Link>
            <Link
              href={`/staff/portal/submitted?${authQ}`}
              className="w-full rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-black text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              الطلبات المرفوعة
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            هذه البوابة جاهزة للرابط والمشاركة. سيتم إضافة وظائف الموظف هنا حسب الكيانات المطلوبة.
          </p>
          <p className="mt-5 text-xs text-slate-500">
            إذا تحتاج صلاحيات/صفحات إضافية، تواصل مع الإدارة.
          </p>
          <div className="mt-5">
            <Link href="/" className="text-sm font-bold text-sky-700 hover:underline">
              العودة للموقع
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

