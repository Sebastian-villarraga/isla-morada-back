/** Default service slots; applied only when an operating day is first created. */
export const SATURDAY_SCHEDULE_TEMPLATE = [
  '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:30', '16:00', '17:00', '17:30', '18:00', '18:30', '19:00',
];
export const SUNDAY_SCHEDULE_TEMPLATE = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:30',
  '16:00', '17:00', '17:30', '18:00',
];
export function defaultScheduleTemplate(date: Date): string[] {
  return date.getUTCDay() === 6 ? SATURDAY_SCHEDULE_TEMPLATE : date.getUTCDay() === 0 ? SUNDAY_SCHEDULE_TEMPLATE : [];
}
