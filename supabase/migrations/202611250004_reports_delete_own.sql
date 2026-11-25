-- Allow approved employees to delete only their own reports.
-- Ownership is enforced by RLS; client-side filters are an additional safeguard.
begin;

drop policy if exists "reports: approved delete own" on public.reports;
create policy "reports: approved delete own"
  on public.reports
  for delete
  to authenticated
  using (user_id = auth.uid() and public.is_approved());

grant delete on public.reports to authenticated;

commit;
