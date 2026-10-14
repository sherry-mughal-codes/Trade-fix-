export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function toMonthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function clampDayToMonth(year: number, month: number, day: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(day, daysInMonth);
}
