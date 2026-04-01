export function formatBaghdadDateTime(
  date: Date,
  opts: { dateStyle?: "short" | "medium"; timeStyle?: "short" | "medium" } = {
    dateStyle: "short",
    timeStyle: "short",
  },
): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ar-IQ-u-nu-latn", {
    ...opts,
    timeZone: "Asia/Baghdad",
  });
}

