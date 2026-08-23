import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  'Sakura Ananda Resort <onboarding@resend.dev>';

type Reservation = {
  booking_id?: string;
  guest_name?: string;
  email?: string;
  mobile?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  room_total?: number;
  deposit?: number;
  balance?: number;
  payment_method?: string;
  payment_ref?: string;
  special_requests?: string;
  status?: string;
  room?: {
    name?: string;
    rate?: number;
  };
};

function peso(value: unknown) {
  return `₱${Number(value || 0).toLocaleString(
    'en-PH'
  )}`;
}

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    'en-PH',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  );
}

function getSubject(
  event: string,
  reservation: Reservation
) {
  const booking =
    reservation.booking_id
      ? ` • ${reservation.booking_id}`
      : '';

  switch (event) {
    case 'confirmed':
      return `Reservation Confirmed${booking} | Sakura Ananda Resort`;

    case 'cancelled':
      return `Reservation Update${booking} | Sakura Ananda Resort`;

    case 'checked-in':
      return `Welcome to Sakura Ananda Resort${booking}`;

    case 'checked-out':
      return `Thank You for Staying With Us${booking}`;

    case 'paid':
      return `Payment Received${booking} | Sakura Ananda Resort`;

    case 'unpaid':
      return `Payment Update${booking} | Sakura Ananda Resort`;

    case 'updated':
      return `Reservation Updated${booking} | Sakura Ananda Resort`;

    default:
      return `Reservation Update${booking} | Sakura Ananda Resort`;
  }
}

function getEventContent(
  event: string
) {
  switch (event) {
    case 'confirmed':
      return {
        eyebrow:
          'RESERVATION CONFIRMED',
        title:
          'Your stay is beautifully arranged.',
        message:
          'We are delighted to confirm your reservation with Sakura Ananda Private Resort. Your private escape is now reserved.',
      };

    case 'cancelled':
      return {
        eyebrow:
          'RESERVATION UPDATE',
        title:
          'Your reservation has been cancelled.',
        message:
          'We have processed the cancellation of your reservation. We hope to have the pleasure of welcoming you to Sakura Ananda another time.',
      };

    case 'checked-in':
      return {
        eyebrow:
          'WELCOME TO SAKURA ANANDA',
        title:
          'Your private escape begins.',
        message:
          'Welcome. We hope your stay is peaceful, comfortable and memorable. Please enjoy your time at Sakura Ananda Private Resort.',
      };

    case 'checked-out':
      return {
        eyebrow:
          'WITH GRATITUDE',
        title:
          'Thank you for staying with us.',
        message:
          'It was our pleasure to have you at Sakura Ananda. We hope you leave with wonderful memories and we look forward to welcoming you again.',
      };

    case 'paid':
      return {
        eyebrow:
          'PAYMENT RECEIVED',
        title:
          'Your payment has been recorded.',
        message:
          'Thank you. We have successfully recorded the payment associated with your Sakura Ananda reservation.',
      };

    case 'unpaid':
      return {
        eyebrow:
          'PAYMENT UPDATE',
        title:
          'Your payment status has been updated.',
        message:
          'Your reservation payment information has been updated. Please review the details below for your current balance.',
      };

    default:
      return {
        eyebrow:
          'RESERVATION UPDATED',
        title:
          'Your reservation details have changed.',
        message:
          'We have updated your Sakura Ananda reservation. Please review the latest details below.',
      };
  }
}

function createLuxuryEmail(
  event: string,
  reservation: Reservation
) {
  const content =
    getEventContent(event);

  const guest =
    reservation.guest_name ||
    'Valued Guest';

  const room =
    reservation.room?.name ||
    'Private Resort Room';

  const total =
    Number(
      reservation.room_total || 0
    );

  const deposit =
    Number(
      reservation.deposit || 0
    );

  const balance =
    Number(
      reservation.balance || 0
    );

  const status =
    reservation.status ||
    'Pending';

  return `
<!DOCTYPE html>

<html>
<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Sakura Ananda Resort</title>

</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f3eee4;
    font-family:Arial,Helvetica,sans-serif;
    color:#29261f;
  "
>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    background:
      linear-gradient(
        135deg,
        #f8f4ec,
        #eee6d7
      );
    padding:40px 15px;
  "
>

<tr>

<td align="center">

<table
  width="620"
  cellpadding="0"
  cellspacing="0"
  style="
    max-width:620px;
    width:100%;
    background:#fffdf8;
    border:1px solid #ded2bd;
    box-shadow:0 20px 60px rgba(60,45,20,.10);
  "
>

<!-- HEADER -->

<tr>

<td
  align="center"
  style="
    padding:46px 30px 35px;
    background:#24221d;
  "
>

<div
  style="
    font-family:Georgia,serif;
    font-size:44px;
    color:#c6a15c;
    line-height:1;
    margin-bottom:15px;
  "
>
  桜
</div>

<div
  style="
    color:#e3c98f;
    font-family:Georgia,serif;
    font-size:25px;
    letter-spacing:4px;
  "
>
  SAKURA ANANDA
</div>

<div
  style="
    color:#d7d0c3;
    font-size:10px;
    letter-spacing:4px;
    margin-top:10px;
  "
>
  PRIVATE RESORT
</div>

</td>

</tr>

<!-- GOLD LINE -->

<tr>

<td
  style="
    height:4px;
    background:#b28a45;
  "
></td>

</tr>

<!-- CONTENT -->

<tr>

<td
  style="
    padding:45px 42px 35px;
  "
>

<div
  style="
    color:#aa8140;
    font-size:10px;
    letter-spacing:3px;
    font-weight:bold;
    margin-bottom:12px;
  "
>
  ${content.eyebrow}
</div>

<h1
  style="
    margin:0 0 18px;
    font-family:Georgia,serif;
    font-size:34px;
    line-height:1.25;
    font-weight:normal;
    color:#29261f;
  "
>
  ${content.title}
</h1>

<p
  style="
    margin:0 0 28px;
    color:#746e63;
    font-size:15px;
    line-height:1.8;
  "
>
  Dear ${guest},
</p>

<p
  style="
    margin:0 0 30px;
    color:#746e63;
    font-size:15px;
    line-height:1.8;
  "
>
  ${content.message}
</p>

<!-- BOOKING CARD -->

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    border:1px solid #dfd4c1;
    background:#faf7f0;
  "
>

<tr>

<td
  colspan="2"
  style="
    padding:20px 22px 15px;
    border-bottom:1px solid #dfd4c1;
  "
>

<div
  style="
    color:#a47c3b;
    font-size:10px;
    letter-spacing:2px;
    font-weight:bold;
  "
>
  RESERVATION DETAILS
</div>

</td>

</tr>

<tr>

<td
  style="
    padding:16px 22px 7px;
    color:#81796c;
    font-size:12px;
  "
>
  Booking
</td>

<td
  align="right"
  style="
    padding:16px 22px 7px;
    color:#29261f;
    font-weight:bold;
    font-size:13px;
  "
>
  ${reservation.booking_id || '—'}
</td>

</tr>

<tr>

<td
  style="
    padding:7px 22px;
    color:#81796c;
    font-size:12px;
  "
>
  Room
</td>

<td
  align="right"
  style="
    padding:7px 22px;
    color:#29261f;
    font-weight:bold;
    font-size:13px;
  "
>
  ${room}
</td>

</tr>

<tr>

<td
  style="
    padding:7px 22px;
    color:#81796c;
    font-size:12px;
  "
>
  Check-in
</td>

<td
  align="right"
  style="
    padding:7px 22px;
    color:#29261f;
    font-size:13px;
  "
>
  ${formatDate(
    reservation.check_in
  )}
</td>

</tr>

<tr>

<td
  style="
    padding:7px 22px;
    color:#81796c;
    font-size:12px;
  "
>
  Check-out
</td>

<td
  align="right"
  style="
    padding:7px 22px;
    color:#29261f;
    font-size:13px;
  "
>
  ${formatDate(
    reservation.check_out
  )}
</td>

</tr>

<tr>

<td
  style="
    padding:7px 22px;
    color:#81796c;
    font-size:12px;
  "
>
  Guests
</td>

<td
  align="right"
  style="
    padding:7px 22px;
    color:#29261f;
    font-size:13px;
  "
>
  ${reservation.guests || 1}
</td>

</tr>

<tr>

<td
  style="
    padding:7px 22px 18px;
    color:#81796c;
    font-size:12px;
  "
>
  Status
</td>

<td
  align="right"
  style="
    padding:7px 22px 18px;
    color:#8d6933;
    font-weight:bold;
    font-size:13px;
  "
>
  ${status}
</td>

</tr>

</table>

<!-- PAYMENT -->

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    margin-top:20px;
    border:1px solid #dfd4c1;
    background:#24221d;
  "
>

<tr>

<td
  style="
    padding:20px 22px;
    color:#d8bd83;
    font-size:10px;
    letter-spacing:2px;
    font-weight:bold;
  "
>
  PAYMENT SUMMARY
</td>

</tr>

<tr>

<td
  style="
    padding:0 22px 22px;
  "
>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
>

<tr>

<td
  style="
    padding:6px 0;
    color:#bdb5a6;
    font-size:13px;
  "
>
  Total
</td>

<td
  align="right"
  style="
    color:#fffdf8;
    font-size:16px;
    font-weight:bold;
  "
>
  ${peso(total)}
</td>

</tr>

<tr>

<td
  style="
    padding:6px 0;
    color:#bdb5a6;
    font-size:13px;
  "
>
  Deposit
</td>

<td
  align="right"
  style="
    color:#e0c891;
    font-size:14px;
  "
>
  ${peso(deposit)}
</td>

</tr>

<tr>

<td
  style="
    padding:6px 0;
    color:#bdb5a6;
    font-size:13px;
  "
>
  Balance
</td>

<td
  align="right"
  style="
    color:#fffdf8;
    font-size:14px;
    font-weight:bold;
  "
>
  ${peso(balance)}
</td>

</tr>

${
  reservation.payment_method
    ? `
<tr>

<td
  style="
    padding:12px 0 0;
    color:#8f887c;
    font-size:11px;
  "
>
  Payment method
</td>

<td
  align="right"
  style="
    padding-top:12px;
    color:#d4c8b5;
    font-size:11px;
  "
>
  ${reservation.payment_method}
</td>

</tr>
`
    : ''
}

</table>

</td>

</tr>

</table>

${
  reservation.special_requests
    ? `
<div
  style="
    margin-top:25px;
    padding:18px 20px;
    border-left:3px solid #b18a45;
    background:#faf7f0;
  "
>

<div
  style="
    color:#a47c3b;
    font-size:10px;
    letter-spacing:2px;
    font-weight:bold;
    margin-bottom:7px;
  "
>
  SPECIAL REQUESTS
</div>

<div
  style="
    color:#6f695f;
    font-size:13px;
    line-height:1.7;
  "
>
  ${reservation.special_requests}
</div>

</div>
`
    : ''
}

<p
  style="
    margin:34px 0 0;
    color:#746e63;
    font-size:14px;
    line-height:1.8;
    text-align:center;
  "
>
  We look forward to welcoming you
  to Sakura Ananda Private Resort.
</p>

</td>

</tr>

<!-- FOOTER -->

<tr>

<td
  align="center"
  style="
    padding:30px;
    border-top:1px solid #ded2bd;
    background:#f7f2e8;
  "
>

<div
  style="
    font-family:Georgia,serif;
    color:#9c763b;
    font-size:18px;
    margin-bottom:8px;
  "
>
  SAKURA ANANDA
</div>

<div
  style="
    color:#837b6d;
    font-size:10px;
    letter-spacing:2px;
  "
>
  PRIVATE RESORT
</div>

<div
  style="
    color:#a39b8d;
    font-size:11px;
    margin-top:16px;
    line-height:1.6;
  "
>
  Thank you for choosing Sakura Ananda.
  <br>
  We look forward to making your stay memorable.
</div>

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>
`;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const {
      event,
      reservation,
    } = body;

    if (!reservation?.email) {
      return NextResponse.json(
        {
          error:
            'Customer email is missing.',
        },
        {
          status: 400,
        }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.error(
        'RESEND_API_KEY is missing.'
      );

      return NextResponse.json(
        {
          error:
            'Email service is not configured.',
        },
        {
          status: 500,
        }
      );
    }

    const html =
      createLuxuryEmail(
        event || 'updated',
        reservation
      );

    const result =
      await resend.emails.send({
        from: FROM_EMAIL,
        to: reservation.email,
        subject:
          getSubject(
            event || 'updated',
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
      {
        status: 500,
      }
    );
  }
}
