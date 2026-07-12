const INDIA_TIME_ZONE = "Asia/Kolkata";

export function parseDateOnly(dateString: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  const date = new Date(`${dateString}T00:00:00.000+05:30`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentMonthInIndia() {
  return todayInIndia().slice(0, 7);
}

export function isDateInCurrentIndiaMonth(dateString: string) {
  return dateString.slice(0, 7) === currentMonthInIndia();
}

export function monthBoundsUtc(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Invalid month. Expected YYYY-MM");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00.000+05:30`);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const end = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000+05:30`
  );
  return { start, end };
}

export function formatDateIndia(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function monthFromDateIndia(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Date month resolve nahi ho paya");
  return `${year}-${month}`;
}
