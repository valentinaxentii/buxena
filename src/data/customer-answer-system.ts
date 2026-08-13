import type { ApprovedPrice } from './pricing';

/** A single fact-safe answer pattern for products, proposals and sales replies. */
export interface ModelSalesFacts {
  inclusions?: string[];
  exclusions?: string[];
  deliveryTiming?: string;
  assembly?: string;
  siteRequirements?: string[];
  electrical?: string;
  warranty?: string;
  optionalServices?: string[];
  /** Internal audit source; never displayed publicly. */
  source?: string;
}

export const genericCustomerResponsibilities = [
  'A suitable, level base for the final sauna footprint and weight',
  'Safe delivery access and any access equipment the site requires',
  'Electrical work by a qualified local electrician when the selected system requires it',
  'Permits, approvals, trenching, panel work, or other local site work where applicable',
];

export const genericOptionalServices = [
  'Project and site review',
  'Delivery coordination',
  'Installation coordination where available',
];

export function projectCostSummary(price: ApprovedPrice | null) {
  return {
    saunaPackage: price?.completeFromPrice ?? price?.fromPrice ?? 'Request pricing',
    installationAllowance: 'Confirmed after site review',
    totalProjectRange: 'Confirmed in your itemized written proposal',
  };
}

export const quoteAnswerChecklist = [
  'Selected sauna and configuration',
  'Every included item, shown line by line',
  'Delivery scope and price, if delivery is included',
  'Installation scope and price, if installation is included',
  'Customer site responsibilities and any exclusions',
  'Applicable warranty documents and boundaries',
  'Quote validity and the next confirmation step',
];
