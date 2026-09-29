-- Billing/legal foundation and Stripe webhook idempotency.
-- Existing billing tables are kept compatible; this migration records their expected security
-- and adds durable webhook event tracking.

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing','processed','failed')),
  payload jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "billing_customers_owner_select" on public.billing_customers;
create policy "billing_customers_owner_select"
  on public.billing_customers
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events (status, received_at);
