export interface HeaterSystemLine {
  brand: 'Homecraft';
  line: string;
  electrical: string;
  positioning: string;
  availabilityNote: string;
}

/**
 * Public-safe heater merchandising data.
 *
 * Source: Homecraft dealer correspondence received 2026-08-19 and forwarded
 * to BUXENA. The supplier confirmed these product lines, 240V residential
 * configurations, 208V three-phase availability where applicable, direct U.S.
 * dealer support and the ability to bundle Homecraft heaters with third-party
 * sauna manufacturers.
 *
 * No model-level certification, kW, MSRP or inventory claim is made here until
 * the matching dealer documents are received. Those details are confirmed in
 * the written quote for the selected sauna.
 */
export const heaterSystemLines: HeaterSystemLine[] = [
  {
    brand: 'Homecraft',
    line: 'H-Series',
    electrical: '240V residential; 208V three-phase where applicable',
    positioning: 'A flexible core heater line for residential sauna projects.',
    availabilityNote: 'Exact output, controls, listing and lead time are confirmed against the selected sauna.',
  },
  {
    brand: 'Homecraft',
    line: 'Revive',
    electrical: '240V residential; 208V three-phase where applicable',
    positioning: 'A premium system option for projects where heater design is part of the room experience.',
    availabilityNote: 'Exact output, controls, listing and lead time are confirmed against the selected sauna.',
  },
  {
    brand: 'Homecraft',
    line: 'Revive Slim',
    electrical: '240V residential; 208V three-phase where applicable',
    positioning: 'A space-conscious premium heater line for tighter layouts.',
    availabilityNote: 'Exact output, controls, listing and lead time are confirmed against the selected sauna.',
  },
  {
    brand: 'Homecraft',
    line: 'Apex Mini',
    electrical: '240V residential; 208V three-phase where applicable',
    positioning: 'A compact heater family for smaller sauna rooms and constrained footprints.',
    availabilityNote: 'Exact output, controls, listing and lead time are confirmed against the selected sauna.',
  },
  {
    brand: 'Homecraft',
    line: 'Apex',
    electrical: '240V residential; 208V three-phase where applicable',
    positioning: 'A larger-format heater family for projects that need more output and presence.',
    availabilityNote: 'Exact output, controls, listing and lead time are confirmed against the selected sauna.',
  },
];

export const heaterCommercialFacts = [
  'Homecraft supports direct shipments to U.S. dealer warehouses.',
  'Homecraft permits its heaters to be bundled with third-party sauna manufacturers.',
  'BUXENA confirms heater sizing against room volume, glazing and the selected sauna before quoting.',
  'Model-level certification, controls, warranty, inventory and lead time are confirmed in the written quote.',
];
