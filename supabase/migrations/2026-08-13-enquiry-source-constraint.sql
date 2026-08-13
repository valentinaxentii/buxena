-- ============================================================================
-- BUXENA V2 — free the enquiries.source column
-- Prepared 2026-08-13. Apply as ONE controlled change in the Supabase SQL
-- editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- WHY THIS IS URGENT
-- ------------------
-- `enquiries.source` still carries the original fixed-list CHECK constraint:
--
--     check (source in ('Website','Sauna Advisor','Contact Form','Quote Form','Other'))
--
-- The site now submits TWELVE different source values. Nine of them are not in
-- that list, so their INSERT is rejected by Postgres:
--
--     Check Availability · Consultation Request · For Trade · Plan Your Sauna
--     Project Intake · Quote Comparison · Quote Form — details
--     See It In My Space · Warranty Claim
--
-- Only 'Website', 'Sauna Advisor' and 'Quote Form' (step 1 of the quote form)
-- can currently be written at all.
--
-- The lead is NOT lost when this happens — /api/enquiries treats the database
-- write as one of two independent capture paths and falls back to the staff
-- email and Telegram, which is exactly what that design is for. But the
-- enquiry never reaches the CRM: it does not appear in Admin → Website
-- Enquiries, it cannot be converted to a Lead or a Quote, it has no status, no
-- follow-up date, and it is invisible to the dashboard, analytics and reports.
-- It exists only as an email in an inbox. For a trade enquiry or a warranty
-- claim that is a silently dropped sale.
--
-- It was invisible because it cannot happen locally: `astro dev` short-circuits
-- every submission before Supabase is touched, so the pre-launch board's "all
-- form sources accepted" check exercises the API contract, never the database
-- constraint. The failure only appears in production, in a server log.
--
-- The identical problem was already found and fixed for `leads.source` further
-- down schema.sql ("Lead sources are now configurable … rather than a fixed
-- list"). `enquiries.source` was simply never given the same treatment. This
-- migration applies it.
--
-- SAFE TO RE-RUN. The drop is conditional and the add is guarded, so running
-- it twice changes nothing the second time.
--
-- BACKWARD COMPATIBLE, AND STRICTLY WIDENING. No column is dropped, renamed or
-- retyped; no row is modified. Every value that satisfied the old constraint
-- still satisfies the new one — the new rule only requires that a source is
-- present and not blank. V1 does not read this table and is unaffected.
--
-- ORDERING. Apply this BEFORE the V2 site takes live traffic. Until it is
-- applied, nine of the twelve forms record nothing to the CRM.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Drop the fixed-list CHECK on enquiries.source
-- ----------------------------------------------------------------------------
-- The constraint is looked up dynamically rather than by a guessed name: it was
-- created inline in `create table`, so Postgres named it itself, and that name
-- differs between a database built from schema.sql and one built by hand. This
-- is the same technique schema.sql already uses to replace the status
-- constraint on this table.
--
-- The filter is deliberately narrow — `%source%` AND NOT `%status%` — so the
-- status constraint sitting on the same table is left completely alone.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'enquiries'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%source%'
       and pg_get_constraintdef(oid) not ilike '%status%'
  loop
    execute format('alter table enquiries drop constraint %I', c.conname);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 2. Replace it with a presence check
-- ----------------------------------------------------------------------------
-- Same shape as leads_source_check. The column stays NOT NULL with its
-- 'Website' default, so an enquiry can still never arrive without a source —
-- what changes is that the set of sources is now owned by the application,
-- where the forms are, instead of being frozen in the schema. Adding a form no
-- longer requires a migration, which is what caused this in the first place.
alter table enquiries drop constraint if exists enquiries_source_check;
alter table enquiries add constraint enquiries_source_check
  check (source is not null and length(trim(source)) > 0);


-- ----------------------------------------------------------------------------
-- 3. Verify
-- ----------------------------------------------------------------------------
-- Run this after the statements above. Expect exactly one row, reading:
--   enquiries_source_check | CHECK ((source IS NOT NULL) AND (length(TRIM(BOTH FROM source)) > 0))
--
-- If you still see a constraint containing a list of quoted source names,
-- step 1 did not match it — stop and report the output rather than editing
-- around it.
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'enquiries'::regclass
   and contype = 'c'
   and pg_get_constraintdef(oid) ilike '%source%'
   and pg_get_constraintdef(oid) not ilike '%status%';
