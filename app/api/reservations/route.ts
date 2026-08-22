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

    // Send the guest confirmation directly after the public booking RPC.
    // This no longer requires the Supabase service-role key, so email delivery
    // can work even when only the public reservation flow is configured.
    if (bookingId && b.email) {
      const { data: room } = await anonClient()
        .from('rooms')
        .select('name,rate')
        .eq('id', b.room_id)
        .eq('active', true)
        .single();

      const checkIn = new Date(`${b.check_in}T00:00:00`);
      const checkOut = new Date(`${b.check_out}T00:00:00`);
      const nights = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
      const rate = Number(room?.rate || 0);
      const roomTotal = rate * nights;
      const deposit = Math.min(Math.max(Number(b.deposit || 0), 0), roomTotal);
      const reservationForEmail = {
        booking_id: bookingId,
        guest_name: b.guest_name,
        mobile: b.mobile,
        email: b.email,
        check_in: b.check_in,
        check_out: b.check_out,
        guests: Number(b.guests || 1),
        rate_per_night: rate,
        nights,
        room_total: roomTotal,
        deposit,
        balance: Math.max(roomTotal - deposit, 0),
        payment_method: b.payment_method || 'GCash',
        status: 'Pending',
        notification_consent: Boolean(b.notification_consent),
        room: room ? { name: room.name } : null,
      };

      notification = await notifyReservation(reservationForEmail, 'created');
      console.log('[reservation-email] result', bookingId, notification);
    } else if (!b.email) {
      notification = { sent: false, reason: 'No guest email address.' };
    }
    return NextResponse.json({ booking_id: bookingId, notification });
  } catch (e: any) {
    console.error('[reservation-api] unexpected error', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
