export const pad = (value: number) => String(value).padStart(2, '0');
export const dateKey = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;
export const todayKey = (now = new Date()) =>
  dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
export const dateParts = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
};
export const daysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();
export const weekday = (date: string) => {
  const { year, month, day } = dateParts(date);
  return '일월화수목금토'[new Date(year, month - 1, day).getDay()];
};
export const dateLabel = (date: string) => {
  const { year, month, day } = dateParts(date);
  return `${year}년 ${month}월 ${day}일 ${weekday(date)}요일`;
};
export function shiftMonth(date: string, offset: number) {
  const { year, month, day } = dateParts(date);
  const next = new Date(year, month - 1 + offset, 1);
  return dateKey(
    next.getFullYear(),
    next.getMonth() + 1,
    Math.min(day, daysInMonth(next.getFullYear(), next.getMonth() + 1)),
  );
}
export function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const { year, month, day } = dateParts(date);
  return (
    year >= 1900 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}
