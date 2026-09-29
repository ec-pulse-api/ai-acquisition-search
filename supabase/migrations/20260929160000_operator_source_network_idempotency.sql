-- Reconcile the operator source idempotency constraint with multi-network publishing.
-- The production database already uses this network-scoped index; this migration
-- makes the desired state explicit and safe for environments applying migrations from scratch.
drop index if exists public.social_posts_operator_source_uidx;

create unique index if not exists social_posts_operator_source_network_uidx
on public.social_posts (
  user_id,
  ((metadata->>'source_social_post_id')),
  network
)
where metadata->>'source_social_post_id' is not null;
