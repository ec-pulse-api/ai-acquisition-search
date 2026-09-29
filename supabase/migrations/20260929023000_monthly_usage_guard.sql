create or replace function public.consume_monthly_usage(
  p_user_id uuid, p_event_type text, p_free_limit integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_plan text := 'free'; v_used integer := 0; v_period_start timestamptz := date_trunc('month', now());
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_event_type, 0));
  select coalesce(plan, 'free') into v_plan from public.subscriptions
  where user_id = p_user_id and status in ('active','trialing')
    and (current_period_end is null or current_period_end > now())
  order by updated_at desc limit 1;
  if lower(v_plan) in ('pro','agency') then
    insert into public.usage_events(user_id,event_type,units,metadata) values(p_user_id,p_event_type,1,jsonb_build_object('plan',v_plan));
    return jsonb_build_object('allowed',true,'plan',v_plan,'used',null,'limit',null);
  end if;
  select coalesce(sum(units),0) into v_used from public.usage_events
  where user_id=p_user_id and event_type=p_event_type and created_at>=v_period_start;
  if v_used>=p_free_limit then
    return jsonb_build_object('allowed',false,'plan','free','used',v_used,'limit',p_free_limit);
  end if;
  insert into public.usage_events(user_id,event_type,units,metadata) values(p_user_id,p_event_type,1,jsonb_build_object('plan','free'));
  return jsonb_build_object('allowed',true,'plan','free','used',v_used+1,'limit',p_free_limit);
end; $$;
revoke all on function public.consume_monthly_usage(uuid,text,integer) from public;
grant execute on function public.consume_monthly_usage(uuid,text,integer) to service_role;