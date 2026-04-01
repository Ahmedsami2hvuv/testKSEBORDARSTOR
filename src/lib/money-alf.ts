/** القيم المخزّنة في قاعدة البيانات بالدينار الكامل؛ العرض والإدخال بالألف (10 = 10000 دينار). */

export const ALF_PER_DINAR = 1000;

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function trimTrailingZeros(s: string): string {
  return s.replace(/\.?0+$/, "") || "0";
}

/** عرض مبلغ مخزّن بالدينار كرقم بالألف (بدون كلمة «ألف»). */
export function formatDinarAsAlf(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return "—";
  const alf = n / ALF_PER_DINAR;
  return trimTrailingZeros(alf.toFixed(2));
}

/** عرض مع ذكر الوحدة */
export function formatDinarAsAlfWithUnit(v: unknown): string {
  if (toNumber(v) == null) return "—";
  return `${formatDinarAsAlf(v)} ألف`;
}

/** قيمة افتراضية لحقول الإدخال (نص بالألف) من رقم دينار */
export function dinarDecimalToAlfInputString(v: unknown): string {
  const n = toNumber(v);
  if (n == null) return "";
  const alf = n / ALF_PER_DINAR;
  return trimTrailingZeros(alf.toFixed(2));
}

/** تحويل ما يكتبه المستخدم (بالألف) إلى دينار (رقم) للتخزين */
export function parseAlfInputToDinarNumber(raw: string): number | null {
  const t = raw.replace(/,/g, ".").trim();
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * ALF_PER_DINAR;
}

export function parseAlfInputToDinarDecimalRequired(
  raw: string,
): { ok: true; value: number } | { ok: false } {
  const v = parseAlfInputToDinarNumber(raw);
  if (v == null) return { ok: false };
  return { ok: true, value: v };
}

/** حقل مبلغ اختياري فارغ = null */
export function parseOptionalAlfInputToDinar(
  raw: string,
): { ok: true; value: number | null } | { ok: false } {
  const t = raw.replace(/,/g, ".").trim();
  if (!t) return { ok: true, value: null };
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n * ALF_PER_DINAR };
}

/** للحسابات الداخلية: نص ألف → دينار، فارغ = 0 */
export function parseAlfInputToDinarOrZero(raw: string): number {
  return parseAlfInputToDinarNumber(raw) ?? 0;
}

/** فلاتر البحث: المستخدم يدخل المبلغ بالألف → حدّ دينار في الاستعلام */
export function alfAmountToDinarFilter(n: number): number {
  if (!Number.isFinite(n)) return n;
  return n * ALF_PER_DINAR;
}
