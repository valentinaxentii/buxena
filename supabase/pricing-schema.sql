-- ============================================================================
-- BUXENA — Product Pricing Control Center storage
-- ============================================================================
-- PREPARED BUT NOT YET RUN. This adds two NEW tables. It does not modify or
-- delete anything that exists — products, orders, enquiries etc. are
-- untouched, and existing product cost/selling_price values are untouched.
-- Safe to run more than once (every statement is IF NOT EXISTS / OR REPLACE).
--
-- WHAT IT ADDS, IN PLAIN WORDS:
--   product_pricing          one pricing worksheet per sauna model
--   product_pricing_history  automatic snapshot every time a worksheet
--                            changes, so old pricing is never lost
-- ============================================================================

create table if not exists product_pricing (
  product_id uuid primary key references products(id) on delete cascade,

  -- SUPPLIER COST
  supplier_model text,
  exw_eur numeric(12,2),
  fx_rate numeric(10,6),
  -- auto-calculated: EXW in USD
  exw_usd numeric(12,2) generated always as (round(exw_eur * fx_rate, 2)) stored,

  -- LANDED COST
  duty_pct numeric(6,3),
  duty_amount numeric(12,2) generated always as (round(exw_eur * fx_rate * duty_pct / 100.0, 2)) stored,
  ocean_freight numeric(12,2),
  port_handling numeric(12,2),
  inland_trucking numeric(12,2),
  other_import numeric(12,2),
  sauna_landed_cost numeric(12,2) generated always as (
    round(
      coalesce(exw_eur * fx_rate, 0)
      + coalesce(exw_eur * fx_rate * duty_pct / 100.0, 0)
      + coalesce(ocean_freight, 0)
      + coalesce(port_handling, 0)
      + coalesce(inland_trucking, 0)
      + coalesce(other_import, 0)
    , 2)
  ) stored,

  -- BUXENA COMPLETE components
  heater_model text,
  heater_cost numeric(12,2),
  controls_cost numeric(12,2),
  stones_cost numeric(12,2),
  lighting_cost numeric(12,2),
  accessories_cost numeric(12,2),
  complete_landed_cost numeric(12,2) generated always as (
    round(
      coalesce(exw_eur * fx_rate, 0)
      + coalesce(exw_eur * fx_rate * duty_pct / 100.0, 0)
      + coalesce(ocean_freight, 0)
      + coalesce(port_handling, 0)
      + coalesce(inland_trucking, 0)
      + coalesce(other_import, 0)
      + coalesce(heater_cost, 0)
      + coalesce(controls_cost, 0)
      + coalesce(stones_cost, 0)
      + coalesce(lighting_cost, 0)
      + coalesce(accessories_cost, 0)
    , 2)
  ) stored,

  -- RETAIL
  target_markup_pct numeric(6,2),
  target_margin_pct numeric(6,2),
  recommended_retail numeric(12,2),
  approved_from_price numeric(12,2),
  -- true = show "Project Pricing" publicly instead of a fixed From price
  project_pricing boolean not null default false,
  min_selling_price numeric(12,2),

  -- STATUS / PROVENANCE
  status text not null default 'Draft' check (status in ('Draft', 'Needs Review', 'Approved')),
  source_document text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_pricing_updated_at on product_pricing;
create trigger trg_product_pricing_updated_at before update on product_pricing
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- History: every UPDATE stores the previous version automatically.
-- ----------------------------------------------------------------------------
create table if not exists product_pricing_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  snapshot jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_pricing_history_product
  on product_pricing_history (product_id, changed_at desc);

create or replace function snapshot_product_pricing()
returns trigger language plpgsql as $$
begin
  insert into product_pricing_history (product_id, snapshot)
  values (old.product_id, to_jsonb(old));
  return new;
end $$;

drop trigger if exists trg_product_pricing_history on product_pricing;
create trigger trg_product_pricing_history before update on product_pricing
  for each row execute function snapshot_product_pricing();

-- ----------------------------------------------------------------------------
-- Security: same model as every other admin table — RLS on, server-side
-- service_role does the real work, signed-in staff get read-only backstop.
-- Grants name the tables EXPLICITLY (see HANDOFF.md — the wildcard grant
-- silently failed to apply once before).
-- ----------------------------------------------------------------------------
alter table product_pricing enable row level security;
alter table product_pricing_history enable row level security;

drop policy if exists "authenticated read product_pricing" on product_pricing;
create policy "authenticated read product_pricing"
  on product_pricing for select to authenticated using (true);

drop policy if exists "authenticated read product_pricing_history" on product_pricing_history;
create policy "authenticated read product_pricing_history"
  on product_pricing_history for select to authenticated using (true);

grant select, insert, update, delete on product_pricing, product_pricing_history to service_role;
grant select on product_pricing, product_pricing_history to authenticated;
