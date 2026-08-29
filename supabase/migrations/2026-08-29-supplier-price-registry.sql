-- ============================================================================
-- BUXENA V3 — private supplier price-list registry
-- ============================================================================
-- PREPARED ONLY. Do not run against production as part of the V3 branch work.
--
-- Purpose:
--   * retain every supplier price-list version instead of overwriting prices
--   * retain the original private workbook in Supabase Storage
--   * retain every imported source row + raw cells for traceability
--   * keep supplier costs server-side/admin-only
--   * separate supplier costs from public BUXENA retail pricing
--
-- This is additive. Existing suppliers, supplier_products, products, quotes,
-- orders and the public pricing register are not replaced or deleted.
-- ============================================================================

create table if not exists supplier_price_lists (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  catalog_scope text not null,
  list_name text not null,
  source_filename text not null,
  source_sha256 text not null,
  source_storage_path text,
  price_list_date date,
  currency text not null default 'USD',
  incoterm text,
  price_column_label text,
  row_count integer not null default 0 check (row_count >= 0),
  status text not null default 'Needs Review'
    check (status in ('Imported', 'Needs Review', 'Approved', 'Superseded')),
  is_current boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, source_sha256)
);

drop trigger if exists trg_supplier_price_lists_updated_at on supplier_price_lists;
create trigger trg_supplier_price_lists_updated_at before update on supplier_price_lists
  for each row execute function set_updated_at();

-- A supplier may have several simultaneously-current lists when they cover
-- different scopes (for example SAWO Accessories and SAWO Sauna Rooms), but
-- only one current list per supplier + scope.
create unique index if not exists idx_supplier_price_lists_one_current_scope
  on supplier_price_lists (supplier_id, catalog_scope)
  where is_current;

create index if not exists idx_supplier_price_lists_supplier_date
  on supplier_price_lists (supplier_id, price_list_date desc, created_at desc);

create table if not exists supplier_price_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references supplier_price_lists(id) on delete cascade,
  source_row integer not null check (source_row > 0),
  section text,
  item_name text,
  -- Exact source cell used by the supplier for the line. Some lists put a SKU
  -- here, some put a priced description, and some combine right/left SKUs.
  source_item text not null,
  -- Parsed only when the source line clearly looks like a supplier SKU. Never
  -- guessed when it does not.
  supplier_sku text,
  ean text,
  dimensions text,
  material text,
  pack_length numeric(14,6),
  pack_width numeric(14,6),
  pack_height numeric(14,6),
  pack_unit text check (pack_unit in ('mm', 'm')),
  weight_kg numeric(14,6),
  package_m3 numeric(14,6),
  master_box_qty integer,
  inner_box_qty integer,
  -- Supplier source price. Public retail must never read this table directly.
  unit_cost numeric(18,6) not null check (unit_cost >= 0),
  -- Optional mapping to the internal BUXENA model. Import never guesses this.
  product_id uuid references products(id) on delete set null,
  mapping_status text not null default 'Unmapped'
    check (mapping_status in ('Unmapped', 'Mapped', 'Ignored')),
  -- Exact imported row payload for audit/re-parsing. This is intentionally
  -- redundant with normalized columns: losing source detail is worse than
  -- storing a few extra bytes.
  raw_cells jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (price_list_id, source_row)
);

drop trigger if exists trg_supplier_price_items_updated_at on supplier_price_items;
create trigger trg_supplier_price_items_updated_at before update on supplier_price_items
  for each row execute function set_updated_at();

create index if not exists idx_supplier_price_items_list
  on supplier_price_items (price_list_id, source_row);
create index if not exists idx_supplier_price_items_sku
  on supplier_price_items (supplier_sku)
  where supplier_sku is not null;
create index if not exists idx_supplier_price_items_product
  on supplier_price_items (product_id)
  where product_id is not null;

-- Existing supplier_products remains the concise "current commercial relation"
-- table. This optional pointer lets a mapped model cite the exact historical
-- source line that supplied its cost without duplicating the price-list system.
alter table supplier_products
  add column if not exists source_price_item_id uuid references supplier_price_items(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Private source-file storage. No public read policy is created. All price-list
-- upload/download work goes through authenticated admin pages using the
-- server-side service-role client; supplier prices never need browser access.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('supplier-price-lists', 'supplier-price-lists', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------------
-- RLS / grants: unlike ordinary admin tables, authenticated staff get NO
-- direct SQL read grant. The admin-only server route reads with service_role.
-- ---------------------------------------------------------------------------
alter table supplier_price_lists enable row level security;
alter table supplier_price_items enable row level security;

revoke all on supplier_price_lists from anon, authenticated;
revoke all on supplier_price_items from anon, authenticated;
grant select, insert, update, delete on supplier_price_lists, supplier_price_items to service_role;

-- Helpful current-cost view for server-side/admin use. It never exposes a
-- customer price and it is not granted to anon/authenticated roles.
create or replace view current_supplier_price_items as
select
  l.supplier_id,
  l.catalog_scope,
  l.price_list_date,
  l.currency,
  l.incoterm,
  l.source_filename,
  i.*
from supplier_price_lists l
join supplier_price_items i on i.price_list_id = l.id
where l.is_current and l.status = 'Approved';

revoke all on current_supplier_price_items from anon, authenticated;
grant select on current_supplier_price_items to service_role;
