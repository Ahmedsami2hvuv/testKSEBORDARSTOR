"use client";

import { useActionState, useEffect, useState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  createCompanyPreparer,
  payDailySalaryForCompanyPreparer,
  setPreparerShops,
  setPreparerMonthlySalaryResetConfig,
  updateCompanyPreparer,
  renewCompanyPreparerPortalToken,
  deleteCompanyPreparer,
  type PreparerFormState,
} from "./actions";
import { whatsappMeUrl } from "@/lib/whatsapp";

const initial: PreparerFormState = {};

export type PreparerManagerRow = {
  id: string;
  name: string;
  phone: string;
  telegramUserId: string;
  notes: string;
  active: boolean;
  linkedShopIds: string[];
  canSubmitShopIds: string[];
  linkedShops: { id: string; name: string }[];
  portalUrl: string;
  preparerMonthlySalaryResetMode: "calendar_month" | "every_n_days" | "manual";
  preparerMonthlySalaryResetAt: string | null;
  preparerMonthlySalaryResetEveryDays: number | null;
};

export type ShopOption = { id: string; name: string };

function AddPreparerForm() {
  const [state, formAction, pending] = useActionState(createCompanyPreparer, initial);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setKey((k) => k + 1);
      setName("");
      setPhone("");
      setTelegramUserId("");
      setNotes("");
    }
  }, [state?.ok]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ad.btnPrimary}>
        ➕ إضافة مجهز جديد
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className={ad.h2}>إضافة مجهز (حساب فريق الإدارة)</h2>
        <button type="button" onClick={() => setOpen(false)} className={ad.btnDark}>
          إلغاء
        </button>
      </div>
      <form key={key} action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={ad.label}>اسم المجهز *</span>
            <input
              name="name"
              required
              className={ad.input}
              placeholder="الاسم الظاهر في القائمة"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>هاتف (اختياري)</span>
            <input
              name="phone"
              className={ad.input}
              inputMode="numeric"
              placeholder="07…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>معرّف تلغرام (اختياري)</span>
            <input
              name="telegramUserId"
              className={ad.input}
              dir="ltr"
              placeholder="للإشعارات لاحقاً"
              value={telegramUserId}
              onChange={(e) => setTelegramUserId(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={ad.label}>ملاحظات</span>
            <input
              name="notes"
              className={ad.input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {state?.error ? <p className={ad.error}>{state.error}</p> : null}
        {state?.ok ? <p className={ad.success}>تمت الإضافة.</p> : null}
        <button type="submit" disabled={pending} className={ad.btnPrimary}>
          {pending ? "جارٍ الحفظ…" : "إضافة مجهز"}
        </button>
      </form>
    </div>
  );
}

function PreparerPortalLink({
  id,
  url,
  phone,
  preparerName,
}: {
  id: string;
  url: string;
  phone: string;
  preparerName: string;
}) {
  const [copied, setCopied] = useState(false);
  const greeting = preparerName.trim() ? `مرحباً ${preparerName.trim()}،` : "مرحباً،";
  const waText = `${greeting}\n\nرابط بوابة المجهز:\n${url}\n\n(هذا الرابط دائم — يرجى عدم مشاركته مع أحد.)`;
  const waHref = whatsappMeUrl(phone, waText);
  const canWhatsApp = waHref !== "#";

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className={`text-xs font-bold text-emerald-900`}>رابط بوابة المجهز (دائم)</p>
        <form action={renewCompanyPreparerPortalToken} onSubmit={(e) => {
          if (!confirm("هل أنت متأكد؟ سيتم إبطال الرابط القديم فوراً ولن يفتح عند المجهز حتى ترسل له الرابط الجديد.")) e.preventDefault();
        }}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="text-[10px] font-black text-rose-700 underline decoration-rose-300 hover:text-rose-900">
            🔄 إعادة تعيين الرمز (إبطال الرابط الحالي)
          </button>
        </form>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input readOnly value={url} className={`${ad.input} flex-1 font-mono text-xs`} dir="ltr" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${ad.btnDark} text-center`}
        >
          فتح الرابط
        </a>
        {canWhatsApp ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            title="إرسال الرابط للمجهز عبر واتساب"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-3 py-2 text-sm font-bold text-slate-900 shadow-sm ring-1 ring-emerald-300/50 transition hover:from-emerald-300 hover:to-emerald-400"
          >
            واتساب للمجهز
          </a>
        ) : null}
        <button
          type="button"
          className={ad.btnPrimary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
            }
          }}
        >
          {copied ? "تم النسخ" : "نسخ"}
        </button>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        الرابط دائم ولا يحتاج لتجديد إلا إذا أردت إبطاله من زر «إعادة تعيين» أعلاه.
      </p>
    </div>
  );
}

function PreparerCard({
  row,
  allShops,
}: {
  row: PreparerManagerRow;
  allShops: ShopOption[];
}) {
  const [uState, updateAction, uPending] = useActionState(updateCompanyPreparer, initial);
  const [sState, shopsAction, sPending] = useActionState(setPreparerShops, initial);
  const [salaryState, salaryAction, salaryPending] = useActionState(payDailySalaryForCompanyPreparer, initial);
  const [resetState, resetAction, resetPending] = useActionState(setPreparerMonthlySalaryResetConfig, initial);
  const [dState, deleteAction, dPending] = useActionState(deleteCompanyPreparer, initial);

  const linked = new Set(row.linkedShopIds);
  const canSubmit = new Set(row.canSubmitShopIds);

  return (
    <div
      className={`${ad.section} ${row.active ? "" : "border-slate-300 bg-slate-50/80 opacity-90"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{row.name}</h3>
          <p className="text-sm text-slate-600">
            {row.phone?.trim() ? (
              <span className="font-mono tabular-nums">{row.phone}</span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </p>
          <p className="mt-1">
            {row.active ? (
              <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                نشط
              </span>
            ) : (
              <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                متوقف
              </span>
            )}
          </p>
        </div>

        <form action={deleteAction} onSubmit={(e) => {
          if (!confirm(`هل أنت متأكد من مسح المجهز "${row.name}" تماماً؟ لا يمكن التراجع عن هذا الإجراء.`)) e.preventDefault();
        }}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            disabled={dPending}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
          >
            {dPending ? "جارٍ المسح…" : "🗑️ مسح المجهز"}
          </button>
          {dState?.error && <p className="mt-1 text-[10px] font-bold text-rose-700">{dState.error}</p>}
        </form>
      </div>

      {row.telegramUserId?.trim() ? (
        <p className="mt-1 text-xs font-mono text-slate-600" dir="ltr">
          تلغرام: {row.telegramUserId}
        </p>
      ) : null}

      {row.notes?.trim() ? (
        <p className="mt-2 text-sm text-slate-600">{row.notes}</p>
      ) : null}

      <PreparerPortalLink id={row.id} url={row.portalUrl} phone={row.phone} preparerName={row.name} />

      <div className="mt-3 flex flex-wrap gap-2">
        {row.linkedShops.length === 0 ? (
          <span className="text-sm font-medium text-amber-800">لا محلات مربوطة بعد</span>
        ) : (
          row.linkedShops.map((s) => (
            <span
              key={s.id}
              className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-900"
            >
              {s.name}
            </span>
          ))
        )}
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-900">دفع راتب يومي</p>
            <p className="mt-1 text-xs text-slate-600">يسجّل ضمن محفظة المجهز كمعاملة «أخذت».</p>
          </div>
          <form action={salaryAction} className="flex items-end gap-2">
            <input type="hidden" name="preparerId" value={row.id} />
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-700">المبلغ (ألف)</span>
              <input
                name="amountAlf"
                inputMode="decimal"
                placeholder="0"
                dir="ltr"
                className={`${ad.input} h-10 w-28 font-mono text-xs`}
              />
            </label>
            <button
              type="submit"
              disabled={salaryPending}
              className="min-h-[44px] rounded-xl border-2 border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {salaryPending ? "جارٍ…" : "دفع"}
            </button>
          </form>
        </div>
        {salaryState?.error ? <p className={ad.error}>{salaryState.error}</p> : null}
        {salaryState?.ok ? <p className={ad.success}>تم الدفع.</p> : null}

        <div className="mt-3 rounded-xl border border-amber-100 bg-white/70 p-2">
          <p className="text-xs font-bold text-amber-900">تصفير الراتب الشهري</p>
          <p className="mt-1 text-[11px] text-slate-600">
            الحالي:{" "}
            <span className="font-bold text-slate-800">
              {row.preparerMonthlySalaryResetMode === "calendar_month"
                ? "حسب التقويم"
                : row.preparerMonthlySalaryResetMode === "every_n_days"
                  ? `كل ${row.preparerMonthlySalaryResetEveryDays ?? "N"} يوم`
                  : "يدوي"}
            </span>
          </p>
          {row.preparerMonthlySalaryResetAt ? (
            <p className="mt-1 text-[11px] text-slate-500">آخر تصفير: {row.preparerMonthlySalaryResetAt}</p>
          ) : null}

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <form action={resetAction} className="flex gap-2 sm:col-span-2">
              <input type="hidden" name="preparerId" value={row.id} />
              <input type="hidden" name="mode" value="calendar_month" />
              <input type="hidden" name="resetNow" value="0" />
              <button
                type="submit"
                disabled={resetPending}
                className="flex-1 min-h-[44px] rounded-xl border-2 border-amber-600 bg-amber-600 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
              >
                حسب التقويم
              </button>
            </form>

            <form action={resetAction} className="flex gap-2">
              <input type="hidden" name="preparerId" value={row.id} />
              <input type="hidden" name="mode" value="every_n_days" />
              <input type="hidden" name="resetNow" value="1" />
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-[11px] font-bold text-slate-700">كل N أيام</span>
                <input
                  name="everyDays"
                  inputMode="numeric"
                  defaultValue={row.preparerMonthlySalaryResetEveryDays ?? 30}
                  dir="ltr"
                  className={`${ad.input} h-10 w-full font-mono text-xs`}
                />
              </label>
              <button
                type="submit"
                disabled={resetPending}
                className="min-h-[44px] rounded-xl border-2 border-amber-600 bg-amber-600 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
              >
                صفر
              </button>
            </form>

            <form action={resetAction} className="flex gap-2">
              <input type="hidden" name="preparerId" value={row.id} />
              <input type="hidden" name="mode" value="manual" />
              <input type="hidden" name="resetNow" value="1" />
              <button
                type="submit"
                disabled={resetPending}
                className="flex-1 min-h-[44px] rounded-xl border-2 border-rose-500 bg-rose-500 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-rose-600 disabled:opacity-60"
              >
                تصفير يدوي
              </button>
            </form>
          </div>

          {resetState?.error ? <p className="mt-2 text-sm font-bold text-rose-700">{resetState.error}</p> : null}
          {resetState?.ok ? <p className="mt-2 text-sm font-bold text-emerald-700">تم التحديث.</p> : null}
        </div>
      </div>

      <details className="mt-4 border-t border-sky-100 pt-3">
        <summary className="cursor-pointer text-sm font-bold text-sky-800">تعديل الاسم والهاتف والحالة</summary>
        <form action={updateAction} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={row.id} />
          <label className="flex flex-col gap-1">
            <span className={ad.label}>الاسم</span>
            <input name="name" defaultValue={row.name} required className={ad.input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>الهاتف</span>
            <input name="phone" defaultValue={row.phone} className={ad.input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>معرّف تلغرام</span>
            <input
              name="telegramUserId"
              defaultValue={row.telegramUserId}
              className={ad.input}
              dir="ltr"
              placeholder="اختياري"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>ملاحظات</span>
            <input name="notes" defaultValue={row.notes} className={ad.input} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" name="active" value="1" defaultChecked={row.active} />
            نشط (يظهر في القائمة)
          </label>
          {uState?.error ? <p className={ad.error}>{uState.error}</p> : null}
          {uState?.ok ? <p className={ad.success}>تم الحفظ.</p> : null}
          <button type="submit" disabled={uPending} className={ad.btnDark}>
            {uPending ? "…" : "حفظ التعديل"}
          </button>
        </form>
      </details>

      <details className="mt-3 border-t border-sky-100 pt-3">
        <summary className="cursor-pointer text-sm font-bold text-sky-800">
          ربط المحلات (يتابع هذا المجهز هذه المحلات)
        </summary>
        <form action={shopsAction} className="mt-3 space-y-2">
          <input type="hidden" name="preparerId" value={row.id} />
          {allShops.length === 0 ? (
            <p className={ad.warn}>لا توجد محلات — أضف محلاً من قسم المحلات أولاً.</p>
          ) : (
            <>
              <p className={`text-xs text-slate-600`}>
                اربط المحل أولاً، ثم فعّل «رفع طلب» للمحلات التي يُسمح للمجهز برفع طلباتها من البوابة.
              </p>
              <ul className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                {allShops.map((s) => (
                  <li key={s.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-800">
                      <input
                        type="checkbox"
                        name="shopIds"
                        value={s.id}
                        defaultChecked={linked.has(s.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {s.name}
                    </label>
                    <label className="mr-6 mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-sky-900">
                      <input
                        type="checkbox"
                        name="canSubmitShopIds"
                        value={s.id}
                        defaultChecked={linked.has(s.id) && canSubmit.has(s.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      صلاحية رفع طلب لهذا المحل
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          {sState?.error ? <p className={ad.error}>{sState.error}</p> : null}
          {sState?.ok ? <p className={ad.success}>تم تحديث الربط.</p> : null}
          <button type="submit" disabled={sPending || allShops.length === 0} className={ad.btnPrimary}>
            {sPending ? "…" : "حفظ المحلات"}
          </button>
        </form>
      </details>
    </div>
  );
}

export function PreparersManager({
  rows,
  allShops,
}: {
  rows: PreparerManagerRow[];
  allShops: ShopOption[];
}) {
  return (
    <div className="space-y-8">
      <AddPreparerForm />

      <section className="space-y-4">
        <h2 className={ad.h2}>قائمة المجهزين ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
            لا يوجد مجهزون بعد. استخدم زر الإضافة أعلاه.
          </p>
        ) : (
          rows.map((row) => <PreparerCard key={row.id} row={row} allShops={allShops} />)
        )}
      </section>
    </div>
  );
}
