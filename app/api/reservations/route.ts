import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const anonClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

export async function POST(req: Request) {
  try {
    const b = await req.json();

    /*
     * ==========================================
     * BASIC VALIDATION
     * ==========================================
     */

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
        },
      );
    }

    /*
     * ==========================================
     * LOOK UP ROOM
     *
     * The reservation still uses room_id (UUID)
     * internally.
     *
     * We also retrieve the room name so that
     * external systems can display:
     *
     * Room 1
     *
     * instead of:
     *
     * 1d48f0f4-50cf-4d0c-ad31-738b0ebff2b0
     * ==========================================
     */

    const admin = serviceClient();

    const {
      data: room,
      error: roomError,
    } = await admin
      .from('rooms')
      .select(
        'id, name, rate, max_guests'
      )
      .eq('id', b.room_id)
      .single();

    if (roomError || !room) {
      console.error(
        '[reservation-api] room lookup error',
        roomError
      );

      return NextResponse.json(
        {
          error:
            'The selected room could not be found.',
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ==========================================
     * CREATE RESERVATION
     *
     * IMPORTANT:
     *
     * We continue sending the UUID to the
     * database RPC.
     *
     * Do NOT replace this with room.name.
     * ==========================================
     */

    const {
      data,
      error,
    } = await anonClient().rpc(
      'create_public_reservation',
      {
        p_guest_name:
          String(b.guest_name).trim(),

        p_mobile:
          String(b.mobile).trim(),

        p_email:
          b.email
            ? String(b.email).trim()
            : null,

        p_check_in:
          b.check_in,

        p_check_out:
          b.check_out,

        p_guests:
          Number(b.guests || 1),

        /*
         * DATABASE USES UUID
         */
        p_room_id:
          b.room_id,

        p_deposit:
          Number(b.deposit || 0),

        p_payment_method:
          b.payment_method ||
          'GCash',

        p_payment_ref:
          b.payment_ref
            ? String(
                b.payment_ref
              ).trim()
            : null,

        p_payment_proof_url:
          b.payment_proof_url
            ? String(
                b.payment_proof_url
              ).trim()
            : null,

        p_special_requests:
          b.special_requests
            ? String(
                b.special_requests
              ).trim()
            : null,

        p_notification_consent:
          Boolean(
            b.notification_consent
          ),
      }
    );

    if (error) {
      console.error(
        '[reservation-api] RPC error',
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ==========================================
     * GET BOOKING ID
     * ==========================================
     */

    const bookingId =
      Array.isArray(data)
        ? data[0]?.booking_id
        : data?.booking_id;

    if (!bookingId) {
      return NextResponse.json(
        {
          error:
            'Reservation was created, but no booking ID was returned.',
        },
        {
          status: 500,
        },
      );
    }

    /*
     * ==========================================
     * NOTIFICATION
     * ==========================================
     */

    const notification = b.email
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
        };

    /*
     * ==========================================
     * RESPONSE
     *
     * Notice that we return BOTH:
     *
     * room_id   -> UUID
     * room_name -> Room 1
     *
     * This lets the frontend and other systems
     * use the readable room name.
     * ==========================================
     */

    return NextResponse.json({
      booking_id: bookingId,

      /*
       * Human-readable room
       */
      room_name: room.name,

      /*
       * Original UUID
       */
      room_id: room.id,

      /*
       * Optional room information
       */
      room_rate: room.rate,
      room_max_guests:
        room.max_guests,

      notification,
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
      },
    );
  }
}
