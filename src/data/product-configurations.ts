export type PublicConfigStage = 'room' | 'heat' | 'extras';

export interface PublicConfigOption {
  value: string;
  label: string;
  hint?: string;
}

export interface PublicConfigurationGroup {
  key: string;
  label: string;
  help?: string;
  stage: PublicConfigStage;
  options: PublicConfigOption[];
}

/**
 * Verified CUSTOMER-FACING configuration choices that are not stored in sauna
 * markdown yet. No supplier cost, supplier SKU, margin or landed-cost data is
 * allowed in this file.
 *
 * SAWO source: founder-supplied 2026 Sauna Rooms / Accessories price lists.
 * Accessory-package names also match SAWO's current public room configurator.
 */
const SAWO_GLASS_FRONT_ROOM: PublicConfigurationGroup[] = [
  {
    key: 'layout-orientation',
    label: 'Layout orientation',
    help: 'Choose the mirrored room layout that fits your space.',
    stage: 'room',
    options: [
      { value: 'right-side', label: 'Right-side layout' },
      { value: 'left-side', label: 'Left-side layout' },
    ],
  },
  {
    key: 'material',
    label: 'Wood / finish',
    help: 'These material variants are listed for this SAWO room family.',
    stage: 'room',
    options: [
      { value: 'cedar', label: 'Cedar' },
      { value: 'aspen', label: 'Aspen' },
      { value: 'hemlock', label: 'Hemlock' },
      { value: 'heat-treated', label: 'Heat treated' },
    ],
  },
  {
    key: 'accessory-package',
    label: 'Accessory package',
    help: 'Add a SAWO accessory set to the quote, or keep the room package separate.',
    stage: 'extras',
    options: [
      { value: 'room-only', label: 'Room only — no accessory set' },
      { value: 'traditional', label: 'Traditional accessory set' },
      { value: 'essential', label: 'Essential accessory set' },
      { value: 'signature', label: 'Signature accessory set' },
      { value: 'dragon', label: 'Dragon accessory set' },
    ],
  },
];

const CONFIGURATIONS: Record<string, PublicConfigurationGroup[]> = {
  'SAWO 1414 Glass Front Sauna Room': SAWO_GLASS_FRONT_ROOM,
  'SAWO 1419 Glass Front Sauna Room': SAWO_GLASS_FRONT_ROOM,
  'SAWO 1922 Glass Front Sauna Room': SAWO_GLASS_FRONT_ROOM,
};

export function publicConfigurationFor(title: string | undefined): PublicConfigurationGroup[] {
  if (!title) return [];
  return CONFIGURATIONS[title] ?? [];
}
