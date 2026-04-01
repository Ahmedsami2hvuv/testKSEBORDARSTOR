import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { EditBranchForm } from "./edit-branch-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditStoreBranchPage({ params }: Props) {
  if (!(await isAdminSession())) redirect("/admin/login");
  const { id } = await params;

  const [branch, shops] = await Promise.all([
    prisma.storeBranch.findUnique({ where: { id } }),
    prisma.shop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!branch) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={ad.h1}>تعديل الفرع</h1>
        <Link href="/admin/store/branches" className={ad.link}>
          ← رجوع
        </Link>
      </div>
      <section className={ad.section}>
        <EditBranchForm branch={branch} shops={shops} />
      </section>
    </div>
  );
}

