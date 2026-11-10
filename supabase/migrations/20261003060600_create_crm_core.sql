/*
# CRM affiliation core schema

1. New Tables
- `profiles`: authenticated users and their CRM role.
- `ambassadors`: public-facing ambassador identity and unique referral code.
- `campaigns`: promotion campaigns and lifecycle status.
- `tracking_links`: campaign-specific ambassador links.
- `clicks`: non-sensitive referral click analytics.
- `leads`: prospects, first/last touch attribution, sales pipeline and Moodle placeholders.
- `lead_activities`: prospect timeline entries.
- `follow_ups`: scheduled commercial reminders.

2. Security
- RLS is enabled on every table.
- Authenticated users can access shared CRM records according to their role.
- Ambassadors can only read their own ambassador record, links, clicks and leads.
- Commercial users can read and update leads assigned to them.
- Admin users can manage all CRM records.
- Public visitors can create a lead and record a click without reading CRM data.

3. Important notes
- No payment, transaction, commission or financial fields are included.
- First-touch and last-touch attribution are stored independently.
- Moodle fields are placeholders for a future integration only.
*/

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'commercial' check (role in ('admin', 'commercial', 'ambassador')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  email text not null default '',
  phone text not null default '',
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors(id) on delete restrict,
  campaign_id uuid references public.campaigns(id) on delete set null,
  code text not null unique,
  landing_page text not null default '/',
  created_at timestamptz not null default now()
);

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid references public.ambassadors(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  tracking_link_id uuid references public.tracking_links(id) on delete set null,
  ref_code text not null default '',
  landing_page text not null default '/',
  referrer text,
  user_agent text,
  device_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  city text not null default '',
  country text not null default 'Burkina Faso',
  first_touch_ambassador_id uuid references public.ambassadors(id) on delete set null,
  first_touch_campaign_id uuid references public.campaigns(id) on delete set null,
  first_touch_at timestamptz,
  last_touch_ambassador_id uuid references public.ambassadors(id) on delete set null,
  last_touch_campaign_id uuid references public.campaigns(id) on delete set null,
  last_touch_at timestamptz,
  campaign_id uuid references public.campaigns(id) on delete set null,
  tracking_link_id uuid references public.tracking_links(id) on delete set null,
  source text not null default 'direct',
  source_details text not null default '',
  status text not null default 'new' check (status in ('new', 'to_contact', 'contacted', 'interested', 'follow_up', 'registration_pending', 'registered', 'not_interested', 'unreachable', 'lost')),
  assigned_to uuid references public.profiles(id) on delete set null,
  formation text not null default '',
  session text not null default '',
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  moodle_user_id text,
  moodle_enrollment_status text not null default 'not_enrolled' check (moodle_enrollment_status in ('not_enrolled', 'pending', 'enrolled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('lead_created', 'call', 'whatsapp', 'email', 'meeting', 'note', 'status_changed', 'follow_up_created', 'follow_up_completed', 'registration_confirmed')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date timestamptz not null,
  type text not null default 'call' check (type in ('call', 'whatsapp', 'email', 'meeting', 'other')),
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_phone_idx on public.leads(phone);
create index if not exists leads_email_idx on public.leads(email);
create index if not exists leads_ambassador_idx on public.leads(first_touch_ambassador_id);
create index if not exists leads_campaign_idx on public.leads(campaign_id);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_assigned_idx on public.leads(assigned_to);
create index if not exists leads_created_idx on public.leads(created_at desc);
create index if not exists activities_lead_idx on public.lead_activities(lead_id, created_at desc);
create index if not exists followups_due_idx on public.follow_ups(due_date, status);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.is_commercial_or_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'commercial')); $$;

alter table public.profiles enable row level security;
alter table public.ambassadors enable row level security;
alter table public.campaigns enable row level security;
alter table public.tracking_links enable row level security;
alter table public.clicks enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.follow_ups enable row level security;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "ambassadors_select_role" ON public.ambassadors;
CREATE POLICY "ambassadors_select_role" ON public.ambassadors FOR SELECT TO authenticated USING (public.is_admin() OR profile_id = auth.uid() OR public.is_commercial_or_admin());
DROP POLICY IF EXISTS "ambassadors_insert_admin" ON public.ambassadors;
CREATE POLICY "ambassadors_insert_admin" ON public.ambassadors FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ambassadors_update_admin" ON public.ambassadors;
CREATE POLICY "ambassadors_update_admin" ON public.ambassadors FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ambassadors_delete_admin" ON public.ambassadors;
CREATE POLICY "ambassadors_delete_admin" ON public.ambassadors FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "campaigns_select_authenticated" ON public.campaigns;
CREATE POLICY "campaigns_select_authenticated" ON public.campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "campaigns_insert_admin" ON public.campaigns;
CREATE POLICY "campaigns_insert_admin" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "campaigns_update_admin" ON public.campaigns;
CREATE POLICY "campaigns_update_admin" ON public.campaigns FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "campaigns_delete_admin" ON public.campaigns;
CREATE POLICY "campaigns_delete_admin" ON public.campaigns FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "tracking_links_select_role" ON public.tracking_links;
CREATE POLICY "tracking_links_select_role" ON public.tracking_links FOR SELECT TO authenticated USING (public.is_admin() OR exists (select 1 from public.ambassadors a where a.id = ambassador_id and (a.profile_id = auth.uid() or public.is_commercial_or_admin())));
DROP POLICY IF EXISTS "tracking_links_insert_admin" ON public.tracking_links;
CREATE POLICY "tracking_links_insert_admin" ON public.tracking_links FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "tracking_links_update_admin" ON public.tracking_links;
CREATE POLICY "tracking_links_update_admin" ON public.tracking_links FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "tracking_links_delete_admin" ON public.tracking_links;
CREATE POLICY "tracking_links_delete_admin" ON public.tracking_links FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "clicks_select_role" ON public.clicks;
CREATE POLICY "clicks_select_role" ON public.clicks FOR SELECT TO authenticated USING (public.is_admin() OR exists (select 1 from public.ambassadors a where a.id = ambassador_id and a.profile_id = auth.uid()));
DROP POLICY IF EXISTS "clicks_insert_public" ON public.clicks;
CREATE POLICY "clicks_insert_public" ON public.clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "clicks_update_admin" ON public.clicks;
CREATE POLICY "clicks_update_admin" ON public.clicks FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "clicks_delete_admin" ON public.clicks;
CREATE POLICY "clicks_delete_admin" ON public.clicks FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "leads_select_role" ON public.leads;
CREATE POLICY "leads_select_role" ON public.leads FOR SELECT TO authenticated USING (public.is_admin() OR assigned_to = auth.uid() OR exists (select 1 from public.ambassadors a where a.id = first_touch_ambassador_id and a.profile_id = auth.uid()));
DROP POLICY IF EXISTS "leads_insert_public" ON public.leads;
CREATE POLICY "leads_insert_public" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "leads_update_role" ON public.leads;
CREATE POLICY "leads_update_role" ON public.leads FOR UPDATE TO authenticated USING (public.is_admin() OR assigned_to = auth.uid()) WITH CHECK (public.is_admin() OR assigned_to = auth.uid());
DROP POLICY IF EXISTS "leads_delete_admin" ON public.leads;
CREATE POLICY "leads_delete_admin" ON public.leads FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "activities_select_role" ON public.lead_activities;
CREATE POLICY "activities_select_role" ON public.lead_activities FOR SELECT TO authenticated USING (public.is_admin() OR exists (select 1 from public.leads l where l.id = lead_id and (l.assigned_to = auth.uid() or exists (select 1 from public.ambassadors a where a.id = l.first_touch_ambassador_id and a.profile_id = auth.uid()))));
DROP POLICY IF EXISTS "activities_insert_role" ON public.lead_activities;
CREATE POLICY "activities_insert_role" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() AND (public.is_admin() OR exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())));
DROP POLICY IF EXISTS "activities_update_admin" ON public.lead_activities;
CREATE POLICY "activities_update_admin" ON public.lead_activities FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "activities_delete_admin" ON public.lead_activities;
CREATE POLICY "activities_delete_admin" ON public.lead_activities FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "followups_select_role" ON public.follow_ups;
CREATE POLICY "followups_select_role" ON public.follow_ups FOR SELECT TO authenticated USING (public.is_admin() OR assigned_to = auth.uid());
DROP POLICY IF EXISTS "followups_insert_role" ON public.follow_ups;
CREATE POLICY "followups_insert_role" ON public.follow_ups FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR assigned_to = auth.uid());
DROP POLICY IF EXISTS "followups_update_role" ON public.follow_ups;
CREATE POLICY "followups_update_role" ON public.follow_ups FOR UPDATE TO authenticated USING (public.is_admin() OR assigned_to = auth.uid()) WITH CHECK (public.is_admin() OR assigned_to = auth.uid());
DROP POLICY IF EXISTS "followups_delete_admin" ON public.follow_ups;
CREATE POLICY "followups_delete_admin" ON public.follow_ups FOR DELETE TO authenticated USING (public.is_admin());
