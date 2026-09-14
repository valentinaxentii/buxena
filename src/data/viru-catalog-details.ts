export interface CatalogAccessoryGroup {
  label: string;
  items: string[];
}

export interface ViruCatalogDetails {
  modelCode: string;
  cataloguePage: number;
  specificationFile: string;
  woodOptions: string[];
  heaterOptions: string[];
  deliveryOptions: string[];
  basicSet: string[];
  accessories: CatalogAccessoryGroup[];
}

const frontWall = [
  'Wooden door with window and lock',
  'Glass wall with glass door',
  'Mirror-glass wall with mirror-glass door',
  'Outdoor LED light for glass front wall',
];

const backWall = [
  'Openable or non-openable windows',
  'Panoramic window',
  'Panoramic window with mirror glass',
  'Half-panoramic window',
  'Half-panoramic window with mirror glass',
  'Outdoor LED light for panoramic window',
];

const compactBackWall = [
  'Openable or non-openable windows',
  'Half-panoramic window',
  'Half-panoramic window with mirror glass',
  'Outdoor LED light for panoramic window',
];

const interior = [
  'Thermowood floor',
  'LED light for steam room',
  'Backrest - 2 pcs.',
  'Steam-room lighting',
  'Water tank - 24 L',
];

const compactInterior = interior.filter((item) => !item.startsWith('Backrest'));

function accessorySet(style: 'canopy' | 'hoop', compact = false): CatalogAccessoryGroup[] {
  return [
    { label: 'Front wall', items: frontWall },
    { label: 'Back wall', items: compact ? compactBackWall : backWall },
    { label: 'Interior', items: compact ? compactInterior : interior },
    {
      label: 'Exterior',
      items: [
        'Roof angles - 2 pcs.',
        style === 'canopy' ? 'Canopy - 40 cm' : 'Decorative wooden hoop',
        'Outdoor lamp',
      ],
    },
  ];
}

function barrelBasicSet(options: {
  benches?: 'Thermowood' | 'Alder';
  glassDoor?: string;
  woodenFrontDoor?: boolean;
  stones?: boolean;
  hoops: number;
  feet: number;
}): string[] {
  return [
    'Spruce or Thermowood barrel',
    `Benches from ${options.benches ?? 'Thermowood'}`,
    options.glassDoor ?? 'Brown tempered-glass door',
    ...(options.woodenFrontDoor ? ['Wooden front door with lock'] : []),
    'Bitumen-shingle roof',
    ...(options.stones === false ? [] : ['Sauna stones - 20 kg (with stove only)']),
    `Stainless-steel hoops - ${options.hoops} pcs.`,
    `Feet for sauna - ${options.feet} pcs.`,
  ];
}

const assembledOrFlatPack = ['Assembled', 'Flat-pack'];
const electricOnly = ['Electric stove - sold separately'];
const electricOrWood = ['Wood-burning stove - sold separately', 'Electric stove - sold separately'];

function detail(
  modelCode: string,
  cataloguePage: number,
  slug: string,
  woodOptions: string[],
  heaterOptions: string[],
  deliveryOptions: string[],
  basicSet: string[],
  accessories: CatalogAccessoryGroup[],
): ViruCatalogDetails {
  return {
    modelCode,
    cataloguePage,
    specificationFile: `/docs/specifications/${slug}-specifications.pdf`,
    woodOptions,
    heaterOptions,
    deliveryOptions,
    basicSet,
    accessories,
  };
}

const cubeBasic = barrelBasicSet({ benches: 'Alder', hoops: 2, feet: 2 });
const ovalInterior = [
  { label: 'Interior', items: interior },
  { label: 'Exterior', items: ['Outdoor lamp'] },
];
const ovalBasic = [
  'Spruce or Thermowood shell',
  'Benches from Thermowood',
  'Inside brown tempered-glass door',
  'Outside wooden door with glass window and lock',
  'Bitumen-shingle roof',
  'Decorative wooden hoop at front and back',
  'Roof angle',
  'Window',
  'Sauna stones - 20 kg (with stove only)',
  'Stainless-steel hoops - 3 pcs.',
  'Feet for sauna - 6 pcs.',
];

/**
 * Exact option and inclusion data from the supplied VIRU sauna catalogue.
 * Public model names remain BUXENA names; supplier codes are shown only as
 * factual model identifiers in the technical section.
 */
export const viruCatalogDetails: Record<string, ViruCatalogDetails> = {
  'viru-s16-1-6m': detail(
    'S16', 8, 'viru-s16-1-6m',
    ['Spruce (S16E)', 'Thermowood (S16T)'], electricOnly, assembledOrFlatPack,
    barrelBasicSet({ hoops: 2, feet: 2 }), accessorySet('canopy', true),
  ),
  'viru-s2-2-0m': detail(
    'S2', 9, 'viru-s2-2-0m',
    ['Spruce (S2E)', 'Thermowood (S2T)'], electricOnly, assembledOrFlatPack,
    barrelBasicSet({ hoops: 2, feet: 2 }), accessorySet('canopy'),
  ),
  'viru-s23-2-3m': detail(
    'S23', 9, 'viru-s23-2-3m',
    ['Spruce (S23E)', 'Thermowood (S23T)'], electricOnly, assembledOrFlatPack,
    barrelBasicSet({ hoops: 2, feet: 2 }), accessorySet('canopy'),
  ),
  'viru-thermowood-2-4m': detail(
    'S2V', 10, 'viru-thermowood-2-4m',
    ['Spruce (S2VE)', 'Thermowood (S2VT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ stones: false, hoops: 3, feet: 2 }), accessorySet('hoop'),
  ),
  'viru-s28v-2-8m': detail(
    'S28V', 11, 'viru-s28v-2-8m',
    ['Spruce (S28VE)', 'Thermowood (S28VT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ benches: 'Alder', stones: false, hoops: 3, feet: 2 }), accessorySet('hoop'),
  ),
  'viru-s3-3-0m': detail(
    'S3', 12, 'viru-s3-3-0m',
    ['Spruce (S3E)', 'Thermowood (S3T)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ hoops: 3, feet: 3 }), accessorySet('canopy'),
  ),
  'viru-thermowood-3-0m': detail(
    'S3P', 13, 'viru-thermowood-3-0m',
    ['Spruce (S3PE)', 'Thermowood (S3PT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ glassDoor: 'Brown tempered-glass door in the steam room', woodenFrontDoor: true, hoops: 3, feet: 3 }),
    accessorySet('canopy'),
  ),
  'viru-thermowood-3-6m': detail(
    'S3V', 14, 'viru-thermowood-3-6m',
    ['Spruce (S3VE)', 'Thermowood (S3VT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ hoops: 4, feet: 3 }), accessorySet('hoop'),
  ),
  'viru-s4d-4-0m': detail(
    'S4D', 15, 'viru-s4d-4-0m',
    ['Spruce (S4DE)', 'Thermowood (S4DT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ woodenFrontDoor: true, hoops: 4, feet: 4 }), accessorySet('canopy'),
  ),
  'viru-s4pv-4-0m': detail(
    'S4PV', 16, 'viru-s4pv-4-0m',
    ['Spruce (S4PVE)', 'Thermowood (S4PVT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ glassDoor: 'Brown tempered-glass door in the steam room', woodenFrontDoor: true, hoops: 4, feet: 3 }),
    accessorySet('hoop'),
  ),
  'viru-thermowood-4-0m': detail(
    'S4P', 17, 'viru-thermowood-4-0m',
    ['Spruce (S4PE)', 'Thermowood (S4PT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ woodenFrontDoor: true, hoops: 4, feet: 4 }), accessorySet('canopy'),
  ),
  'viru-sqr17-1-7m': detail(
    'SQR17', 19, 'viru-sqr17-1-7m',
    ['Spruce (SQR17E)', 'Thermowood (SQR17T)'], electricOrWood, assembledOrFlatPack,
    cubeBasic, accessorySet('canopy', true),
  ),
  'viru-sqr2-2-0m': detail(
    'SQR2', 20, 'viru-sqr2-2-0m',
    ['Spruce (SQR2E)', 'Thermowood (SQR2T)'], electricOrWood, assembledOrFlatPack,
    cubeBasic, accessorySet('canopy'),
  ),
  'viru-sqr23-2-3m': detail(
    'SQR23', 20, 'viru-sqr23-2-3m',
    ['Spruce (SQR23E)', 'Thermowood (SQR23T)'], electricOrWood, assembledOrFlatPack,
    cubeBasic, accessorySet('canopy'),
  ),
  'viru-sqr2v-2-4m': detail(
    'SQR2V', 21, 'viru-sqr2v-2-4m',
    ['Spruce (SQR2VE)', 'Thermowood (SQR2VT)'], electricOrWood, assembledOrFlatPack,
    cubeBasic, accessorySet('hoop'),
  ),
  'viru-sqr3p-3-0m': detail(
    'SQR3P', 22, 'viru-sqr3p-3-0m',
    ['Spruce (SQR3PE)', 'Thermowood (SQR3PT)'], electricOrWood, assembledOrFlatPack,
    cubeBasic, accessorySet('canopy'),
  ),
  'viru-sqr3-3-0m': detail(
    'SQR3', 23, 'viru-sqr3-3-0m',
    ['Spruce (SQR3E)', 'Thermowood (SQR3T)'], electricOrWood, assembledOrFlatPack,
    cubeBasic, accessorySet('canopy'),
  ),
  'viru-sqr4pv-4-0m': detail(
    'SQR4PV', 24, 'viru-sqr4pv-4-0m',
    ['Spruce (SQR4PVE)', 'Thermowood (SQR4PVT)'], electricOrWood, assembledOrFlatPack,
    cubeBasic, accessorySet('hoop'),
  ),
  'viru-panorama-5-0m': detail(
    'S5P', 25, 'viru-panorama-5-0m',
    ['Spruce (S5PE)', 'Thermowood (S5PT)'], electricOrWood, assembledOrFlatPack,
    [
      'Spruce or Thermowood shell',
      'Sitting-room seats convert to a 210 x 180 cm bed',
      'Thermowood benches and floor',
      'Brown tempered-glass door in the steam room',
      'Wooden front door with lock',
      'Folding table - 180 x 60 cm',
      'Panoramic window in the sitting room',
      'Backrest - 2 pcs.',
      'Bitumen-shingle roof',
      'Sauna stones - 20 kg (with stove only)',
      'Stainless-steel hoops - 4 pcs.',
      'Feet for sauna - 4 pcs.',
    ],
    [
      {
        label: 'Sitting room',
        items: [
          'Openable or non-openable windows',
          'Half-panoramic window',
          'Half-panoramic window with mirror glass',
          'Outdoor LED light for half-panoramic window',
        ],
      },
      { label: 'Steam room', items: ['LED light for steam room', 'Steam-room lighting', 'Water tank - 24 L'] },
      { label: 'Exterior', items: ['Outdoor lamp'] },
    ],
  ),
  'viru-s242v-oval': detail(
    'S242V', 27, 'viru-s242v-oval',
    ['Spruce (S242VE)', 'Thermowood (S242VT)'], electricOrWood, ['Unassembled only'],
    [...ovalBasic, 'Available only unassembled'], ovalInterior,
  ),
  'viru-s242-oval': detail(
    'S242', 28, 'viru-s242-oval',
    ['Spruce (S242E)', 'Thermowood (S242T)'], electricOrWood, ['Unassembled only'],
    ovalBasic, ovalInterior,
  ),
  'viru-s54-big-oval': detail(
    'S54', 29, 'viru-s54-big-oval',
    ['Spruce (S54E)', 'Thermowood (S54T)'], electricOrWood, ['Unassembled only'],
    ovalBasic, ovalInterior,
  ),
  'viru-vertical-2-6m': detail(
    'SH', 30, 'viru-vertical-2-6m',
    ['Spruce (SHE)', 'Thermowood (SHT)'], electricOrWood, assembledOrFlatPack,
    barrelBasicSet({ hoops: 2, feet: 3 }),
    [
      { label: 'Front wall', items: ['Wooden door with window and lock', 'Openable or non-openable windows'] },
      { label: 'Interior', items: ['LED light for steam room', 'Steam-room lighting', 'Water tank - 24 L'] },
      { label: 'Exterior', items: ['Outdoor lamp'] },
    ],
  ),
};

export function viruDetailsFor(slug: string): ViruCatalogDetails | undefined {
  return viruCatalogDetails[slug];
}
