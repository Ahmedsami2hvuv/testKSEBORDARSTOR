"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type StaffEmployeeActionState = { error?: string; ok?: boolean };

export async function createStaffEmployee(
  _prev: StaffEmployeeActionState,
  formData: FormData,
): Promise<StaffEmployeeActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "اسم الموظف مطلوب." };

  await prisma.staffEmployee.create({
    data: {
      name,
      phone,
      active: true,
    },
  });

  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function updateStaffEmployee(
  _prev: StaffEmployeeActionState,
  formData: FormData,
): Promise<StaffEmployeeActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!id) return { error: "معرّف الموظف مفقود." };
  if (!name) return { error: "اسم الموظف مطلوب." };

  await prisma.staffEmployee.update({
    where: { id },
    data: { name, phone },
  });

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${id}/edit`);
  return { ok: true };
}

/** Wrapper for <form action>, which receives only FormData */
export async function updateStaffEmployeeForm(formData: FormData): Promise<void> {
  await updateStaffEmployee({}, formData);
}

export async function renewStaffEmployeePortalToken(
  _prev: StaffEmployeeActionState,
  formData: FormData,
): Promise<StaffEmployeeActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "معرّف الموظف مفقود." };

  // نولّد token جديد بسيط (لا يعتمد على DB default حتى يبقى متوافق مع deploy)
  const next = `r_${Date.now()}_${id}`;
  await prisma.staffEmployee.update({ where: { id }, data: { portalToken: next } });

  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function toggleStaffEmployeeActive(
  _prev: StaffEmployeeActionState,
  formData: FormData,
): Promise<StaffEmployeeActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const activeRaw = String(formData.get("active") ?? "").trim();
  const active = activeRaw === "true" || activeRaw === "on";
  if (!id) return { error: "معرّف الموظف مفقود." };

  await prisma.staffEmployee.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function deleteStaffEmployee(
  _prev: StaffEmployeeActionState,
  formData: FormData,
): Promise<StaffEmployeeActionState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "معرّف الموظف مفقود." };

  await prisma.staffEmployee.delete({ where: { id } });
  revalidatePath("/admin/employees");
  return { ok: true };
}

