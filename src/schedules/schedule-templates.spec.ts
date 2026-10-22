import { defaultScheduleTemplate, SATURDAY_SCHEDULE_TEMPLATE, SUNDAY_SCHEDULE_TEMPLATE } from './schedule-templates';

describe('default schedule templates', () => {
  it('uses the complete Saturday template', () => {
    expect(defaultScheduleTemplate(new Date('2026-10-24T00:00:00.000Z'))).toEqual(SATURDAY_SCHEDULE_TEMPLATE);
    expect(SATURDAY_SCHEDULE_TEMPLATE).toHaveLength(14);
  });

  it('uses the complete Sunday template and none for exceptional weekdays', () => {
    expect(defaultScheduleTemplate(new Date('2026-10-25T00:00:00.000Z'))).toEqual(SUNDAY_SCHEDULE_TEMPLATE);
    expect(SUNDAY_SCHEDULE_TEMPLATE).toHaveLength(11);
    expect(defaultScheduleTemplate(new Date('2026-10-26T00:00:00.000Z'))).toEqual([]);
  });
});
