create policy "tiktok_publish_consents_select_own"
on public.tiktok_publish_consents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "tiktok_publish_consents_insert_own"
on public.tiktok_publish_consents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "tiktok_publish_consents_update_own"
on public.tiktok_publish_consents
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke execute on function public.rls_auto_enable() from public;
