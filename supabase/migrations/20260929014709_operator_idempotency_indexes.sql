create unique index if not exists social_posts_operator_source_uidx
on public.social_posts (user_id, ((metadata->>'source_social_post_id')))
where metadata->>'source_social_post_id' is not null;

create unique index if not exists post_metrics_post_5m_uidx
on public.post_metrics (
  social_post_id,
  date_bin('5 minutes'::interval, measured_at, '2000-01-01 00:00:00+00'::timestamptz)
);
