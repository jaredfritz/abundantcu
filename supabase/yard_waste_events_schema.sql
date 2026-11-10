-- Anonymous counts of what people do on /data/yard-waste (src/lib/yardWasteTrack.ts -> /api/yard-waste/events).
-- No addresses, emails, IPs, or cookies: only the event, the zone it concerned, an optional detail (which calendar),
-- and when. Run in the Supabase SQL editor. Only the server route writes here, with the service role.

create table if not exists public.yard_waste_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'search_in_zone', 'search_outside', 'map_zone_click', 'calendar_open', 'calendar_add',
    'reminder_submit', 'reminder_error'
  )),
  zone_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists yard_waste_events_created_idx on public.yard_waste_events (created_at desc);
create index if not exists yard_waste_events_event_idx on public.yard_waste_events (event, created_at desc);

alter table public.yard_waste_events enable row level security;
revoke all on public.yard_waste_events from anon, authenticated;

-- Daily totals by event and detail, in Champaign time. security_invoker keeps the table's RLS in force for the view.
create or replace view public.yard_waste_event_counts with (security_invoker = true) as
select
  (created_at at time zone 'America/Chicago')::date as day,
  event,
  detail,
  count(*) as events
from public.yard_waste_events
group by 1, 2, 3;
revoke all on public.yard_waste_event_counts from anon, authenticated;
