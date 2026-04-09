"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { adminCookieName, signAdminToken } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
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
      return { error: "خطأ في إنشاء الجلسة" };
    }

    const jar = await cookies();
    jar.set(adminCookieName, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    redirect("/admin");
  } catch (error) {
    // ضروري جداً لـ Next.js 15: السماح لخطأ الـ redirect بالمرور
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Login Action Error:", error);
    return { error: "حدث خطأ غير متوقع أثناء تسجيل الدخول" };
  }
}
