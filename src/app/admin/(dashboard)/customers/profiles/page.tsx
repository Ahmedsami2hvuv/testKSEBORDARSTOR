import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تفاصيل الزبائن المرجعية — أبو الأكبر للتوصيل",
};

export default async function CustomerProfilesPage() {
  redirect("/admin/customers#profiles");
}
