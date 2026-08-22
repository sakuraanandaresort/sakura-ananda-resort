import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const anonClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function POST(req: Request) {
  try {
    const b = await req.json();

    if (
      !b.guest_name ||
      !b.mobile ||
      !b.check_in ||
      !b.check_out ||
      !b.room_id
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields.',
        },
        {
          status: 400,
        }
      );
    }

    const supabase = anonClient();

    /*
     * ==========================================
     * VERIFY ROOM
     * ==========================================
     */

    const { data: room, error: roomError } =
      await supabase
        .from('rooms')
        .select(
          'id, name, rate, max_guests'
        )
        .eq('id', b.room_id)
        .eq('active', true)
        .single();

    if (roomError || !room) {
      return NextResponse.json(
        {
          error: 'Selected room was not found.',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ==========================================
     * CREATE RESERVATION
     * ==========================================
     */

    const { data, error } =
      await supabase.rpc(
        'create_public_reservation',
        {
          p_guest_name:
            b.guest_name,

          p_mobile:
            b.mobile,

          p_email:
            b.email || null,

          p_check_in:
            b.check_in,

          p_check_out:
            b.check_out,

          p_guests:
            Number(b.guests || 1),

          /*
           * IMPORTANT
           *
           * Database stores UUID.
           */
          p_room_id:
            b.room_id,

          p_deposit:
            Number(b.deposit || 0),

          p_payment_method:
            b.payment_method ||
            'GCash',

          p_payment_ref:
            b.payment_ref ||
            null,

          p_payment_proof_url:
            b.payment_proof_url ||
            null,

          p_special_requests:
            b.special_requests ||
            null,

          p_notification_consent:
            Boolean(
              b.notification_consent
            ),
        }
      );

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        }
      );
    }

    const bookingId =
      Array.isArray(data)
        ? data[0]?.booking_id
        : data?.booking_id;

    /*
     * ==========================================
     * RETURN ROOM NAME
     * ==========================================
     */

    return NextResponse.json({
      booking_id: bookingId,

      room_id: room.id,

      room_name: room.name,

      room_rate: room.rate,

      notification: b.email
        ? {
            sent: false,
            provider:
              'google-sheets-mailapp',
            reason:
              'Supabase Database Webhook will sync the booking to Google Sheets and send the customer email.',
          }
        : {
            sent: false,
            reason:
              'No guest email address.',
          },
    });
  } catch (e: any) {
    console.error(
      '[reservation-api] unexpected error',
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          'Server error',
      },
      {
        status: 500,
      }
    );
  }
}
