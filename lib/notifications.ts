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
  room?: { name: string } | null;
};

export function notificationCopy(event: string = 'updated') {
  const copy: Record<string, { subject: string; text: string }> = {
    created: { subject: 'Reservation received', text: 'Your Sakura Ananda reservation request has been received.' },
    confirmed: { subject: 'Reservation confirmed', text: 'Your Sakura Ananda reservation has been confirmed.' },
    cancelled: { subject: 'Reservation cancelled', text: 'Your Sakura Ananda reservation has been cancelled.' },
    'checked-in': { subject: 'Welcome to Sakura Ananda', text: 'Your check-in has been recorded.' },
    'checked-out': { subject: 'Thank you for staying with us', text: 'Your checkout has been recorded. Thank you for staying with us.' },
    paid: { subject: 'Payment received', text: 'Your reservation payment has been marked as fully paid.' },
    unpaid: { subject: 'Payment status updated', text: 'Your reservation payment status has been updated.' },
    updated: { subject: 'Reservation updated', text: 'Your Sakura Ananda reservation details have been updated.' },
  };
  return copy[event] || copy.updated;
}
