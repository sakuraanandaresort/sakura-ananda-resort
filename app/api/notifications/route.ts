import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const RESORT_NAME = 'Sakura Ananda Resort';

function peso(value: unknown) {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function date(value: unknown) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${String(value)}T00:00:00+08:00`));
}

function eventCopy(event: string) {
  const copies: Record<string, { title: string; intro: string }> = {
    created: { title: 'Reservation received', intro: 'We have received your reservation request. Our team will review the details and confirm your stay.' },
    confirmed: { title: 'Reservation confirmed', intro: 'Your stay at Sakura Ananda Resort is confirmed. We look forward to welcoming you.' },
    cancelled: { title: 'Reservation cancelled', intro: 'Your reservation has been cancelled. Please contact the resort if you need assistance.' },
    'checked-in': { title: 'Welcome to Sakura Ananda', intro: 'Your check-in has been recorded. Relax, settle in and enjoy your stay.' },
    'checked-out': { title: 'Thank you for staying with us', intro: 'Your checkout has been recorded. Thank you for choosing Sakura Ananda Resort.' },
    updated: { title: 'Reservation updated', intro: 'Your reservation details have been updated by our team.' },
    paid: { title: 'Payment received', intro: 'Your reservation payment has been updated and marked as fully paid.' },
    unpaid: { title: 'Payment status updated', intro: 'Your reservation payment status has been updated by our team.' },
  };
  return copies[event] || copies.updated;
}

export async function POST(req: Request) {
  try {
    const internalSecret = process.env.INTERNAL_NOTIFICATION_SECRET;
    const suppliedSecret = req.headers.get('x-internal-notification-secret');
    let authorized = Boolean(internalSecret && suppliedSecret && suppliedSecret === internalSecret);

    if (!authorized) {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer ')) {
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } } });
        const { data: { user } } = await client.auth.getUser();
        authorized = Boolean(user);
      }
    }

    if (!authorized) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
    const body = await req.json();
    const reservation = body.reservation || body;
    const event = String(body.event || 'updated');
    const email = String(reservation.email || '').trim();
    if (!email) return NextResponse.json({ ok: true, sent: false, reason: 'No guest email address.' });
    if (reservation.notification_consent === false) return NextResponse.json({ ok: true, sent: false, reason: 'Guest notification consent is disabled.' });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) return NextResponse.json({ ok: false, sent: false, reason: 'Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.' }, { status: 503 });

    const copy = eventCopy(event);
    const booking = reservation.booking_id || '—';
    const room = reservation.room_name || reservation.room?.name || 'Selected room';
    const checkIn = date(reservation.check_in);
    const checkOut = date(reservation.check_out);
    const total = peso(reservation.room_total);
    const deposit = peso(reservation.deposit);
    const balance = peso(reservation.balance);

    const html = `<!doctype html><html><body style="margin:0;background:#f4eee7;color:#2d2926;font-family:Arial,sans-serif"><div style="max-width:640px;margin:28px auto;background:#fffdf9;border:1px solid #e5d8cd;border-radius:28px;overflow:hidden"><div style="padding:36px;background:linear-gradient(135deg,#302a27,#55423a);color:#fff"><div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#ead4c8">Sakura Ananda • Private Resort</div><h1 style="font-family:Georgia,serif;font-weight:500;font-size:36px;line-height:1.05;margin:16px 0 10px">${copy.title}</h1><p style="margin:0;color:#eadfd8;line-height:1.7">${copy.intro}</p></div><div style="padding:34px"><div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#f1e5dd;color:#80594e;font-weight:700;font-size:12px">${String(reservation.status || 'Pending')}</div><h2 style="font-family:Georgia,serif;font-weight:500;margin:18px 0 8px">Booking ${booking}</h2><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:10px 0;color:#776d67">Guest</td><td style="padding:10px 0;text-align:right;font-weight:700">${reservation.guest_name || ''}</td></tr><tr><td style="padding:10px 0;color:#776d67">Room</td><td style="padding:10px 0;text-align:right;font-weight:700">${room}</td></tr><tr><td style="padding:10px 0;color:#776d67">Stay</td><td style="padding:10px 0;text-align:right">${checkIn} → ${checkOut}</td></tr><tr><td style="padding:10px 0;color:#776d67">Guests</td><td style="padding:10px 0;text-align:right">${reservation.guests || ''}</td></tr><tr><td style="padding:10px 0;color:#776d67">Room total</td><td style="padding:10px 0;text-align:right;font-weight:700">${total}</td></tr><tr><td style="padding:10px 0;color:#776d67">Deposit</td><td style="padding:10px 0;text-align:right">${deposit}</td></tr><tr><td style="padding:10px 0;color:#776d67">Balance</td><td style="padding:10px 0;text-align:right;font-weight:700">${balance}</td></tr></table><div style="margin-top:24px;padding:16px 18px;border-radius:18px;background:#faf5ef;color:#665b55;line-height:1.6;font-size:13px">Please keep your booking ID <strong>${booking}</strong> for check-in.</div></div><div style="padding:22px 34px;background:#211d1b;color:#d8ccc5;font-size:12px">Sakura Ananda Resort • Asia/Manila • Philippines</div></div></body></html>`;
    const text = `${RESORT_NAME}\n\n${copy.intro}\n\nBooking ID: ${booking}\nGuest: ${reservation.guest_name || ''}\nRoom: ${room}\nStay: ${checkIn} → ${checkOut}\nGuests: ${reservation.guests || ''}\nRoom total: ${total}\nDeposit: ${deposit}\nBalance: ${balance}\nStatus: ${reservation.status || ''}\n\nPlease keep your booking ID for check-in.`;

    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject: `${RESORT_NAME} • ${copy.title} • ${booking}`, html, text }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, sent: false, error: result?.message || 'Email provider rejected the message.' }, { status: 502 });
    return NextResponse.json({ ok: true, sent: true, provider: 'resend', id: result?.id || null });
  } catch (error) {
    return NextResponse.json({ ok: false, sent: false, error: error instanceof Error ? error.message : 'Unable to send notification.' }, { status: 500 });
  }
}
