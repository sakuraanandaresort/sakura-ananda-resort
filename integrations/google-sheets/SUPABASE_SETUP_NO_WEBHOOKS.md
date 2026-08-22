# Supabase setup for V6 (no Database → Webhooks menu required)

1. Deploy `Code.gs` as a Google Apps Script Web App.
2. In Apps Script, set `CONFIG.SECRET` to your secret and copy the `/exec` URL.
3. In Supabase SQL Editor run:

```sql
select vault.create_secret(
  'YOUR_APPS_SCRIPT_EXEC_URL?secret=YOUR_SECRET',
  'sakura_google_sheets_webhook_url'
);
```

4. Run all of `supabase/schema.sql` from this project. It enables `pg_net`/Vault and creates `reservations_google_sheets_sync`.
5. Submit a booking.
6. Check Apps Script → Executions for a `doPost` execution.
7. Check Google Sheet → `Reservations` and `Email Log`.

The secret never appears in the Vercel frontend.
