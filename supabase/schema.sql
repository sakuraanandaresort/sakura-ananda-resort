-- Sakura Ananda Resort V2 — run in Supabase SQL Editor
create extension if not exists pgcrypto;
create table if not exists public.rooms(id uuid primary key default gen_random_uuid(),name text unique not null,description text default '',rate numeric(12,2) not null default 0,max_guests integer not null default 4,active boolean not null default true);
insert into public.rooms(name,rate,max_guests) values ('Room 1',2500,4),('Room 2',3000,4),('Room 3',3000,4),('Room 4',3500,4) on conflict(name) do update set rate=excluded.rate,max_guests=excluded.max_guests;
create table if not exists public.reservations(id uuid primary key default gen_random_uuid(),booking_id text unique not null default ('BK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),created_at timestamptz not null default now(),guest_name text not null,mobile text not null,email text,check_in date not null,check_out date not null,guests integer not null,room_id uuid not null references public.rooms(id),rate_per_night numeric(12,2) not null,nights integer not null,room_total numeric(12,2) not null,deposit numeric(12,2) not null default 0,balance numeric(12,2) not null default 0,payment_method text not null default 'GCash',payment_ref text,payment_proof_url text,status text not null default 'Pending' check(status in ('Pending','Confirmed','Cancelled','Checked-in','Checked-out')),special_requests text,admin_notes text,checked_in_at timestamptz,checked_out_at timestamptz);
create table if not exists public.settings(key text primary key,value text not null default '');
insert into public.settings(key,value) values('resort_name','Sakura Ananda Resort'),('deposit_percent','0.30'),('currency','PHP'),('timezone','Asia/Manila'),('gcash_qr_url','') on conflict(key) do nothing;
alter table public.rooms enable row level security;alter table public.reservations enable row level security;alter table public.settings enable row level security;
drop policy if exists rooms_public_read on public.rooms;create policy rooms_public_read on public.rooms for select using(active=true);
drop policy if exists reservations_public_insert on public.reservations;create policy reservations_public_insert on public.reservations for insert to anon,authenticated with check(true);
drop policy if exists reservations_staff_all on public.reservations;create policy reservations_staff_all on public.reservations for all to authenticated using(true) with check(true);
drop policy if exists settings_public_qr_read on public.settings;create policy settings_public_qr_read on public.settings for select to anon,authenticated using(key in ('gcash_qr_url','resort_name','deposit_percent','currency','timezone'));
drop policy if exists settings_staff_write on public.settings;create policy settings_staff_write on public.settings for all to authenticated using(true) with check(true);
-- Storage bucket for GCash QR and payment proof images.
insert into storage.buckets(id,name,public) values('payment-proofs','payment-proofs',true) on conflict(id) do update set public=true;
drop policy if exists payment_proofs_public_read on storage.objects;create policy payment_proofs_public_read on storage.objects for select using(bucket_id='payment-proofs');
drop policy if exists payment_proofs_staff_upload on storage.objects;create policy payment_proofs_staff_upload on storage.objects for insert to authenticated with check(bucket_id='payment-proofs');
drop policy if exists payment_proofs_staff_update on storage.objects;create policy payment_proofs_staff_update on storage.objects for update to authenticated using(bucket_id='payment-proofs') with check(bucket_id='payment-proofs');
-- Optional: protect staff by creating a dedicated Supabase Auth user and relying on authenticated RLS.

-- Public check-in is performed through narrow SECURITY DEFINER RPCs so the public role cannot read the reservations table directly.
create or replace function public.find_reservation(p_booking_id text,p_mobile text)
returns setof public.reservations
language sql security definer set search_path=public
as $$ select * from public.reservations where booking_id=p_booking_id and mobile=p_mobile limit 1 $$;
revoke all on function public.find_reservation(text,text) from public;
grant execute on function public.find_reservation(text,text) to anon,authenticated;
create or replace function public.public_checkin(p_booking_id text,p_mobile text)
returns public.reservations
language plpgsql security definer set search_path=public
as $$ declare r public.reservations; begin
 select * into r from public.reservations where booking_id=p_booking_id and mobile=p_mobile limit 1;
 if r.id is null then raise exception 'Reservation not found.'; end if;
 if r.status <> 'Confirmed' then raise exception 'Reservation must be Confirmed before check-in. Current status: %',r.status; end if;
 update public.reservations set status='Checked-in',checked_in_at=now() where id=r.id returning * into r;
 return r;
end $$;
revoke all on function public.public_checkin(text,text) from public;
grant execute on function public.public_checkin(text,text) to anon,authenticated;
