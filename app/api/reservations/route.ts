import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyReservation } from '../../../lib/notifications';

const anonClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const serviceClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.guest_name || !b.mobile || !b.check_in || !b.check_out || !b.room_id) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const { data, error } = await anonClient().rpc('create_public_reservation', {
      p_guest_name: b.guest_name,
      p_mobile: b.mobile,
      p_email: b.email || null,
      p_check_in: b.check_in,
      p_check_out: b.check_out,
      p_guests: Number(b.guests || 1),
      p_room_id: b.room_id,
      p_deposit: Number(b.deposit || 0),
      p_payment_method: b.payment_method || 'GCash',
      p_payment_ref: b.payment_ref || null,
      p_payment_proof_url: b.payment_proof_url || null,
      p_special_requests: b.special_requests || null,
      p_notification_consent: Boolean(b.notification_consent),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bookingId = Array.isArray(data) ? data[0]?.booking_id : data?.booking_id;
    let notification: any = { sent: false, reason: 'Notification not attempted.' };

    if (bookingId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = serviceClient();
      const { data: reservation, error: fetchError } = await admin
        .from('reservations')
        .select('*, room:rooms(name)')
        .eq('booking_id', bookingId)
        .single();

      if (fetchError) {
        notification = { sent: false, reason: `Reservation lookup failed: ${fetchError.message}` };
        console.error('[reservation-email] lookup failed', fetchError);
      } else if (reservation?.email) {
        notification = await notifyReservation(reservation, 'created');
        console.log('[reservation-email] result', bookingId, notification);
      } else {
        notification = { sent: false, reason: 'No guest email address.' };
      }
    } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      notification = { sent: false, reason: 'SUPABASE_SERVICE_ROLE_KEY is missing in Vercel.' };
      console.error('[reservation-email] SUPABASE_SERVICE_ROLE_KEY missing');
    }

    return NextResponse.json({ booking_id: bookingId, notification });
  } catch (e: any) {
    console.error('[reservation-api] unexpected error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
