import type { SupabaseClient } from '@supabase/supabase-js';

export interface BuxenaSettings {
  company_name: string;
  company_email: string;
  company_phone: string | null;
  company_address: string | null;
  company_website: string | null;
  pdf_tagline: string;
  currency: string;
  default_tax_rate: number;
  default_quote_validity_days: number;
  default_deposit_percent: number;
  default_port: string | null;
  default_warehouse: string | null;
  quote_number_prefix: string;
  order_number_prefix: string;
  lead_sources: string[];
  warranty_start_source: 'delivery_date' | 'installation_date' | 'invoice_date' | 'manual';
  default_warranty_months: number;
}

// Used whenever the `settings` table/migration hasn't been applied yet, or
// the row is unreadable for any reason — the app should degrade to sane
// defaults, never crash a page over missing config.
export const FALLBACK_SETTINGS: BuxenaSettings = {
  company_name: 'BUXENA',
  company_email: 'info@buxena.com',
  company_phone: null,
  company_address: null,
  company_website: 'buxena.com',
  pdf_tagline: 'Where Wellness Starts',
  currency: 'USD',
  default_tax_rate: 0,
  default_quote_validity_days: 30,
  default_deposit_percent: 50,
  default_port: null,
  default_warehouse: null,
  quote_number_prefix: 'Q-',
  order_number_prefix: 'O-',
  lead_sources: ['Website', 'Instagram', 'Facebook', 'Google', 'Referral', 'Manual'],
  warranty_start_source: 'delivery_date',
  default_warranty_months: 24,
};

export async function getSettings(supabase: SupabaseClient): Promise<BuxenaSettings> {
  try {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (!data) return FALLBACK_SETTINGS;
    return { ...FALLBACK_SETTINGS, ...data };
  } catch {
    return FALLBACK_SETTINGS;
  }
}
