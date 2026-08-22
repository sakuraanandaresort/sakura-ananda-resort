# Sakura Ananda: Supabase → Google Sheets → Gmail (no email API)

This integration uses a Google Apps Script Web App as the bridge. A Supabase database trigger sends reservation INSERT/UPDATE payloads to the Apps Script Web App using `pg_net` and a secret URL stored in Supabase Vault. Apps Script writes/updates the reservation in Google Sheets and sends the customer booking email with Google's `MailApp`.

Supabase Database Webhooks support INSERT and UPDATE events and send the changed row as `record` / `old_record`. This is the connection used here.

## 1. Create the Google Sheet

Use your existing Sakura Ananda management Google Sheet:

`https://docs.google.com/spreadsheets/d/1iNpswyOS1PjU0nSPCoIVxvKKHNjBwHsvxncmtHi91TU/edit`

The spreadsheet ID is already configured in `Code.gs`.

Open **Extensions → Apps Script** and replace the default code with `Code.gs` from this folder.

Change:

```js
SECRET: 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET'
```

to a long random value, for example:

```js
SECRET: 'SAKURA-2026-CHANGE-ME-9f8c7b6a5d4e3f2a'
```

Optionally set `REPLY_TO` to the resort Gmail address.

## 2. Authorize the script

In Apps Script, run `doGet` once from the editor and approve the Google permissions. The script needs permission to write the Sheet and send mail.

Google's `MailApp.sendEmail()` sends mail from the Google account that owns/executes the script, subject to Google's daily recipient quota.

## 3. Deploy as a Web App

Apps Script → **Deploy → New deployment** → **Web app**.

Use:

- Execute as: **Me**
- Who has access: **Anyone**

Copy the Web App URL ending in `/exec`.

## 4. Connect Supabase without the “Database → Webhooks” menu

If your Supabase Dashboard does not show **Database → Webhooks**, do not look for it. V6 now includes a database-trigger method using Supabase `pg_net` + Vault.

After you deploy the Apps Script Web App and have its `/exec` URL, put the complete URL **including the secret query parameter** into Supabase Vault.

In **Supabase Dashboard → SQL Editor**, run this once, replacing the two placeholders:

```sql
select vault.create_secret(
  'YOUR_APPS_SCRIPT_EXEC_URL?secret=YOUR_LONG_RANDOM_SECRET',
  'sakura_google_sheets_webhook_url'
);
```

Example:

```sql
select vault.create_secret(
  'https://script.google.com/macros/s/XXXXXXXXXXXX/exec?secret=SAKURA-2026-9f8c7b6a5d4e3f2a',
  'sakura_google_sheets_webhook_url'
);
```

**Do not put this URL/secret into the Vercel frontend.** It is stored in Supabase Vault and used only by the database trigger.

If you later need to replace the URL/secret, run:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'sakura_google_sheets_webhook_url'),
  'YOUR_NEW_APPS_SCRIPT_EXEC_URL?secret=YOUR_NEW_LONG_RANDOM_SECRET',
  'sakura_google_sheets_webhook_url'
);
```

The V6 `supabase/schema.sql` creates the `pg_net` database trigger automatically. The trigger fires after every `INSERT` or `UPDATE` on `public.reservations` and sends the same webhook payload (`type`, `record`, `old_record`) that the Google Apps Script expects.

## 5. Run the database SQL

Run the revised `supabase/schema.sql` in Supabase SQL Editor. It adds `room_name` to reservations and automatically fills it from the selected room, so the Google Sheet receives the room name without needing a Supabase service key.

## 6. Test

1. Submit a booking on the Sakura Ananda website.
2. Supabase inserts the reservation.
3. Supabase sends the INSERT webhook to Apps Script.
4. Apps Script creates/updates the row in `Reservations`.
5. Apps Script sends the booking email through the Google account's MailApp.
6. When staff changes Pending → Confirmed or Confirmed → Cancelled, the UPDATE webhook updates the same row and sends the corresponding status email.

The `Email Log` sheet records each email attempt.

## Important quota note

This does not use Resend, Brevo, SendGrid, or another email API. Email is sent by Google's Apps Script `MailApp`. Google applies daily recipient quotas, so this is best for a small resort rather than a high-volume mailing system.

## If you want a Google Form too

A Google Form is not required for the website booking flow. The website should continue saving reservations to Supabase. The Google Sheet becomes your operational reservation spreadsheet, and Apps Script handles the email automatically. You can still add a separate Google Form later for manual staff bookings.


## Sakura Ananda connected-sheet configuration

The V6 project is preconfigured to use this spreadsheet:

- Spreadsheet ID: `1iNpswyOS1PjU0nSPCoIVxvKKHNjBwHsvxncmtHi91TU`
- Reservations tab: `Reservations`
- Email log tab: `Email Log`
- Management tabs: `Dashboard`, `Room Occupancy`, `Daily View`, `Settings`

The Apps Script uses `SpreadsheetApp.openById()` so it writes to this exact spreadsheet rather than whichever spreadsheet happens to be active.

### Required before deployment

1. Paste `Code.gs` into Apps Script for the Google Sheet.
2. Change only `CONFIG.SECRET` to your own long random secret.
3. Run `testConnection()` once and authorize Sheets/Mail permissions.
4. Deploy as a Web App, Execute as **Me**, access **Anyone**.
5. In Supabase create an `INSERT + UPDATE` webhook for `public.reservations`.
6. Set the webhook URL to:
   `YOUR_APPS_SCRIPT_EXEC_URL?secret=YOUR_SECRET`
7. Submit a real test reservation from the Vercel website.
8. Confirm the reservation appears in the `Reservations` tab and the customer email appears in the `Email Log` tab.

Do not put the Google Sheet ID or webhook secret in the Vercel frontend environment variables. The Vercel app only talks to Supabase.
