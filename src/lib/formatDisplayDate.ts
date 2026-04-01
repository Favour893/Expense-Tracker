/** British (en-GB) calendar dates, e.g. 01 Apr 2026 */
export function formatUkDate(ts: unknown): string {
  if (ts == null) return "";
  const dt =
    typeof ts === "object" &&
    ts !== null &&
    "toDate" in ts &&
    typeof (ts as { toDate?: () => Date }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : ts instanceof Date
        ? ts
        : new Date(ts as number | string);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
