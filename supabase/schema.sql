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

-- gross_margin_pct needs division, which `generated always as` allows, but
-- guard the divide-by-zero case with a plain view column instead of a stored
-- generated column (division by a generated column in the same row is fine).
create or replace view orders_with_margin as
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
    'quote_items', 'inventory', 'orders', 'enquiries', 'documents', 'activities'
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
