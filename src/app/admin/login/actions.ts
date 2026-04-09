"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, signAdminToken } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "").trim();
  const expectedRaw = process.env.ADMIN_PASSWORD;
  const expected = expectedRaw?.trim();

  if (!expected) {
    return { error: "ADMIN_PASSWORD غير مضبوط في الخادم" };
  }

  if (password !== expected) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  let token: string;
  try {
    token = await signAdminToken();
  } catch (err) {
    console.error("JWT Signing error:", err);
    return { error: "خطأ في إنشاء الجلسة (قد يكون السر غير مضبوط)" };
  }

  const jar = await cookies();
  jar.set(adminCookieName, token, {
    httpOnly: true,
    secure: true, // نستخدم true دائماً في الإنتاج لتجنب مشاكل Railway HTTPS
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  // الـ redirect يجب أن يكون آخر شيء ولا يكون محاطاً بـ try/catch
  redirect("/admin");
}
