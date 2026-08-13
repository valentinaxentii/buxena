-- BUXENA V2 — enquiry CRM workflow alignment
-- Safe additive/idempotent migration for the fields and statuses the current
-- admin UI + enquiry-conversion layer actually use.
--
-- Review/apply separately to the live BUXENA Supabase project. Committing this
-- file does NOT change the live database.

alter table public.enquiries
  add column if not exists contacted_at timestamptz;

alter table public.enquiries
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

alter table public.enquiries
  drop constraint if exists enquiries_status_check;

alter table public.enquiries
  add constraint enquiries_status_check check (
    status in (
      'New',
      'Contacted',
      'Qualified',
      'Quoted',
      'Won',
      'Lost',
      -- retained for backward compatibility with older rows/workflows
      'Converted',
      'Closed'
    )
  );

create index if not exists idx_enquiries_status_created_at
  on public.enquiries (status, created_at desc);

create index if not exists idx_enquiries_lead_id
  on public.enquiries (lead_id)
  where lead_id is not null;

create index if not exists idx_enquiries_quote_id
  on public.enquiries (quote_id)
  where quote_id is not null;
