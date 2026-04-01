"use server";

import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { notifyTelegramPreparerWalletEvent } from "@/lib/telegram-notify";
import { writeLedgerEntriesForAcceptedTransfer } from "@/lib/wallet-peer-transfer";

export type WalletPeerTransferState = { error?: string };
export type EmployeeWalletMiscState = { error?: string };

function revalidateAll(p: string, exp: string, s: string) {
  revalidatePath("/preparer/wallet");
  revalidatePath("/mandoub/wallet");
  revalidatePath("/mandoub");
}

export async function submitEmployeeWalletMiscEntryFromCompanyPreparer(_prev: EmployeeWalletMiscState, formData: FormData): Promise<EmployeeWalletMiscState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const directionRaw = String(formData.get("direction") ?? "");
  const label = String(formData.get("label") ?? "");
  const amountRaw = String(formData.get("amountAlf") ?? "");
  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "المبلغ غير صالح." };

  const amountDinar = new Decimal(parsed.value);
  const cp = await prisma.companyPreparer.findUnique({ where: { id: v.preparerId } });
  if (!cp?.walletEmployeeId) return { error: "المحفظة غير مربوطة." };

  await prisma.employeeWalletMiscEntry.create({
    data: {
      employeeId: cp.walletEmployeeId,
      direction: directionRaw === "take" ? "take" : "give",
      amountDinar,
      label,
    },
  });

  await notifyTelegramPreparerWalletEvent({
    preparerId: v.preparerId,
    kind: directionRaw === "take" ? "take" : "give",
    amountDinar,
    label
  });

  revalidateAll(p, exp, s);
  redirect(`/preparer/wallet?p=${p}&exp=${exp}&s=${s}`);
}

/** مسح معاملة محفظة يدوية للمجهز */
export async function softDeleteEmployeeWalletMiscEntryFromCompanyPreparer(
  _prev: EmployeeWalletMiscState,
  formData: FormData
): Promise<EmployeeWalletMiscState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const entryId = String(formData.get("miscEntryId") ?? "").trim();
  if (!entryId) return { error: "المعرف مطلوب." };

  await prisma.employeeWalletMiscEntry.update({
    where: { id: entryId },
    data: { deletedAt: new Date() },
  });

  revalidateAll(p, exp, s);
  redirect(`/preparer/wallet?p=${p}&exp=${exp}&s=${s}`);
}

export async function createWalletPeerTransferFromCompanyPreparer(_prev: WalletPeerTransferState, formData: FormData): Promise<WalletPeerTransferState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const amountRaw = String(formData.get("amountAlf") ?? "");
  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "المبلغ غير صالح." };
  const amountDinar = new Decimal(parsed.value);

  const cp = await prisma.companyPreparer.findUnique({ where: { id: v.preparerId } });
  if (!cp?.walletEmployeeId) return { error: "المحفظة غير مربوطة." };

  const toKind = String(formData.get("toKind") ?? "");
  const handoverLocation = String(formData.get("handoverLocation") ?? "");

  await prisma.walletPeerTransfer.create({
    data: {
      status: "pending", amountDinar, handoverLocation,
      fromKind: "employee", fromEmployeeId: cp.walletEmployeeId,
      toKind: toKind === "admin" ? "admin" : toKind === "courier" ? "courier" : "employee",
      toCourierId: formData.get("toCourierId") ? String(formData.get("toCourierId")) : null,
      toEmployeeId: formData.get("toEmployeeId") ? String(formData.get("toEmployeeId")) : null,
    }
  });

  revalidateAll(p, exp, s);
  redirect(`/preparer/wallet?p=${p}&exp=${exp}&s=${s}`);
}

export async function respondWalletPeerTransferByCompanyPreparer(_prev: WalletPeerTransferState, formData: FormData): Promise<WalletPeerTransferState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const transferId = String(formData.get("transferId") ?? "");
  const accept = formData.get("accept") === "1";

  const t = await prisma.walletPeerTransfer.findUnique({ where: { id: transferId } });
  if (!t) return { error: "التحويل غير موجود." };

  if (accept) {
    await prisma.$transaction(async (tx) => {
      // تحديث الحالة
      await tx.walletPeerTransfer.update({
        where: { id: transferId },
        data: { status: "accepted", respondedAt: new Date() }
      });
      // تسجيل القيود المزدوجة (الطرف المرسل والمستقبل)
      await writeLedgerEntriesForAcceptedTransfer(tx, t);
    });

    await notifyTelegramPreparerWalletEvent({
      preparerId: v.preparerId, kind: "transfer_in", amountDinar: t.amountDinar, label: `قبول تحويل: ${t.handoverLocation}`
    });
  } else {
    await prisma.walletPeerTransfer.update({
      where: { id: transferId },
      data: { status: "rejected", respondedAt: new Date() }
    });
  }

  revalidateAll(p, exp, s);
  redirect(`/preparer/wallet?p=${p}&exp=${exp}&s=${s}`);
}
