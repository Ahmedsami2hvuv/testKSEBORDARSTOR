import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const a = process.env.COMPANY_PREPARER_PORTAL_SECRET?.trim();
  const b = process.env.EMPLOYEE_ORDER_PORTAL_SECRET?.trim();
  const c = process.env.DELEGATE_PORTAL_SECRET?.trim();
  const d = process.env.ADMIN_SESSION_SECRET?.trim();
  const s = a || b || c || d;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") {
    return "dev-delegate-portal-secret!";
  }
  throw new Error(
    "COMPANY_PREPARER_PORTAL_SECRET أو أحد أسرار البوابات مطلوب (16 حرفاً على الأقل)",
  );
}

function payloadFor(preparerId: string, token: string): string {
  return `cprep:${preparerId}.${token}`;
}

/** رابط بوابة المجهز دائم - يستخدم portalToken الخاص بالمجهز */
export function buildCompanyPreparerPortalUrl(preparerId: string, token: string, baseUrl: string): string {
  const secret = getSecret();
  const payload = payloadFor(preparerId, token);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const root = baseUrl.replace(/\/+$/, "");
  const u = new URL("/preparer", `${root}/`);
  u.searchParams.set("p", preparerId);
  u.searchParams.set("exp", token); // نستخدم exp لحمل الرمز من أجل التوافق
  u.searchParams.set("s", sig);
  return u.toString();
}

export type CompanyPreparerPortalVerifyReason =
  | "missing"
  | "expired"
  | "bad_signature"
  | "no_secret";

export function verifyCompanyPreparerPortalQuery(
  p: string | undefined,
  exp: string | undefined,
  s: string | undefined,
):
  | { ok: true; preparerId: string; token: string }
  | { ok: false; reason: CompanyPreparerPortalVerifyReason } {
  if (!p || !exp || !s) return { ok: false, reason: "missing" };
  if (!/^[a-f0-9]{64}$/i.test(s)) return { ok: false, reason: "bad_signature" };
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "no_secret" };
  }
  
  const token = String(exp).trim();
  if (!token) return { ok: false, reason: "missing" };

  const payload = payloadFor(p, token);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  let sigBuf: Buffer;
  let expBuf: Buffer;
  try {
    sigBuf = Buffer.from(s, "hex");
    expBuf = Buffer.from(expected, "hex");
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true, preparerId: p, token };
}
