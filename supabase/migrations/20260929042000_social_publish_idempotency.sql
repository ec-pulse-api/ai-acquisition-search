drop index if exists public.social_posts_operator_source_uidx;

create unique index if not exists social_posts_operator_source_network_uidx
on public.social_posts (
  user_id,
  ((metadata->>'source_social_post_id')),
  network
)
where metadata->>'source_social_post_id' is not null;

create unique index if not exists video_assets_production_job_uidx
on public.video_assets (production_job_id)
where production_job_id is not null;
