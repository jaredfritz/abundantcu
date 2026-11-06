-- Email reminders for City of Champaign yard waste pickups (/data/yard-waste).
-- Run in the Supabase SQL editor. Only the site's server routes read or write these tables, with the service-role
-- key; row level security is on with no policies, so the public (anon) key can't see them.

create extension if not exists pgcrypto;

create table if not exists public.yard_waste_reminders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- The address as the person searched it, for the email, and its geocoded point. The zone is looked up from the
  -- point each time reminders go out, so a zone the city redraws next season is picked up automatically.
  address text not null,
  lat double precision not null,
  lng double precision not null,
  -- The zone when they signed up, for reference.
  zone_id text not null,
  days_before smallint not null check (days_before between 1 and 14),
  -- Random tokens in the confirmation link and in every reminder's unsubscribe link.
  confirm_token text not null unique,
  unsubscribe_token text not null unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz
);

create index if not exists yard_waste_reminders_active_idx
  on public.yard_waste_reminders (confirmed_at)
  where confirmed_at is not null and unsubscribed_at is null;
create index if not exists yard_waste_reminders_email_idx on public.yard_waste_reminders (lower(email));

-- One row per reminder sent, so a pickup is never reminded twice, even if the daily job runs again.
create table if not exists public.yard_waste_reminder_sends (
  reminder_id uuid not null references public.yard_waste_reminders (id) on delete cascade,
  pickup_date date not null,
  sent_at timestamptz not null default now(),
  primary key (reminder_id, pickup_date)
);

alter table public.yard_waste_reminders enable row level security;
alter table public.yard_waste_reminder_sends enable row level security;

-- Keep the tables out of the public GraphQL schema too: only the service role uses them.
revoke all on public.yard_waste_reminders from anon, authenticated;
revoke all on public.yard_waste_reminder_sends from anon, authenticated;
