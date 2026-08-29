import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConfigGroups,
  configStages,
  shouldShowConfigurator,
  summariseSelections,
} from '../src/lib/product-config';

test('V2 model fields still build a V3 staged configurator', () => {
  const model = {
    title: 'Legacy model',
    options: ['Flat pack', 'Assembled'],
    materials: ['Cedar', 'Aspen'],
    heaterOptions: ['Electric: HUUM'],
  };
  const groups = buildConfigGroups(model);
  assert.deepEqual(groups.map((group) => group.key), ['supply', 'heater', 'material']);
  assert.deepEqual(configStages(groups).map((stage) => stage.key), ['room', 'heat']);
  assert.equal(shouldShowConfigurator(model), true);
});

test('structured V3 groups win over legacy groups with the same key', () => {
  const model = {
    title: 'Structured model',
    options: ['Legacy flat pack'],
    heaterOptions: ['Electric: Legacy heater'],
    configurationGroups: [
      {
        key: 'heater',
        label: 'Heater package',
        stage: 'heat' as const,
        options: [{ value: 'verified', label: 'Verified heater' }],
      },
      {
        key: 'orientation',
        label: 'Layout orientation',
        stage: 'room' as const,
        options: [
          { value: 'right', label: 'Right-side' },
          { value: 'left', label: 'Left-side' },
        ],
      },
    ],
  };
  const groups = buildConfigGroups(model);
  assert.equal(groups.filter((group) => group.key === 'heater').length, 1);
  assert.equal(groups.find((group) => group.key === 'heater')?.options[0]?.label, 'Verified heater');
  assert.ok(groups.some((group) => group.key === 'supply'));
});

test('SAWO staged rooms receive verified public configuration without supplier cost or SKU data', () => {
  const groups = buildConfigGroups({
    title: 'SAWO 1414 Glass Front Sauna Room',
    materials: ['Cedar', 'Aspen', 'Hemlock', 'Heat treated'],
  });
  assert.deepEqual(groups.map((group) => group.key), ['layout-orientation', 'material', 'accessory-package']);
  assert.equal(groups.find((group) => group.key === 'layout-orientation')?.options.length, 2);
  assert.equal(groups.find((group) => group.key === 'accessory-package')?.options.length, 5);
  assert.equal(JSON.stringify(groups).includes('unit_cost'), false);
  assert.equal(JSON.stringify(groups).includes('supplier_sku'), false);
  assert.equal(shouldShowConfigurator({ title: 'SAWO 1414 Glass Front Sauna Room' }), true);
});

test('selection summaries carry customer labels only', () => {
  const groups = buildConfigGroups({ title: 'SAWO 1414 Glass Front Sauna Room' });
  assert.deepEqual(
    summariseSelections(groups, { 'layout-orientation': 'right-side', 'accessory-package': 'traditional' }),
    ['Layout orientation: Right-side layout', 'Accessory package: Traditional accessory set'],
  );
});
