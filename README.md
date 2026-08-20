# Sakura Ananda Resort — Vercel + Supabase V2

Production-oriented reservation/front-desk starter for Sakura Ananda Resort.

## Included
- Public `/reservation` page with 4 rooms, dates, guest count and payment details.
- Server reservation endpoint with overlap checking.
- Separate `/checkin` guest/front-desk check-in flow.
- `/admin` Supabase Auth login.
- Confirm / Cancel / Checkout controls.
- Room occupancy dashboard.
- Month availability calendar.
- GCash QR upload from staff dashboard using Supabase Storage.
- Supabase RLS policies and storage bucket setup.

## 1. Create Supabase
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication → Users, create the staff/admin user email + password.
4. Copy Project URL and anon/publishable key.

## 2. Configure local project
Copy `.env.example` to `.env.local`:

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

Then:

npm install
npm run dev

## 3. Deploy to Vercel
1. Push this folder to GitHub.
2. Import the repository into Vercel.
3. Add the same two environment variables in Vercel Project Settings → Environment Variables.
4. Deploy.

## Important production security
The dashboard is protected by Supabase Auth, and staff writes use authenticated RLS. For a real business deployment, restrict staff users further (for example with a `staff_profiles` table/role check), enable MFA, and do not expose any Supabase service-role key to the browser.

## Payment proof
The current public form supports a payment-proof URL field. Staff can upload/replace the GCash QR from the admin dashboard. If you want guests to upload image files directly, add a signed-upload endpoint or an authenticated/short-lived upload flow rather than making a general public write policy for storage.

## Existing Sakura Ananda data model
The project follows the existing workbook structure: Reservations includes booking ID, guest, dates, room, guests, rate, nights, totals, deposit, balance, payment method/reference, status and notes; the existing room setup uses Room 1–4 and PHP rates. Keep the actual rates in Supabase `rooms` authoritative.
