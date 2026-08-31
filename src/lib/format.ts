export function fmt(n: number | null | undefined, d = 3): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function g(n: number | null | undefined, d = 3): string {
  return `${fmt(n, d)} g`;
}
export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${fmt(n, 2)}%`;
}
