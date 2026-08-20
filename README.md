# Sakura Ananda Resort — Vercel + Supabase V3

Elegant reservation + front desk system with:
- Public reservation form with room/date conflict protection
- Separate guest check-in
- Staff login via Supabase Auth
- Reservation confirmation/cancellation/checkout
- Occupancy dashboard and room-by-room calendar
- GCash QR management
- Transactional booking emails via Resend
- Optional booking/status SMS via Twilio

## Deploy
1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Push this project to GitHub.
3. Import the repo into Vercel.
4. Add the environment variables from `.env.example`.
5. For email, verify a sending domain in Resend and use that domain in `RESEND_FROM_EMAIL`.
6. For SMS, add Twilio credentials and set `ENABLE_SMS_NOTIFICATIONS=true`. Phone numbers should be stored in E.164 format (e.g. `+639171234567`).
7. Create staff users in Supabase Authentication → Users.

The reservation API sends a pending confirmation email immediately when an email is provided. Staff actions send confirmed/cancelled/checkout status notifications. SMS is only sent when enabled and the guest has consented to booking updates.
