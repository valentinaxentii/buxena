-- ============================================================================
-- BUXENA V3 — private competitor price intelligence
-- ============================================================================
-- PREPARED ONLY. Do not run against production as part of branch development.
-- Competitor observations are internal research. They never feed public price
-- components directly and never overwrite supplier cost or customer quotes.
-- ============================================================================

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  website text,
  market text,
  default_currency text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_competitors_updated_at on competitors;
create trigger trg_competitors_updated_at before update on competitors
  for each row execute function set_updated_at();

create table if not exists competitor_price_observations (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  observed_on date not null,
  product_name text not null,
  category text,
  currency text not null,
  price numeric(18,2) not null check (price >= 0),
  compare_at_price numeric(18,2) check (compare_at_price is null or compare_at_price >= 0),
  source_url text not null,
  availability text,
  notes text,
  -- Optional manual mapping only. Import/seed scripts never guess that two
  -- similarly named competitor products are the same BUXENA model.
  product_id uuid references products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competitor_id, observed_on, product_name, source_url)
);

drop trigger if exists trg_competitor_price_observations_updated_at on competitor_price_observations;
create trigger trg_competitor_price_observations_updated_at before update on competitor_price_observations
  for each row execute function set_updated_at();

create index if not exists idx_competitor_prices_competitor_date
  on competitor_price_observations (competitor_id, observed_on desc);
create index if not exists idx_competitor_prices_product
  on competitor_price_observations (product_id, observed_on desc)
  where product_id is not null;
create index if not exists idx_competitor_prices_name
  on competitor_price_observations (product_name);

alter table competitors enable row level security;
alter table competitor_price_observations enable row level security;
revoke all on competitors from anon, authenticated;
revoke all on competitor_price_observations from anon, authenticated;
grant select, insert, update, delete on competitors, competitor_price_observations to service_role;

create or replace view latest_competitor_prices as
select distinct on (competitor_id, product_name)
  o.*
from competitor_price_observations o
order by competitor_id, product_name, observed_on desc, created_at desc;

revoke all on latest_competitor_prices from anon, authenticated;
grant select on latest_competitor_prices to service_role;
