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
        options: [{ value: 'verified', label: 'Verified heater', sku: 'HEAT-01' }],
      },
      {
        key: 'orientation',
        label: 'Door orientation',
        stage: 'room' as const,
        options: [
          { value: 'right', label: 'Right-hand' },
          { value: 'left', label: 'Left-hand' },
        ],
      },
    ],
  };
  const groups = buildConfigGroups(model);
  assert.equal(groups.filter((group) => group.key === 'heater').length, 1);
  assert.equal(groups.find((group) => group.key === 'heater')?.options[0]?.label, 'Verified heater');
  assert.ok(groups.some((group) => group.key === 'supply'));
});

test('selection summary can retain supplier SKU for internal quote follow-up', () => {
  const groups = buildConfigGroups({
    title: 'SKU model',
    configurationGroups: [
      {
        key: 'door',
        label: 'Door',
        stage: 'room',
        options: [{ value: 'bronze', label: 'Bronze glass', sku: 'DOOR-BR' }],
      },
    ],
  });
  assert.deepEqual(summariseSelections(groups, { door: 'bronze' }), ['Door: Bronze glass [DOOR-BR]']);
});
