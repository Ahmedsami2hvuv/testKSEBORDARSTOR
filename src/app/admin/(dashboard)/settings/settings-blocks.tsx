"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NotificationSoundPresetId } from "@/lib/notification-sound-presets";
import { NotificationSettingsForm } from "./notification-settings-form";
import { PurgeDemoDataForm } from "./purge-demo-data-form";
import { TestPushNotificationsForm } from "./test-push-notifications-form";

type NotificationInitial = {
  adminEnabled: boolean;
  adminTemplateSingle: string;
  adminTemplateMultiple: string;
  adminSoundEnabled: boolean;
  adminSoundPreset: NotificationSoundPresetId;
  mandoubEnabled: boolean;
  mandoubTemplateSingle: string;
  mandoubTemplateMultiple: string;
  mandoubSoundEnabled: boolean;
  mandoubSoundPreset: NotificationSoundPresetId;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 transition duration-200 ${open ? "rotate-180" : "rotate-0"}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.4}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Block({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
  tone = "sky",
}: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  tone?: "sky" | "emerald" | "amber" | "rose";
}) {
  const toneClasses = useMemo(() => {
    switch (tone) {
      case "emerald":
        return {
          border: "border-emerald-200/90",
          focus: "focus-visible:ring-emerald-300/60",
          badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
          hover: "hover:border-emerald-300 hover:shadow-emerald-200/40",
        };
      case "amber":
        return {
          border: "border-amber-200/90",
          focus: "focus-visible:ring-amber-300/60",
          badge: "bg-amber-50 text-amber-800 border-amber-200",
          hover: "hover:border-amber-300 hover:shadow-amber-200/40",
        };
      case "rose":
        return {
          border: "border-rose-200/90",
          focus: "focus-visible:ring-rose-300/60",
          badge: "bg-rose-50 text-rose-800 border-rose-200",
          hover: "hover:border-rose-300 hover:shadow-rose-200/40",
        };
      default:
        return {
          border: "border-sky-200/90",
          focus: "focus-visible:ring-sky-300/60",
          badge: "bg-sky-50 text-sky-800 border-sky-200",
          hover: "hover:border-sky-300 hover:shadow-sky-200/40",
        };
    }
  }, [tone]);

  return (
    <section id={id} className={`rounded-2xl border bg-white shadow-sm ${toneClasses.border}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className={`group flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-4 text-start outline-none transition hover:-translate-y-[1px] hover:shadow-md ${toneClasses.hover} ${toneClasses.focus} focus-visible:ring-2 sm:px-5`}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-slate-900">{title}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneClasses.badge}`}
            >
              {open ? "مفتوح" : "مغلق"}
            </span>
          </span>
          {subtitle ? (
            <span className="mt-1 block text-sm leading-relaxed text-slate-600">{subtitle}</span>
          ) : null}
        </span>
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition group-hover:bg-slate-50">
          <ChevronIcon open={open} />
        </span>
      </button>

      <div
        id={`${id}-panel`}
        className={`${open ? "block" : "hidden"} border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5`}
      >
        {children}
      </div>
    </section>
  );
}

export function SettingsBlocks({ notificationInitial }: { notificationInitial: NotificationInitial }) {
  const [openId, setOpenId] = useState<string>("whatsapp");

  return (
    <div className="space-y-4">
      <Block
        id="whatsapp"
        title="إعدادات واتساب"
        subtitle="أزرار واتساب للمندوب والنماذج حسب حالة الطلب."
        open={openId === "whatsapp"}
        onToggle={() => setOpenId((x) => (x === "whatsapp" ? "" : "whatsapp"))}
        tone="emerald"
      >
        <Link
          href="/admin/wa-buttons"
          className="group relative flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm outline-none transition hover:-translate-y-[1px] hover:border-emerald-300 hover:bg-gradient-to-b hover:from-emerald-50/70 hover:to-white hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-300/60 sm:p-5"
        >
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900">أزرار واتساب</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              تعريف أزرار المندوب ثم نصوص الرسائل (من «النماذج») حسب حالة الطلب ولوكيشن الزبون.
            </p>
            <p className="mt-2 text-xs font-bold text-emerald-700 transition group-hover:text-emerald-800">
              فتح الصفحة
            </p>
          </div>
          <span
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-sm transition group-hover:border-emerald-300 group-hover:bg-emerald-50"
            aria-hidden
          >
            <svg
              className="h-5 w-5 transition group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </span>
        </Link>
      </Block>

      <Block
        id="notifications"
        title="إعدادات الإشعارات"
        subtitle="تشغيل/إيقاف، النصوص، نغمة الصوت، والظهور في شريط الإشعارات."
        open={openId === "notifications"}
        onToggle={() => setOpenId((x) => (x === "notifications" ? "" : "notifications"))}
        tone="sky"
      >
        <p className="text-sm text-slate-600">
          لإشعارات الدفع الحقيقية حتى عند إغلاق المتصفح أو التطبيق، يجب ضبط متغيرات مفاتيح VAPID على الخادم (انظر{" "}
          <code className="mx-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.example</code>). بعدها يضغط
          المستخدم «تفعيل إشعارات المتصفح» من لوحة الإدارة أو المندوب ليُسجَّل الجهاز.
        </p>
        <div className="mt-4">
          <NotificationSettingsForm initial={notificationInitial} />
        </div>
      </Block>

      <Block
        id="test-push"
        title="اختبار الإشعارات"
        subtitle="إرسال إشعار تجريبي للأجهزة المسجّلة (Web Push)."
        open={openId === "test-push"}
        onToggle={() => setOpenId((x) => (x === "test-push" ? "" : "test-push"))}
        tone="amber"
      >
        <p className="text-sm text-slate-600">
          تنبيهات «طلب جديد» أثناء فتح لوحة الإدارة قد تأتي أيضاً من تحديث الصفحة كل بضع ثوانٍ — أما عند إغلاق التبويب
          فيعتمد التنبيه على Web Push فقط. على iPhone يجب إضافة الموقع للشاشة الرئيسية (PWA) لتعمل الإشعارات في الخلفية.
        </p>
        <div className="mt-4">
          <TestPushNotificationsForm />
        </div>
      </Block>

      <Block
        id="purge-demo"
        title="المسح والحذف النهائي"
        subtitle="تصفير تجريبي شامل (خطير وغير قابل للتراجع)."
        open={openId === "purge-demo"}
        onToggle={() => setOpenId((x) => (x === "purge-demo" ? "" : "purge-demo"))}
        tone="rose"
      >
        <PurgeDemoDataForm />
      </Block>
    </div>
  );
}

