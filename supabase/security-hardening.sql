-- BUXENA V2 security hardening
-- Prepared after Supabase security-advisor review.
-- DO NOT apply blindly to production. Review, then run in the intended Supabase project.

begin;

-- Make the margin view respect the querying user's RLS/permissions instead of
-- the view owner's privileges.
alter view public.orders_with_margin set (security_invoker = true);

-- Pin helper-function search paths so object resolution cannot be influenced
-- by a caller-controlled search_path.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.snapshot_product_pricing() set search_path = public, pg_temp;
alter function public.issue_document_number(uuid) set search_path = public, pg_temp;
alter function public.issue_inventory_unit(uuid, uuid, uuid, numeric, text) set search_path = public, pg_temp;
alter function public.issue_service_case_number() set search_path = public, pg_temp;

-- SECURITY DEFINER functions are server/admin primitives. They must never be
-- callable through the public REST API by anonymous or ordinary signed-in users.
revoke all on function public.issue_document_number(uuid) from public, anon, authenticated;
revoke all on function public.issue_inventory_unit(uuid, uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.issue_service_case_number() from public, anon, authenticated;

grant execute on function public.issue_document_number(uuid) to service_role;
grant execute on function public.issue_inventory_unit(uuid, uuid, uuid, numeric, text) to service_role;
grant execute on function public.issue_service_case_number() to service_role;

commit;
