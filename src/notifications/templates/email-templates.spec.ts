import { reservationConfirmationEmail } from './email-templates';

describe('email templates', () => {
  it('escapes customer-controlled values before inserting them into HTML', () => {
    const html = reservationConfirmationEmail({
      name: '<script>alert(1)</script>',
      code: 'A1',
      date: '2026-10-03',
      time: '12:00',
      pax: 4,
      restaurantName: 'Isla & Morada',
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Isla &amp; Morada');
    expect(html).not.toContain('<script>');
  });
});