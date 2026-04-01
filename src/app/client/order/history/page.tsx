import Link from "next/link";
import {
  clientOrderAccountPath,
  clientOrderEditPath,
  clientOrderFormPath,
} from "@/lib/client-order-portal-nav";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سجل الطلبات — أبو الأكبر للتوصيل",
};

function invalidMessage(reason: EmployeeOrderPortalVerifyReason): string {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من موظف المحل.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
  }
}

function statusAr(v: string): string {
  switch (v) {
    case "pending":
      return "طلب جديد";
    case "assigned":
      return "بانتظار المندوب";
    case "delivering":
      return "عند المندوب";
    case "delivered":
      return "تم التسليم";
    case "cancelled":
      return "ملغي/مرفوض";
    case "archived":
      return "مؤرشف";
    default:
      return v || "—";
  }
}

function maskPhoneLocal(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  }
  return phone.trim() ? "****" : "—";
}

type Props = {
  searchParams: Promise<{ e?: string; exp?: string; s?: string; phone?: string; customerPhone?: string }>;
};

export default async function ClientOrderHistoryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح سجل الطلبات</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    include: { shop: true },
  });

  if (!employee) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-slate-800">الموظف غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  if (employee.orderPortalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح سجل الطلبات</p>
            <p className="mt-2 text-sm text-slate-600">الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.</p>
          </div>
        </div>
      </div>
    );
  }

  const viewer =
    normalizeIraqMobileLocal11(sp.phone ?? "") ??
    normalizeIraqMobileLocal11(sp.customerPhone ?? "") ??
    "";

  const orders = await prisma.order.findMany({
    where: { shopId: employee.shop.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      orderNumber: true,
      status: true,
      orderType: true,
      createdAt: true,
      customerPhone: true,
      orderNoteTime: true,
    },
  });

  const e = sp.e ?? "";
  const exp = sp.exp ?? "";
  const sig = sp.s ?? "";
  const orderFormHref = clientOrderFormPath(e, exp, sig);
  const accountHref = clientOrderAccountPath(e, exp, sig);

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-lg space-y-5">
        <header className="kse-glass-dark rounded-2xl border border-sky-200 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">
            أبو الأكبر للتوصيل
          </p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">سجل الطلبات</h1>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{employee.shop.name}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={accountHref}
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
            >
              إحصائيات طلباتك
            </Link>
            <Link
              href={orderFormHref}
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              رفع طلب جديد
            </Link>
          </div>
        </header>

        <section className="kse-glass-dark rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-800">رقم الهاتف</h2>
          <form
            method="get"
            action="/client/order/history"
            className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="e" value={sp.e ?? ""} />
            <input type="hidden" name="exp" value={sp.exp ?? ""} />
            <input type="hidden" name="s" value={sp.s ?? ""} />
            <label className="min-w-0 flex-1">
              <span className="sr-only">رقم الهاتف</span>
              <input
                name="phone"
                defaultValue={sp.phone ?? sp.customerPhone ?? ""}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="مثال: 07701234567"
                className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm font-mono tabular-nums text-slate-800 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
            >
              تحديث
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700">
            آخر الطلبات ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
              لا توجد طلبات مسجّلة لهذا المحل بعد.
            </p>
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => {
                const rowPhone = o.customerPhone?.trim() ?? "";
                const rowNorm = normalizeIraqMobileLocal11(rowPhone);
                const isYours = Boolean(viewer && rowNorm && rowNorm === viewer);
                const canEdit = isYours && (o.status === "pending" || o.status === "assigned");
                const typeLine = o.orderType?.trim() || "—";
                const timeNote = o.orderNoteTime?.trim();
                return (
                  <li
                    key={o.orderNumber}
                    className={`rounded-2xl border px-4 py-3 shadow-sm ${
                      isYours
                        ? "border-emerald-300 bg-emerald-50/90"
                        : "border-slate-200 bg-white/90"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-black tabular-nums text-slate-900">
                        #{o.orderNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isYours
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          {isYours ? "هذا الرقم" : `زبون آخر · ${maskPhoneLocal(rowPhone)}`}
                        </span>
                        {canEdit ? (
                          <Link
                            href={clientOrderEditPath(e, exp, sig, o.orderNumber, rowNorm ?? viewer)}
                            aria-label={`تعديل الطلب رقم ${o.orderNumber}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-base leading-none text-amber-900 shadow-sm transition hover:bg-amber-100"
                            title="تعديل الطلب"
                          >
                            ✏️
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">{typeLine}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="font-semibold text-sky-900">{statusAr(o.status)}</span>
                      <span className="tabular-nums">
                        {o.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    {timeNote ? (
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-600">وقت الطلب:</span> {timeNote}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
