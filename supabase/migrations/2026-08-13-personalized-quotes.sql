-- ============================================================================
-- BUXENA V2 — personalized quote-to-purchase workflow
-- Prepared 2026-08-13. Apply in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- SAFE TO RE-RUN. Every statement is `add column if not exists` or a guarded
-- constraint replace. Running it twice changes nothing the second time.
--
-- BACKWARD COMPATIBLE AND ADDITIVE ONLY. No column is dropped, renamed or
-- retyped; no row is modified. Every new column is nullable or has a default,
-- so existing quotes keep working untouched. V1 does not read these tables.
--
-- THE APPLICATION DEGRADES GRACEFULLY IF THIS HAS NOT BEEN APPLIED. The code
-- probes once for `quotes.share_token` and, when absent, hides the customer
-- proposal controls in admin and returns 404 on the public proposal route
-- rather than erroring. So there is no ordering requirement between deploying
-- the code and running this.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. The customer-facing proposal link
-- ----------------------------------------------------------------------------
-- A random, non-sequential token. The quote's own uuid is deliberately NOT
-- reused as the public identifier: ids appear in admin URLs, logs and exports,
-- and one leaked id would otherwise expose a customer's pricing. The token can
-- also be rotated without touching the quote.
--
-- No default is set. A token is minted explicitly by the application when a
-- salesperson chooses to share, so a Draft quote has no reachable URL at all.
alter table quotes add column if not exists share_token text;

create unique index if not exists quotes_share_token_key
  on quotes (share_token) where share_token is not null;

-- When the customer first opened it. Populated by the public route on first
-- view. Honest about what it measures: a page load, not a person reading.
alter table quotes add column if not exists viewed_at timestamptz;

-- Acceptance. `accepted_name` records what the customer typed to confirm, so
-- there is a record of who acted rather than just when.
alter table quotes add column if not exists accepted_at timestamptz;
alter table quotes add column if not exists accepted_name text;


-- ----------------------------------------------------------------------------
-- 2. Ownership and the two kinds of note
-- ----------------------------------------------------------------------------
-- Which salesperson is responsible. Shown on the customer proposal as the
-- named contact, so a customer replies to a person rather than a mailbox.
alter table quotes add column if not exists owner_staff_id uuid references profiles(id) on delete set null;

-- STRICT SEPARATION. `customer_notes` is rendered on the proposal.
-- `internal_notes` never leaves the admin. Two columns rather than one field
-- with a visibility flag, because a flag is one bad default away from
-- publishing a margin discussion to the customer.
alter table quotes add column if not exists customer_notes text;
alter table quotes add column if not exists internal_notes text;

-- The enquiry this quote came from. `enquiries.quote_id` already points
-- forward; this points back, so the proposal can show the customer's own
-- project answers without a second lookup through leads.
alter table quotes add column if not exists enquiry_id uuid references enquiries(id) on delete set null;


-- ----------------------------------------------------------------------------
-- 2b. How delivery and installation are handled on THIS quote
-- ----------------------------------------------------------------------------
-- Explicit states rather than inference from delivery_cost/installation_cost.
-- A cost of zero is genuinely ambiguous — it can mean "included", "not yet
-- priced" or "the customer is arranging it", and guessing wrong either
-- promises free delivery we never offered or hides one we did.
--
-- No default and nullable: an unset state renders NOTHING on the proposal.
-- Silence is the correct output when a salesperson has not decided, and far
-- safer than a default that reads to a customer as a commitment.
alter table quotes add column if not exists delivery_state text;
alter table quotes add column if not exists installation_state text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'quotes'::regclass and conname = 'quotes_fulfilment_state_check'
  ) then
    alter table quotes add constraint quotes_fulfilment_state_check check (
      (delivery_state is null or delivery_state in ('included','separate','customer','tbc'))
      and
      (installation_state is null or installation_state in ('included','separate','customer','tbc'))
    );
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 3. Line-item classification and internal cost
-- ----------------------------------------------------------------------------
-- `kind` lets the customer proposal group lines under Sauna / Heater /
-- Controls / Accessories / Delivery / Installation / Other instead of showing
-- one flat list. 'other' is the default so an existing row stays valid.
alter table quote_items add column if not exists kind text not null default 'other';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'quote_items'::regclass and conname = 'quote_items_kind_check'
  ) then
    alter table quote_items add constraint quote_items_kind_check
      check (kind in ('sauna','heater','controls','accessories','delivery','installation','service','other'));
  end if;
end $$;

-- Internal unit cost, for margin calculation. NULLABLE ON PURPOSE and left
-- null everywhere: BUXENA holds verified dealer cost for only three models, and
-- inventing a cost to make a margin figure render would produce a confident
-- number with nothing behind it. Margin is shown only where this is populated.
alter table quote_items add column if not exists unit_cost numeric(12,2);


-- ----------------------------------------------------------------------------
-- 4. Status lifecycle
-- ----------------------------------------------------------------------------
-- Adds 'Ready' (built, not yet shared) and 'Converted' (became an order) to
-- the existing set. Every previously valid value is still valid, so no row can
-- be invalidated by this change.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'quotes'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table quotes drop constraint %I', c.conname);
  end loop;
end $$;

alter table quotes add constraint quotes_status_check
  check (status in ('Draft','Ready','Sent','Viewed','Negotiating','Accepted','Declined','Expired','Converted'));


-- ----------------------------------------------------------------------------
-- 5. Margin floor — configurable, NOT invented
-- ----------------------------------------------------------------------------
-- BUXENA has no approved margin floor yet. The column therefore defaults to
-- NULL, which the application reads as "no floor configured" — it will warn
-- that margin cannot be checked rather than block on a number nobody approved.
-- Set it here when the founders decide one.
alter table settings add column if not exists margin_floor_percent numeric(5,2);


-- ----------------------------------------------------------------------------
-- 6. Verify
-- ----------------------------------------------------------------------------
-- Expect: share_token, viewed_at, accepted_at, accepted_name, owner_staff_id,
-- customer_notes, internal_notes, enquiry_id on quotes; kind + unit_cost on
-- quote_items; margin_floor_percent on settings.
select table_name, column_name, data_type
  from information_schema.columns
 where (table_name = 'quotes' and column_name in
        ('share_token','viewed_at','accepted_at','accepted_name','owner_staff_id',
         'customer_notes','internal_notes','enquiry_id'))
    or (table_name = 'quote_items' and column_name in ('kind','unit_cost'))
    or (table_name = 'settings' and column_name = 'margin_floor_percent')
 order by table_name, column_name;
