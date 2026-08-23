import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  'Sakura Ananda Resort <onboarding@resend.dev>';

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const {
      event,
      reservation,
    } = body;

    if (!reservation?.email) {
      return NextResponse.json(
        {
          error: 'Customer email is missing.',
        },
        { status: 400 }
      );
    }

    const html =
      createLuxuryEmail(
        event,
        reservation
      );

    const result =
      await resend.emails.send({
        from: FROM_EMAIL,
        to: reservation.email,
        subject:
          getSubject(
            event,
            reservation
          ),
        html,
      });

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error(
      'Notification error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Unable to send email.',
      },
      { status: 500 }
    );
  }
}
