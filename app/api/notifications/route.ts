import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyReservation } from '../../../lib/notifications';

const authClient = (token: string) => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: token } } },
);

const serviceClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Staff authentication required.' }, { status: 401 });

    const { data: { user }, error: userError } = await authClient(auth).auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Staff authentication required.' }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing in Vercel.' }, { status: 500 });

    const { id, event } = await req.json();
    if (!id || !['confirmed', 'cancelled', 'checked-in', 'checked-out'].includes(event)) {
      return NextResponse.json({ error: 'Invalid notification request.' }, { status: 400 });
    }

    const { data, error } = await serviceClient()
      .from('reservations')
      .select('*, room:rooms(name)')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message || 'Reservation not found.' }, { status: 404 });

    const results = await notifyReservation(data, event);
    console.log('[staff-notification] result', { id, event, results });
    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    console.error('[staff-notification] unexpected error', e);
    return NextResponse.json({ error: e?.message || 'Notification error.' }, { status: 500 });
  }
}
