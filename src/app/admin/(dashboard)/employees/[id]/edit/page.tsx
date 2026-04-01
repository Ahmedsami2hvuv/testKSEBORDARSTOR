import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { updateStaffEmployeeForm } from "../../actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StaffEmployeeEditPage({ params }: Props) {
  const { id } = await params;
  const emp = await prisma.staffEmployee.findUnique({ where: { id } });
  if (!emp) notFound();

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin/employees" className={ad.link}>
          ← الموظفين
        </Link>
      </p>

      <header className={ad.section}>
        <h1 className={ad.h1}>تعديل الموظف</h1>
        <p className={ad.lead}>{emp.name}</p>
      </header>

      <section className={ad.section}>
        <form action={updateStaffEmployeeForm} className="max-w-xl space-y-4">
          <input type="hidden" name="id" value={emp.id} />
          <label className="block">
            <span className={ad.label}>الاسم *</span>
            <input name="name" defaultValue={emp.name} required className={ad.input} />
          </label>
          <label className="block">
            <span className={ad.label}>الهاتف</span>
            <input name="phone" defaultValue={emp.phone} className={ad.input} />
          </label>
          <button type="submit" className={ad.btnDark}>
            حفظ
          </button>
        </form>
      </section>
    </div>
  );
}

