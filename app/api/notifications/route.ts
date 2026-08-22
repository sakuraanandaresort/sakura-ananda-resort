import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: false,
    provider: 'google-sheets-mailapp',
    message: 'Customer email is sent by the Supabase → Google Sheets → Apps Script webhook. No email API is used by this website.',
  }, { status: 410 });
}
