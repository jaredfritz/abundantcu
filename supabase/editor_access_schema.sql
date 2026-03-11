-- Editor access workflow tables and policies for Abundant CU
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.editor_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  email text not null unique,
  granted_at timestamptz not null default now(),
  granted_by text
);

create table if not exists public.editor_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  notes text,
  requester_user_id uuid,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists editor_access_requests_status_idx on public.editor_access_requests (status, created_at desc);
create index if not exists editor_roles_email_idx on public.editor_roles (email);

alter table public.editor_roles enable row level security;
alter table public.editor_access_requests enable row level security;

-- Users can only see their own editor role row.
drop policy if exists "editor_roles_select_own" on public.editor_roles;
create policy "editor_roles_select_own"
on public.editor_roles
for select
using (
  user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Access requests are handled through server routes using service-role key.
-- Keep table private from client-side queries for now.

-- Optional hardening: gate parking_features edits to approved editors.
alter table public.parking_features enable row level security;

-- Replace permissive policies (if present) with editor-gated policies.
drop policy if exists "parking_select_all" on public.parking_features;
create policy "parking_select_all"
on public.parking_features
for select
using (true);

drop policy if exists "parking_insert_editor" on public.parking_features;
create policy "parking_insert_editor"
on public.parking_features
for insert
to authenticated
with check (
  exists (
    select 1
    from public.editor_roles er
    where er.user_id = auth.uid()
      or lower(er.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "parking_update_owner_editor" on public.parking_features;
create policy "parking_update_owner_editor"
on public.parking_features
for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.editor_roles er
    where er.user_id = auth.uid()
      or lower(er.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.editor_roles er
    where er.user_id = auth.uid()
      or lower(er.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "parking_delete_owner_editor" on public.parking_features;
create policy "parking_delete_owner_editor"
on public.parking_features
for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.editor_roles er
    where er.user_id = auth.uid()
      or lower(er.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
