create table if not exists public.tiktok_publish_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tiktok_publish_consents enable row level security;
revoke all on public.tiktok_publish_consents from anon, authenticated;
grant all on public.tiktok_publish_consents to service_role;