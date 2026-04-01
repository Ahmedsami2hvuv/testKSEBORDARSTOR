import { redirect } from "next/navigation";

/** المسار القديم: التوجيه إلى المستودع ضمن قسم التقارير */
export default function WalletLedgerRedirectPage() {
  redirect("/admin/reports/wallet-ledger");
}
