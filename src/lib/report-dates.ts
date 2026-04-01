/** نطاق تواريخ للتقارير — تخزين محلي (تقويم) */

function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

export function formatYMDLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export type ReportDateRangeDefaults = "last30" | "today" | "month";

export function parseDateRangeFromSearchParams(
  sp: {
    from?: string;
    to?: string;
  },
  opts?: { defaults?: ReportDateRangeDefaults },
): { from: Date; to: Date; fromInput: string; toInput: string } {
  const today = new Date();
  const defaults = opts?.defaults ?? "last30";

  let defaultTo = endOfDayLocal(today);
  let defaultFrom: Date;

  if (defaults === "today") {
    defaultFrom = startOfDayLocal(today);
    defaultTo = endOfDayLocal(today);
  } else if (defaults === "month") {
    defaultFrom = startOfDayLocal(new Date(today.getFullYear(), today.getMonth(), 1));
    defaultTo = endOfDayLocal(today);
  } else {
    defaultFrom = startOfDayLocal(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29),
    );
  }

  let to = defaultTo;
  let from = defaultFrom;

  if (sp.to?.trim()) {
    const d = parseYMD(sp.to.trim());
    if (d) to = endOfDayLocal(d);
  }
  if (sp.from?.trim()) {
    const d = parseYMD(sp.from.trim());
    if (d) from = startOfDayLocal(d);
  }
  if (from > to) {
    const t = from;
    from = startOfDayLocal(to);
    to = endOfDayLocal(t);
  }

  return {
    from,
    to,
    fromInput: formatYMDLocal(startOfDayLocal(from)),
    toInput: formatYMDLocal(startOfDayLocal(to)),
  };
}
