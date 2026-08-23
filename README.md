# Sakura Ananda Resort — V7

A fresh luxury redesign of the Sakura Ananda Resort website.

## Architecture
- Next.js frontend
- Supabase database, authentication and storage
- Supabase RPC for atomic public reservations and availability checks
- Admin CRUD for reservations and rooms
- Direct customer email notifications through Resend
- Google Sheets is no longer part of the booking or notification flow

## Email setup
Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `INTERNAL_NOTIFICATION_SECRET` in your Vercel environment variables.

## Supabase
Run the updated `supabase/schema.sql` in the Supabase SQL editor.
