-- One row per reminder delivery attempt: the daily job ('daily') or a reminder sent the moment a late sign-up is
-- confirmed ('confirm'). The daily owner report (/api/yard-waste/reminders/report) reads it. No personal data:
-- counts and error messages only. Run in the Supabase SQL editor.
create table if not exists public.yard_waste_job_log (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('daily', 'confirm')),
  ran_at timestamptz not null default now(),
  due integer not null default 0,
  sent integer not null default 0,
  errors jsonb not null default '[]'::jsonb
);
create index if not exists yard_waste_job_log_ran_idx on public.yard_waste_job_log (ran_at desc);
alter table public.yard_waste_job_log enable row level security;
revoke all on public.yard_waste_job_log from anon, authenticated;
