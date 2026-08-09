-- ============================================================================
-- BUXENA Admin Portal — database schema
-- ============================================================================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor
-- → New query → paste this whole file → Run). Safe to re-run: everything is
-- guarded with IF NOT EXISTS / OR REPLACE.
--
-- After running this, create your first staff login — see README-ADMIN.md
-- in the project root for the exact steps.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- updated_at helper — reused by every table below
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- profiles — one row per staff login, extends Supabase's own auth.users.
-- This *is* the "users" table: auth.users holds the credential, profiles
-- holds everything about that person relevant to the business.
-- ----------------------------------------------------------------------------
-- Rows are NOT created automatically. Adding a staff member in the Supabase
-- dashboard creates the auth user only, and AdminLayout reads full_name here
-- to label the signed-in user — with no row it falls back to showing their raw
-- email address in the sidebar. Run `node supabase/seed-profiles.mjs` after
-- adding anyone.
-- `role` is stored but not yet enforced: middleware.ts admits any authenticated
-- user to every /admin route, which is correct while the only accounts are
-- founders. Gating on it needs a check there too.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- suppliers
-- ----------------------------------------------------------------------------
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_suppliers_updated_at on suppliers;
create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();

-- Additive supplier fields (2026-07-25 session) — sourcing/commercial terms
-- that didn't have a home yet. Nullable, existing rows unaffected.
alter table suppliers add column if not exists whatsapp text;
alter table suppliers add column if not exists factory_address text;
alter table suppliers add column if not exists website text;
alter table suppliers add column if not exists currency text default 'USD';
alter table suppliers add column if not exists payment_terms text;
alter table suppliers add column if not exists incoterm text;
alter table suppliers add column if not exists typical_lead_time_days integer;
alter table suppliers add column if not exists warranty_terms text;

-- ----------------------------------------------------------------------------
-- supplier_products — the commercial relationship between one supplier and
-- one BUXENA product: their code for it, their price/MOQ/lead time. Deliberately
-- does NOT duplicate spec fields (dimensions, material, glass, heater) that
-- already live on `products` and don't vary by supplier — only genuinely
-- supplier-specific facts get a column here. A product can have more than
-- one supplier (one row per supplier+product pair); a supplier can have
-- many products.
-- ----------------------------------------------------------------------------
create table if not exists supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  supplier_model_code text,
  image_url text,
  moq integer,
  unit_cost numeric(12,2),
  currency text,
  lead_time_days integer,
  production_time_days integer,
  packed_dimensions text,
  weight_kg numeric(10,2),
  units_per_40hc integer,
  notes text,
  is_active boolean not null default true,
  last_price_update date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, product_id)
);
drop trigger if exists trg_supplier_products_updated_at on supplier_products;
create trigger trg_supplier_products_updated_at before update on supplier_products
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  category text,
  cost numeric(12,2),
  selling_price numeric(12,2),
  dimensions jsonb,
  capacity text,
  timber_type text,
  glass_configuration text,
  heater_options text[],
  electrical_requirements text,
  weight_kg numeric(10,2),
  shipping_dimensions text,
  stock_quantity integer not null default 0,
  images text[],
  brochure_url text,
  installation_manual_url text,
  warranty_document_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  lead_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- leads
-- ----------------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  state text,
  source text check (source in ('Website', 'Instagram', 'Facebook', 'Google', 'Referral', 'Manual')) default 'Manual',
  product_id uuid references products(id) on delete set null,
  location_type text check (location_type in ('indoor', 'outdoor')),
  budget numeric(12,2),
  heater_preference text,
  timeline text,
  notes text,
  follow_up_date date,
  assigned_staff uuid references profiles(id) on delete set null,
  status text not null check (
    status in ('New Lead', 'Contacted', 'Qualified', 'Quote Sent', 'Negotiating', 'Won', 'Lost')
  ) default 'New Lead',
  customer_id uuid references customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- quotes + quote_items
-- ----------------------------------------------------------------------------
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique,
  customer_id uuid references customers(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  heater text,
  accessories jsonb,
  delivery_cost numeric(12,2) default 0,
  installation_cost numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  tax_rate numeric(5,2) default 0,
  subtotal numeric(12,2) default 0,
  total numeric(12,2) default 0,
  quote_date date not null default current_date,
  expiry_date date,
  status text not null check (
    status in ('Draft', 'Sent', 'Viewed', 'Negotiating', 'Accepted', 'Declined', 'Expired')
  ) default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_quotes_updated_at on quotes;
create trigger trg_quotes_updated_at before update on quotes
  for each row execute function set_updated_at();

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

-- ----------------------------------------------------------------------------
-- inventory — "Available" is always in_stock - reserved, computed by Postgres
-- itself so it can never drift out of sync with the two source numbers.
-- ----------------------------------------------------------------------------
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  in_stock integer not null default 0,
  incoming integer not null default 0,
  reserved integer not null default 0,
  available integer generated always as (in_stock - reserved) stored,
  supplier_id uuid references suppliers(id) on delete set null,
  container_number text,
  purchase_order text,
  eta date,
  port text,
  warehouse text,
  landed_cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_inventory_updated_at on inventory;
create trigger trg_inventory_updated_at before update on inventory
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- orders — landed cost / gross profit / gross margin are generated columns,
-- so every screen reading this table sees the same numbers, always.
-- ----------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer_id uuid references customers(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  heater text,
  accessories jsonb,
  selling_price numeric(12,2) default 0,
  deposit numeric(12,2) default 0,
  balance numeric(12,2) default 0,
  supplier_id uuid references suppliers(id) on delete set null,
  purchase_order text,
  container_number text,
  eta date,
  delivery_address text,
  installation_status text,
  status text not null check (
    status in (
      'Deposit Received', 'Ordered', 'In Production', 'Shipped', 'At Port',
      'Warehouse', 'Delivery Scheduled', 'Delivered', 'Installed'
    )
  ) default 'Deposit Received',
  notes text,
  product_cost numeric(12,2) default 0,
  ocean_freight numeric(12,2) default 0,
  customs_duty numeric(12,2) default 0,
  port_handling numeric(12,2) default 0,
  inland_delivery numeric(12,2) default 0,
  warehouse_cost numeric(12,2) default 0,
  installation_cost numeric(12,2) default 0,
  other_cost numeric(12,2) default 0,
  landed_cost numeric(12,2) generated always as (
    coalesce(product_cost, 0) + coalesce(ocean_freight, 0) + coalesce(customs_duty, 0) +
    coalesce(port_handling, 0) + coalesce(inland_delivery, 0) + coalesce(warehouse_cost, 0) +
    coalesce(installation_cost, 0) + coalesce(other_cost, 0)
  ) stored,
  gross_profit numeric(12,2) generated always as (
    coalesce(selling_price, 0) - (
      coalesce(product_cost, 0) + coalesce(ocean_freight, 0) + coalesce(customs_duty, 0) +
      coalesce(port_handling, 0) + coalesce(inland_delivery, 0) + coalesce(warehouse_cost, 0) +
      coalesce(installation_cost, 0) + coalesce(other_cost, 0)
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- Additive columns (2026-07-24 session) — nullable, no data/column changes.
-- `eta` and `installation_status` already existed above; the rest of the
-- shipping/install timeline didn't have a home yet.
alter table orders add column if not exists production_completion_date date;
alter table orders add column if not exists etd date;
alter table orders add column if not exists port text;
alter table orders add column if not exists warehouse text;
alter table orders add column if not exists delivery_date date;
alter table orders add column if not exists installation_date date;

-- ----------------------------------------------------------------------------
-- shipments / shipment_items — supplier/container purchase orders (inbound
-- purchasing), distinct from `orders` (customer sales orders, outbound).
-- Draft shipments never count as incoming inventory — only once a shipment
-- leaves Draft does `src/lib/shipment-inventory.ts` recompute the affected
-- products' `inventory.incoming`. Totals are plain stored columns computed
-- by the app on save, same pattern as quotes.subtotal/total, since they
-- aggregate child rows (Postgres generated columns can't do that).
-- ----------------------------------------------------------------------------
create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_number text unique,
  po_reference text,
  supplier_id uuid references suppliers(id) on delete set null,
  order_date date,
  container_number text,
  origin text,
  destination text,
  etd date,
  eta date,
  status text not null check (
    status in (
      'Draft', 'Ordered', 'In Production', 'Ready to Ship', 'In Transit',
      'Arrived', 'Partially Received', 'Received', 'Cancelled'
    )
  ) default 'Draft',
  currency text not null default 'USD',
  notes text,
  ocean_freight numeric(12,2) default 0,
  port_charges numeric(12,2) default 0,
  customs_brokerage numeric(12,2) default 0,
  inland_delivery numeric(12,2) default 0,
  other_costs numeric(12,2) default 0,
  total_units integer not null default 0,
  total_product_cost numeric(12,2) not null default 0,
  total_landed_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_shipments_updated_at on shipments;
create trigger trg_shipments_updated_at before update on shipments
  for each row execute function set_updated_at();

create table if not exists shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null default 1,
  quantity_received integer not null default 0,
  unit_cost numeric(12,2) default 0,
  heater_configuration text,
  notes text,
  line_total numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

-- gross_margin_pct needs division, which `generated always as` allows, but
-- guard the divide-by-zero case with a plain view column instead of a stored
-- generated column (division by a generated column in the same row is fine).
--
-- Dropped and recreated rather than CREATE OR REPLACE: Postgres only allows
-- REPLACE to *append* columns to a view, never to change the position of an
-- existing one. Every `alter table orders add column` above inserts new
-- columns before `gross_margin_pct` in this view's `select o.*` expansion,
-- which REPLACE rejects outright (42P16). A view holds no data of its own —
-- it's a saved query — so dropping and recreating it touches zero rows in
-- the real `orders` table and is always safe to rerun.
drop view if exists orders_with_margin;
create view orders_with_margin as
  select o.*,
    case when coalesce(o.selling_price, 0) = 0 then null
      else round((o.gross_profit / o.selling_price) * 100, 2)
    end as gross_margin_pct
  from orders o;

-- ----------------------------------------------------------------------------
-- enquiries — website forms + the Sauna Advisor chat both write here.
-- ----------------------------------------------------------------------------
create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  location text,
  message text,
  chat_transcript jsonb,
  sauna_interest text,
  source text not null check (
    source in ('Website', 'Sauna Advisor', 'Contact Form', 'Quote Form', 'Other')
  ) default 'Website',
  status text not null check (status in ('New', 'Contacted', 'Converted', 'Closed')) default 'New',
  lead_id uuid references leads(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- documents — a file reference, optionally tied to any one business record.
-- ----------------------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'Supplier Price List', 'Brochure', 'Installation Manual', 'Electrical Specification',
      'Warranty Document', 'Customs Document', 'Container Document', 'Customer Quote', 'Invoice'
    )
  ),
  file_url text not null,
  file_name text,
  supplier_id uuid references suppliers(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table documents add column if not exists notes text;

-- Category list widened (2026-07-24 session) to cover Purchase Orders,
-- Shipping Documents, job-level Installation Documents, and general Product
-- Specifications, in addition to every category that already existed —
-- purely additive, every previously-valid value is still valid.
alter table documents drop constraint if exists documents_category_check;
alter table documents add constraint documents_category_check check (
  category in (
    'Supplier Price List', 'Brochure', 'Installation Manual', 'Installation Document',
    'Product Specification', 'Electrical Specification', 'Warranty Document',
    'Customs Document', 'Shipping Document', 'Container Document', 'Purchase Order',
    'Customer Quote', 'Invoice'
  )
);

-- ----------------------------------------------------------------------------
-- activities — a simple timeline/audit trail against any lead/customer/etc.
-- ----------------------------------------------------------------------------
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'customer', 'quote', 'order')),
  entity_id uuid not null,
  activity_type text not null check (
    activity_type in ('note', 'call', 'email', 'status_change', 'follow_up')
  ),
  description text,
  staff_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_activities_entity on activities (entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- settings — single-row business configuration (2026-07-24 session addition).
-- `id` is pinned to 1 and checked, so there is always exactly one row: an
-- upsert-by-id=1 pattern rather than a real multi-row table.
-- ----------------------------------------------------------------------------
create table if not exists settings (
  id integer primary key default 1,
  company_name text not null default 'BUXENA',
  company_email text not null default 'info@buxena.com',
  company_phone text,
  company_address text,
  company_website text default 'buxena.com',
  pdf_tagline text not null default 'Where Wellness Starts',
  currency text not null default 'USD',
  default_tax_rate numeric(5,2) not null default 0,
  default_quote_validity_days integer not null default 30,
  default_deposit_percent numeric(5,2) not null default 50,
  default_port text,
  default_warehouse text,
  quote_number_prefix text not null default 'Q-',
  order_number_prefix text not null default 'O-',
  lead_sources text[] not null default array['Website', 'Instagram', 'Facebook', 'Google', 'Referral', 'Manual'],
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;
drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- Lead sources are now configurable via the settings row above rather than a
-- fixed list, so the old fixed-list CHECK constraint on leads.source is
-- relaxed to allow any of the admin's configured sources. This only widens
-- what's accepted — no existing leads rows or column types are touched, and
-- every value that satisfied the old constraint still satisfies this one.
alter table leads drop constraint if exists leads_source_check;
alter table leads add constraint leads_source_check check (source is not null and length(trim(source)) > 0);

-- ============================================================================
-- Invoicing — Stage 1: schema + gapless numbering only. No UI/routes/PDF yet.
-- ============================================================================
-- US business, USD only. All money columns are numeric(12,2) dollars, matching
-- quotes/orders exactly — no second money representation.
--
-- Bill-to / ship-to / issuer blocks are TEXT SNAPSHOTS frozen at issue time,
-- following the same philosophy as quote_items.description: an issued invoice
-- must render identically in five years even if the customer moves or the
-- Settings row changes.

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('invoice', 'proforma')) default 'invoice',
  -- Null while draft; assigned exactly once at the draft -> issued transition
  -- by issue_document_number() below. Never reused, never renumbered.
  invoice_number text unique,
  status text not null check (
    status in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void')
  ) default 'draft',

  -- an invoice may come from a quote, an order, or stand alone — none required
  customer_id uuid references customers(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  order_id uuid references orders(id) on delete set null,

  issue_date date,
  due_date date,
  payment_terms text,
  customer_po_reference text,

  -- snapshotted parties (frozen text, not live joins)
  bill_to_name text,
  bill_to_company text,
  bill_to_address text,
  bill_to_email text,
  bill_to_phone text,
  ship_to_name text,
  ship_to_company text,
  ship_to_address text,
  ship_to_email text,
  ship_to_phone text,
  issuer_name text,
  issuer_address text,
  issuer_ein text,
  issuer_email text,
  issuer_phone text,

  -- tax (US state/local sales tax)
  ship_to_state text check (ship_to_state is null or ship_to_state ~ '^[A-Z]{2}$'),
  tax_jurisdiction_label text,
  tax_rate numeric(5,2) default 0,
  tax_exempt boolean not null default false,
  tax_exemption_certificate text,
  -- distinguishes a legitimate no-nexus zero from a bug
  tax_not_collected_reason text,

  -- money: stored values at issue time, not computed on read (quotes pattern)
  subtotal numeric(12,2) default 0,
  discount_total numeric(12,2) default 0,
  freight_total numeric(12,2) default 0,
  taxable_subtotal numeric(12,2) default 0,
  non_taxable_subtotal numeric(12,2) default 0,
  tax_total numeric(12,2) default 0,
  grand_total numeric(12,2) default 0,
  deposit_received numeric(12,2) default 0,
  balance_due numeric(12,2) default 0,

  notes text,
  terms text,
  -- voiding keeps the row and its number; corrections happen via credit note
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_invoices_updated_at on invoices;
create trigger trg_invoices_updated_at before update on invoices
  for each row execute function set_updated_at();

-- Line items mirror quote_items: description/model_code are frozen text
-- snapshots. product_id exists for reporting ONLY — rendering must never
-- depend on it. Freight/crating/installation are their own rows with their
-- own is_taxable flag because their taxability varies by state.
create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  sort_order integer not null default 0,
  line_type text not null check (
    line_type in (
      'product', 'freight', 'crating', 'liftgate', 'delivery_surcharge',
      'installation', 'warranty', 'discount', 'other'
    )
  ) default 'product',
  model_code text,
  description text not null,
  spec_detail text,
  product_id uuid references products(id) on delete set null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_discount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  is_taxable boolean not null default true
);

-- Payments: deposits and balance payments are separate rows. The
-- deposit_received / balance_due columns on invoices are maintained values —
-- stage 2's mutation layer recomputes them from this table inside the same
-- server-side write that inserts a payment. on delete restrict (not cascade):
-- an invoice with recorded payments must never be silently deletable.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete restrict,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  method text,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- Gapless per-year counters. Deliberately NOT a Postgres sequence: nextval()
-- does not roll back on a failed transaction and would leave gaps. A plain
-- row updated under SELECT ... FOR UPDATE is fully transactional — a failed
-- issue rolls the increment back too, so no number is ever consumed.
create table if not exists document_counters (
  scope text not null,          -- 'INV' | 'PRO'
  year integer not null,
  last_number integer not null default 0,
  primary key (scope, year)
);

-- Assigns the next number at the draft -> issued transition, atomically.
-- Concurrency: the FOR UPDATE row lock on the counter serializes concurrent
-- issues for the same scope+year; each waiter re-reads after the lock is
-- granted, so two simultaneous issues can neither collide nor skip.
-- Sequence restarts each calendar year (year taken from the invoice's
-- issue_date when set, else today). Format INV-YYYY-NNNN / PRO-YYYY-NNNN.
create or replace function issue_document_number(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc record;
  v_scope text;
  v_year integer;
  v_next integer;
  v_number text;
begin
  -- lock the invoice row first (consistent lock order: invoice, then counter)
  select id, document_type, status, invoice_number, issue_date
    into v_doc
    from invoices
   where id = p_invoice_id
   for update;

  if not found then
    raise exception 'invoice % not found', p_invoice_id;
  end if;
  if v_doc.status <> 'draft' or v_doc.invoice_number is not null then
    raise exception 'invoice % is not an unnumbered draft (status=%, number=%)',
      p_invoice_id, v_doc.status, coalesce(v_doc.invoice_number, 'null');
  end if;

  v_scope := case v_doc.document_type when 'proforma' then 'PRO' else 'INV' end;
  v_year := extract(year from coalesce(v_doc.issue_date, current_date))::integer;

  insert into document_counters (scope, year, last_number)
  values (v_scope, v_year, 0)
  on conflict (scope, year) do nothing;

  select last_number + 1
    into v_next
    from document_counters
   where scope = v_scope and year = v_year
   for update;

  update document_counters
     set last_number = v_next
   where scope = v_scope and year = v_year;

  v_number := v_scope || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');

  update invoices
     set status = 'issued',
         invoice_number = v_number,
         issue_date = coalesce(issue_date, current_date)
   where id = p_invoice_id;

  return v_number;
end;
$$;

-- Additive customer tax fields (no existing column altered)
alter table customers add column if not exists tax_exempt boolean not null default false;
alter table customers add column if not exists tax_exemption_certificate text;

-- Additive issuer/company fields on the existing settings singleton (same
-- storage pattern the quote PDF already reads company identity from)
alter table settings add column if not exists company_ein text;
alter table settings add column if not exists bank_name text;
alter table settings add column if not exists bank_account_name text;
alter table settings add column if not exists bank_account_number text;
alter table settings add column if not exists bank_routing_number text;
alter table settings add column if not exists bank_wire_instructions text;
alter table settings add column if not exists remit_to_address text;

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Every table's real access path is server-side, using the service_role key
-- (set only in Netlify's environment variables, never shipped to the
-- browser) — service_role always bypasses RLS, so the app works regardless
-- of the policies below. These policies exist purely as a second layer of
-- defense: even if the anon/publishable key ever leaked or got used by
-- mistake, nothing here can be read or written without a logged-in Supabase
-- session, and no client-side write path exists at all.
-- ============================================================================
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles', 'suppliers', 'products', 'customers', 'leads', 'quotes',
    'quote_items', 'inventory', 'orders', 'enquiries', 'documents', 'activities',
    'settings', 'shipments', 'shipment_items', 'supplier_products',
    'invoices', 'invoice_line_items', 'payments', 'document_counters'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated read only" on %I', t);
    execute format(
      'create policy "authenticated read only" on %I for select to authenticated using (true)',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- Table-level grants
-- ============================================================================
-- RLS and GRANTs are two separate permission layers in Postgres — enabling
-- RLS above does NOT by itself give any role permission to touch a table;
-- Postgres checks the base GRANT first, and only then evaluates RLS. Supabase
-- normally applies these automatically, but if a project ever ends up
-- without them, every query fails with "permission denied for table x"
-- (Postgres error 42501) even though the RLS policies above look correct.
-- service_role needs full access (it's how the app's own server-side code
-- reads/writes everything); authenticated only needs read, matching the
-- read-only RLS policy above.
grant usage on schema public to service_role, authenticated;
grant all on all tables in schema public to service_role;
grant select on all tables in schema public to authenticated;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant all on sequences to service_role;

-- Explicit per-table grant for the new `settings` table, in addition to the
-- wildcard above — a prior session found the wildcard form didn't always
-- take effect for a newly-added table (see HANDOFF.md), so this is the
-- confirmed-working fallback applied proactively rather than after hitting
-- the same "permission denied for table settings" error again.
grant select, insert, update, delete on settings to service_role;
grant select on settings to authenticated;
grant select, insert, update, delete on shipments, shipment_items to service_role;
grant select on shipments, shipment_items to authenticated;
grant select, insert, update, delete on supplier_products to service_role;
grant select on supplier_products to authenticated;
grant select, insert, update, delete on invoices, invoice_line_items, payments, document_counters to service_role;
grant select on invoices, invoice_line_items, payments, document_counters to authenticated;
grant execute on function issue_document_number(uuid) to service_role;

-- ============================================================================
-- Unit-level inventory foundation (2026-07-26 session)
-- ============================================================================
-- One row per physical sauna, generated from shipment_items when a shipment
-- leaves Draft. `unit_tracked` on products is the gate — deliberately a plain
-- boolean per product (not a hardcoded category check) so unit tracking can
-- extend to other product types later without a schema change. Backfilled
-- true below only for the existing BUH-* sauna rows; every other/future
-- product defaults to false and is untouched by any of the code this adds.
alter table products add column if not exists unit_tracked boolean not null default false;
update products set unit_tracked = true
 where model_name ilike 'BUH-%' and unit_tracked = false;

-- RECEIVED and IN_STOCK are deliberately separate states (not one event):
-- RECEIVED = physically scanned in at the warehouse, condition assessed.
-- IN_STOCK = accepted and available for sale — a distinct, later action for
-- good-condition units. DAMAGED/HOLD units are received but can never reach
-- IN_STOCK. public_token is generated at creation (random, app-side) so a
-- future public /unit/[token] lookup page can be added without ever changing
-- unit_code, the permanent internal identity.
create table if not exists inventory_units (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null unique,
  public_token text unique,
  product_id uuid not null references products(id) on delete restrict,
  shipment_id uuid references shipments(id) on delete set null,
  shipment_item_id uuid references shipment_items(id) on delete set null,
  status text not null check (
    status in ('EXPECTED', 'RECEIVED', 'IN_STOCK', 'DAMAGED', 'HOLD', 'RESERVED', 'SOLD', 'DELIVERED')
  ) default 'EXPECTED',
  condition text check (condition in ('good', 'damaged', 'hold')),
  warehouse text,
  zone text,
  bay text,
  unit_cost numeric(12,2),
  supplier_serial text,
  order_id uuid references orders(id) on delete set null,
  received_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inventory_units_product on inventory_units (product_id, status);
create index if not exists idx_inventory_units_shipment on inventory_units (shipment_id);
create index if not exists idx_inventory_units_shipment_item on inventory_units (shipment_item_id);
drop trigger if exists trg_inventory_units_updated_at on inventory_units;
create trigger trg_inventory_units_updated_at before update on inventory_units
  for each row execute function set_updated_at();

-- Reuse the existing gapless per-year counter table/pattern (scope 'UNIT')
-- rather than inventing a second numbering mechanism. Format BUX-YYNNNN
-- (2-digit year + 4-digit sequence, e.g. BUX-260001) — locks the counter row
-- exactly like issue_document_number() above, then inserts the unit row in
-- the same atomic call so a code can never be minted without its row (or vice
-- versa).
create or replace function issue_inventory_unit(
  p_product_id uuid,
  p_shipment_id uuid,
  p_shipment_item_id uuid,
  p_unit_cost numeric,
  p_public_token text
) returns table (id uuid, unit_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_next integer;
  v_code text;
  v_id uuid;
begin
  v_year := extract(year from current_date)::integer;

  insert into document_counters (scope, year, last_number)
  values ('UNIT', v_year, 0)
  on conflict (scope, year) do nothing;

  select last_number + 1 into v_next
    from document_counters
   where scope = 'UNIT' and year = v_year
   for update;

  update document_counters
     set last_number = v_next
   where scope = 'UNIT' and year = v_year;

  v_code := 'BUX-' || right(v_year::text, 2) || lpad(v_next::text, 4, '0');

  insert into inventory_units (product_id, shipment_id, shipment_item_id, unit_cost, unit_code, public_token, status)
  values (p_product_id, p_shipment_id, p_shipment_item_id, p_unit_cost, v_code, p_public_token, 'EXPECTED')
  returning inventory_units.id into v_id;

  return query select v_id, v_code;
end;
$$;

-- `activities` (used elsewhere for lead/customer/quote/order history) gets a
-- new entity_type so unit receiving events use the same audit-trail table
-- rather than a parallel one. Looks up the check constraint by inspecting
-- pg_constraint rather than assuming Postgres's default auto-generated name,
-- so this is safe to run regardless of how the original constraint ended up
-- named.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'activities'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%entity_type%'
  loop
    execute format('alter table activities drop constraint %I', c.conname);
  end loop;
end $$;

alter table activities add constraint activities_entity_type_check
  check (entity_type in ('lead', 'customer', 'quote', 'order', 'inventory_unit'));

alter table inventory_units enable row level security;
drop policy if exists "authenticated read only" on inventory_units;
create policy "authenticated read only" on inventory_units for select to authenticated using (true);

grant select, insert, update, delete on inventory_units to service_role;
grant select on inventory_units to authenticated;
grant execute on function issue_inventory_unit(uuid, uuid, uuid, numeric, text) to service_role;

-- ============================================================================
-- Website Enquiries management (2026-07-26 session)
-- ============================================================================
-- Enquiry status: replace the old 4-value set with the approved 6-value
-- pipeline (New -> Contacted -> Qualified -> Quoted -> Won/Lost). Verified
-- against live data first: the only status any real row has is 'New', which
-- is unchanged in the new set, so this replace is safe. Dynamic constraint
-- lookup (not a guessed name), same technique used for activities above.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'enquiries'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table enquiries drop constraint %I', c.conname);
  end loop;
end $$;

alter table enquiries add constraint enquiries_status_check
  check (status in ('New', 'Contacted', 'Qualified', 'Quoted', 'Won', 'Lost'));

-- Linked Quote (linked Lead already exists: enquiries.lead_id).
alter table enquiries add column if not exists quote_id uuid references quotes(id) on delete set null;

-- When the enquiry was first contacted (created_at only says when it arrived).
alter table enquiries add column if not exists contacted_at timestamptz;

-- Enquiry timeline reuses the shared activities table (same one leads/
-- customers/quotes/orders/inventory_units already use) — one more
-- entity_type, no new table, no new activity_type values (status_change and
-- note already cover every timeline event this needs).
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'activities'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%entity_type%'
  loop
    execute format('alter table activities drop constraint %I', c.conname);
  end loop;
end $$;

alter table activities add constraint activities_entity_type_check
  check (entity_type in ('lead', 'customer', 'quote', 'order', 'inventory_unit', 'enquiry'));

-- ============================================================================
-- QR Stage 2 foundation (2026-07-26 session)
-- ============================================================================
-- Invoice line -> physical unit. Nullable, additive — matches the existing
-- product_id FK already on this table. A live FK is safe here despite
-- invoices otherwise freezing party/amount data as text: unit_code and
-- public_token are permanent by construction (no code anywhere mutates them
-- after creation), so this reference can never drift the way a live
-- customer/price join could. Existing issued invoices are unaffected: this
-- column defaults to null on every existing row, and nothing renders a QR
-- unless it is explicitly set — no retroactive inference, ever.
alter table invoice_line_items add column if not exists assigned_unit_id uuid references inventory_units(id) on delete set null;

-- Warranty start-date policy — configurable in Settings, not hardcoded.
-- Default matches the approved business rule (delivery date) without baking
-- it permanently into application code, so changing the policy later never
-- requires another schema change.
alter table settings add column if not exists warranty_start_source text
  not null default 'delivery_date'
  check (warranty_start_source in ('delivery_date', 'installation_date', 'invoice_date', 'manual'));

-- Warranty foundation only — no claims table yet (explicitly deferred to a
-- later stage). unique(unit_id): one physical unit can have exactly one
-- primary warranty record, enforced at the database level, not just in
-- application code. on delete restrict (not cascade/set null), matching the
-- existing payments -> invoices pattern: a unit with a real warranty record
-- must never be silently deletable out from under it.
create table if not exists warranties (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references inventory_units(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  warranty_start_date date,
  warranty_end_date date,
  status text not null check (status in ('NOT_REGISTERED', 'ACTIVE', 'EXPIRED', 'VOID')) default 'NOT_REGISTERED',
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_warranties_updated_at on warranties;
create trigger trg_warranties_updated_at before update on warranties
  for each row execute function set_updated_at();

alter table warranties enable row level security;
drop policy if exists "authenticated read only" on warranties;
create policy "authenticated read only" on warranties for select to authenticated using (true);

grant select, insert, update, delete on warranties to service_role;
grant select on warranties to authenticated;

-- ============================================================================
-- Unit lifecycle Stage A: Delivery, Installation, Service/Warranty Claims,
-- Documents foundation (2026-07-26 session) — Tier 1 + Tier 2 combined
-- ============================================================================

-- --- Delivery — recorded on the physical unit (the digital passport this
-- whole system is built around), not the order. Nullable/additive; every
-- existing inventory_units row is unaffected.
alter table inventory_units add column if not exists delivery_date date;
alter table inventory_units add column if not exists delivered_by text;
alter table inventory_units add column if not exists delivery_condition text;
alter table inventory_units add column if not exists customer_acknowledged_at timestamptz;
alter table inventory_units add column if not exists delivery_notes text;

-- --- Installation
alter table inventory_units add column if not exists installation_date date;
alter table inventory_units add column if not exists installation_type text
  check (installation_type in ('DIY', 'BUXENA', 'THIRD_PARTY'));
alter table inventory_units add column if not exists installer_company text;
alter table inventory_units add column if not exists electrician_name text;
-- Free text, matching the existing orders.installation_status convention
-- (also unconstrained, validated at the app layer) rather than introducing a
-- second, differently-shaped status pattern.
alter table inventory_units add column if not exists installation_status text;
alter table inventory_units add column if not exists installation_notes text;

-- --- Service cases / warranty claims (Tier 2). One row per case, always
-- tied to the exact physical unit — on delete restrict, matching the same
-- "a unit with real history must never be silently deletable" rule already
-- used for warranties. warranty_status_at_open is a deliberate snapshot (the
-- same principle invoices already use for frozen data): a case should always
-- remember what the warranty state actually was the day it was opened, even
-- if the warranty's live status changes later.
create table if not exists service_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  unit_id uuid not null references inventory_units(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  warranty_status_at_open text,
  category text check (
    category in ('Heater', 'Controller/Wi-Fi', 'Lighting', 'Door/Glass', 'Wood', 'Roof', 'Electrical', 'Installation', 'Other')
  ),
  issue_description text,
  status text not null check (
    status in ('NEW', 'REVIEWING', 'WAITING_CUSTOMER', 'WAITING_SUPPLIER', 'APPROVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DENIED')
  ) default 'NEW',
  assigned_staff uuid references profiles(id) on delete set null,
  opened_date date not null default current_date,
  resolution text,
  parts_replaced text,
  completed_date date,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_service_cases_unit on service_cases (unit_id);
drop trigger if exists trg_service_cases_updated_at on service_cases;
create trigger trg_service_cases_updated_at before update on service_cases
  for each row execute function set_updated_at();

-- Reuses the same gapless per-year counter table/pattern as invoices and
-- unit codes (scope 'CASE'). Format SVC-YYYY-NNNN. Unlike issue_inventory_unit
-- this only mints the number — service_cases has many more app-supplied
-- fields than a bare unit row, so the insert itself stays in application
-- code rather than being folded into the function.
create or replace function issue_service_case_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_next integer;
  v_number text;
begin
  v_year := extract(year from current_date)::integer;

  insert into document_counters (scope, year, last_number)
  values ('CASE', v_year, 0)
  on conflict (scope, year) do nothing;

  select last_number + 1 into v_next
    from document_counters
   where scope = 'CASE' and year = v_year
   for update;

  update document_counters
     set last_number = v_next
   where scope = 'CASE' and year = v_year;

  v_number := 'SVC-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
  return v_number;
end;
$$;

alter table service_cases enable row level security;
drop policy if exists "authenticated read only" on service_cases;
create policy "authenticated read only" on service_cases for select to authenticated using (true);
grant select, insert, update, delete on service_cases to service_role;
grant select on service_cases to authenticated;
grant execute on function issue_service_case_number() to service_role;

-- --- Documents: unit-level and service-case-level attachments. Product/
-- model-level documents already work today via the existing documents.
-- product_id — a unit inherits its model's manuals by querying through
-- product_id, never by duplicating the file per physical unit.
alter table documents add column if not exists unit_id uuid references inventory_units(id) on delete set null;
alter table documents add column if not exists service_case_id uuid references service_cases(id) on delete set null;

-- Category widened for delivery/installation/service/warranty document
-- types. Every existing value — confirmed live, only 'Brochure' is actually
-- in use today — stays exactly as-is; nothing is removed.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'documents'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table documents drop constraint %I', c.conname);
  end loop;
end $$;

alter table documents add constraint documents_category_check check (
  category in (
    'Supplier Price List', 'Brochure', 'Installation Manual', 'Installation Document',
    'Product Specification', 'Electrical Specification', 'Warranty Document',
    'Customs Document', 'Shipping Document', 'Container Document', 'Purchase Order',
    'Customer Quote', 'Invoice',
    'Receiving Report', 'Quality Inspection', 'Delivery Document', 'Delivery Photo',
    'Installation Photo', 'Warranty Certificate', 'Service Document', 'Service Photo'
  )
);

-- --- activities: service cases get their own timeline entries in the same
-- shared audit-trail table as everything else this session.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'activities'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%entity_type%'
  loop
    execute format('alter table activities drop constraint %I', c.conname);
  end loop;
end $$;

alter table activities add constraint activities_entity_type_check
  check (entity_type in ('lead', 'customer', 'quote', 'order', 'inventory_unit', 'enquiry', 'service_case'));

-- --- Configuration fields needed for the approved Unit Detail Configuration
-- card (Lighting, Bench type) — no existing column captures either, and
-- nothing else on `products` is touched.
alter table products add column if not exists lighting text;
alter table products add column if not exists bench_type text;

-- ============================================================================
-- Warranty duration architecture (2026-07-26 session) — Stage C follow-up
-- ============================================================================
-- Makes `warranties.warranty_end_date` computable instead of permanently
-- null. Three additive columns, no existing row touched, no existing
-- constraint altered, no data backfilled.

-- BUXENA-wide default warranty length — 24 months (2 years), the confirmed
-- standard BUXENA warranty term. Editable in Settings — same shape as
-- default_tax_rate/default_deposit_percent/default_quote_validity_days above
-- (plain not-null-with-default numeric column, no check constraint, matching
-- every other default_* field already on this table).
alter table settings add column if not exists default_warranty_months integer not null default 24;

-- Optional per-model override. Null (the case for every existing product)
-- means "use the BUXENA default" — resolved in application code as
-- `product.warranty_duration_months ?? settings.default_warranty_months`,
-- never inferred here.
alter table products add column if not exists warranty_duration_months integer;

-- Snapshot of whichever duration was actually applied when a warranty was
-- activated — set once, at activation, and never recomputed afterward. This
-- is what keeps an already-activated warranty's end date stable if the
-- default or a product's override changes later: only warranties activated
-- AFTER a terms change pick up the new duration. Same "freeze what actually
-- happened" principle already used by service_cases.warranty_status_at_open
-- above.
alter table warranties add column if not exists duration_months_applied integer;
