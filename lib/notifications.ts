export type NotificationReservation = {
  booking_id: string;
  guest_name: string;
  mobile: string;
  email: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  rate_per_night: number;
  nights: number;
  room_total: number;
  deposit: number;
  balance: number;
  payment_method: string;
  status: string;
  notification_consent?: boolean;
  room?: {name: string} | null;
};

/**
 * Email delivery is intentionally handled outside Vercel by the
 * Supabase Database Webhook -> Google Apps Script -> Google MailApp flow.
 */
export function notificationCopy() {
  return {
    subject: 'Sakura Ananda Resort booking update',
    text: 'Customer email is sent by Google Apps Script MailApp after the Supabase reservation webhook.',
    html: '<p>Customer email is sent by Google Apps Script MailApp after the Supabase reservation webhook.</p>',
    sms: '',
  };
}
