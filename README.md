# Sakura Ananda Resort — V4

Elegant resort website + reservation system using Next.js, Supabase and Vercel.

## What was updated
- New photo-led homepage using the supplied Sakura Ananda pool/property photo.
- New **Rooms** page.
- New **Amenities** page.
- New **Coffee & Bar** page with visual gallery sections ready for real coffee/bar photos.
- Expanded navigation and mobile styling.
- Reservation flow still uses the existing Supabase availability protection, deposit/payment fields and staff dashboard.
- Guest booking emails now prefer **Resend Free** and fall back to **Brevo Free**.

## Free email setup
Resend currently has a free transactional tier of 3,000 emails/month with a 100/day limit. Create an account, verify the sending domain, create an API key, then add:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

to Vercel Project → Settings → Environment Variables.

Brevo is also supported as a fallback with `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`.

## Deploy
1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Add the Supabase and email environment variables.
4. Run the SQL in `supabase/schema.sql` in Supabase SQL Editor.
5. Deploy.

## Real coffee/bar photos
Replace the visual placeholders in `app/coffee-bar/page.tsx` with your actual coffee/bar photos when available. The page is already structured for those images.
