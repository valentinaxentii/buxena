-- ============================================================================
-- BUXENA V2 — archive/restore + private document storage
-- Prepared 2026-08-12. Apply as ONE controlled change in the Supabase SQL
-- editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- SAFE TO RE-RUN. Every statement is idempotent: `add column if not exists`,
-- `create index if not exists`, and an upsert for the bucket. Running it twice
-- changes nothing the second time.
--
-- BACKWARD COMPATIBLE. Only additive: no column is dropped, renamed or
-- retyped, and no row is modified. Every new column is nullable with no
-- default, so existing rows get NULL = "not archived" = current behaviour.
-- V1 does not read these tables and is unaffected.
--
-- The application degrades gracefully if this has NOT been applied yet: it
-- probes once for the archived_at column and, when absent, skips archive
-- filtering and hides the archive controls rather than erroring. So there is
-- no ordering requirement between deploying the code and running this.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Archive columns
-- ----------------------------------------------------------------------------
-- Soft delete for every business record that previously had only a permanent,
-- irreversible delete. `archived_at IS NULL` means active; a timestamp means
-- archived. Deliberately a timestamp rather than a boolean — "when" is worth
-- knowing and costs nothing extra to store.
--
-- archived_by records who did it. ON DELETE SET NULL so removing a staff
-- profile never cascades into deleting business records.
--
-- The same two columns on every table, on purpose: one shape means one set of
-- helpers, one filter, and no per-table behaviour to remember.

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'leads', 'quotes', 'orders', 'suppliers', 'invoices',
    'documents', 'products', 'inventory', 'shipments', 'enquiries',
    'supplier_products'
  ]
  loop
    execute format('alter table %I add column if not exists archived_at timestamptz', t);
    execute format(
      'alter table %I add column if not exists archived_by uuid references profiles(id) on delete set null',
      t
    );
    -- Partial index: every active-list query filters `archived_at is null`,
    -- and a partial index over exactly those rows stays small no matter how
    -- much is archived over time.
    execute format(
      'create index if not exists %I on %I (archived_at) where archived_at is null',
      'idx_' || t || '_active', t
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 1b. Rebuild orders_with_margin
-- ----------------------------------------------------------------------------
-- The Orders list reads this view, not the table. It is defined as `select o.*`,
-- and a view's column list is FROZEN at creation — adding archived_at to
-- `orders` above does not make it visible through the view. Without this the
-- Orders list would filter on a column the view does not expose and error.
--
-- Same definition as schema.sql, re-created so it picks up the new columns.
drop view if exists orders_with_margin;
create view orders_with_margin as
  select o.*,
    case when coalesce(o.selling_price, 0) = 0 then null
      else round((o.gross_profit / o.selling_price) * 100, 2)
    end as gross_margin_pct
  from orders o;

grant select on orders_with_margin to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. Private documents bucket
-- ----------------------------------------------------------------------------
-- Was public: every uploaded file readable by anyone holding the URL, with an
-- unguessable path as the only protection. Fine for an installation manual,
-- not for what the upload form offers to store — Supplier Price List, Invoice,
-- Customer Quote, Purchase Order. Dealer cost is this business's core
-- commercial secret and one forwarded link handed it over.
--
-- Reads now go through src/lib/document-access.ts, which mints a short-lived
-- signed URL server-side per render. The service-role key never reaches the
-- browser; only the expiring URL does.
--
-- `on conflict do update set public = false` rather than `do nothing`: on a
-- project where this bucket already exists as public, `do nothing` would
-- silently leave it public and this migration would be a no-op that looked
-- like a success.
--
-- As of 2026-08-12 this project has NO storage buckets at all, so this creates
-- the bucket private from the start. Nothing has ever been uploaded, so there
-- is no existing object to re-key and no exposure window to close.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;


-- ----------------------------------------------------------------------------
-- 3. Verification (read-only — safe to run, changes nothing)
-- ----------------------------------------------------------------------------
-- Expect 12 rows, each showing has_archived_at = true.
select
  c.table_name,
  bool_or(c.column_name = 'archived_at') as has_archived_at,
  bool_or(c.column_name = 'archived_by') as has_archived_by
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'customers', 'leads', 'quotes', 'orders', 'suppliers', 'invoices',
    'documents', 'products', 'inventory', 'shipments', 'enquiries',
    'supplier_products'
  )
group by c.table_name
order by c.table_name;

-- Expect exactly one row: documents | f
select id, public from storage.buckets where id = 'documents';
