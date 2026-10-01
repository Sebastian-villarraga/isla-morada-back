import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function reservationConfirmationEmail(data: {
  name: string; code: string; date: string; time: string; pax: number; restaurantName: string;
}): string {
  return render('reservation-confirmation.html', data);
}

export function reservationUpdatedEmail(name: string, code: string): string {
  return render('reservation-updated.html', { name, code });
}

export function reservationCancelledEmail(name: string, code: string): string {
  return render('reservation-cancelled.html', { name, code });
}

export function availabilityEmail(name: string, code: string): string {
  return render('availability-notification.html', { name, code });
}

export function waitlistEmail(name: string): string {
  return render('waitlist-notification.html', { name });
}

function render(template: string, variables: Record<string, string | number>): string {
  let html = readFileSync(join(__dirname, template), 'utf8');
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, escapeHtml(String(value)));
  }
  return html;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}