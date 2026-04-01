import Link from "next/link";

export default function Home() {
  return (
    <div className="kse-app-bg flex min-h-screen flex-col">
      <div className="kse-app-inner flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="kse-glass-card max-w-lg p-10 text-center">
          <p className="text-sm font-bold text-sky-800">أبو الأكبر للتوصيل</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            نظام إدارة التوصيل
          </h1>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/admin/login"
              className="inline-flex w-full max-w-xs justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-sky-200 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/register"
              className="inline-flex w-full max-w-xs justify-center rounded-xl border-2 border-sky-300 bg-white px-6 py-3 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
            >
              إنشاء الحساب
            </Link>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-sky-700 underline underline-offset-4 transition hover:text-sky-900"
            >
              نسيت الرمز؟
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
