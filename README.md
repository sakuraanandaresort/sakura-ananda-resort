# Sakura Ananda Resort — V6 Google Sheets Email

Elegant resort website + reservation system using Next.js, Supabase and Vercel.

## What changed
- Keeps the existing Supabase reservation database and availability protection.
- Customer booking emails no longer use Resend, Brevo, or another email API.
- Added a Google Apps Script bridge at `integrations/google-sheets/Code.gs`.
- Supabase Database Webhooks send reservation INSERT/UPDATE events to Google Apps Script.
- Google Apps Script updates a Google Sheet and sends the guest booking/status email through Google's `MailApp`.
- Added an `Email Log` sheet for sent/failed email attempts.
- Added `room_name` to reservations so Google Sheets receives the room name without a privileged database query.

## Setup
Read `integrations/google-sheets/SETUP.md`.

High-level flow:

`Website → Supabase reservations → Supabase Database Webhook → Google Apps Script → Google Sheet + Gmail/MailApp → Customer`

Supabase Database Webhooks support INSERT and UPDATE events and send the row in the webhook payload. Google Apps Script MailApp sends mail from the Google account that owns/executes the script, subject to Google's daily recipient quotas.

## Deploy
1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Create a Google Sheet and paste `integrations/google-sheets/Code.gs` into Extensions → Apps Script.
3. Deploy the Apps Script as a Web App.
4. Create a Supabase Database Webhook for `public.reservations` on INSERT + UPDATE.
5. Use the Apps Script Web App URL plus the configured secret.
6. Deploy this Next.js project to Vercel.

No Resend/Brevo API keys are required for customer booking emails.
