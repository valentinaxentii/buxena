import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { ACTIVE_SHIPMENT_STATUSES } from './shipment-statuses';
import { getSettings } from './settings';

/**
 * Unit-level inventory: one row per physical sauna (products.unit_tracked
 * products only). See supabase/schema.sql for the `inventory_units` table
 * and the `issue_inventory_unit` counter function this wraps.
 *
 * Status lifecycle: EXPECTED -> RECEIVED -> IN_STOCK (good units only, a
 * separate accept step) | DAMAGED | HOLD (terminal until manually resolved).
 * RECEIVED/DAMAGED/HOLD are deliberately never counted as `inventory.in_stock`
 * — only IN_STOCK is sellable. `inventory.incoming` counts EXPECTED only.
 * These two aggregate fields are the ONLY place unit-tracked products write
 * stock numbers; nothing else may increment them for such a product (see
 * recomputeIncomingForProduct in shipment-inventory.ts, which delegates here).
 */

export function generatePublicToken(): string {
  return crypto.randomBytes(9).toString('base64url');
}

/**
 * Idempotent: creates EXPECTED units only for the gap between
 * `shipment_items.quantity` and units already generated for that line, so
 * calling this repeatedly (place_order, a later status advance, an edited
 * quantity) never over-creates. Only touches unit_tracked products — every
 * other shipment_item is silently skipped, unaffected.
 */
export async function ensureExpectedUnitsForShipment(supabase: SupabaseClient, shipmentId: string) {
  // Self-guarding, not just call-site discipline: a shipment still in Draft
  // (or Cancelled) is not real incoming stock — matches the same status set
  // recomputeIncomingForProduct already uses for non-unit-tracked products,
  // so both paths agree on what counts as "actually ordered."
  const { data: shipment } = await supabase.from('shipments').select('status').eq('id', shipmentId).maybeSingle();
  if (!shipment || !ACTIVE_SHIPMENT_STATUSES.includes(shipment.status)) return;

  const { data: items } = await supabase
    .from('shipment_items')
    .select('id, product_id, quantity, unit_cost, products(unit_tracked)')
    .eq('shipment_id', shipmentId);

  for (const item of items ?? []) {
    const product = (item as any).products;
    if (!product?.unit_tracked) continue;

    const { count: existing } = await supabase
      .from('inventory_units')
      .select('id', { count: 'exact', head: true })
      .eq('shipment_item_id', item.id);

    const toCreate = Math.max(0, (item.quantity ?? 0) - (existing ?? 0));
    for (let i = 0; i < toCreate; i++) {
      await supabase.rpc('issue_inventory_unit', {
        p_product_id: item.product_id,
        p_shipment_id: shipmentId,
        p_shipment_item_id: item.id,
        p_unit_cost: item.unit_cost ?? null,
        p_public_token: generatePublicToken(),
      });
    }
    if (toCreate > 0) await recomputeInventoryFromUnits(supabase, item.product_id);
  }
}

/** The single authoritative write path for a unit-tracked product's stock numbers. */
export async function recomputeInventoryFromUnits(supabase: SupabaseClient, productId: string) {
  const [{ count: inStock }, { count: incoming }] = await Promise.all([
    supabase.from('inventory_units').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'IN_STOCK'),
    supabase.from('inventory_units').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'EXPECTED'),
  ]);

  const { data: invRows } = await supabase.from('inventory').select('id').eq('product_id', productId).limit(1);
  if (invRows && invRows.length > 0) {
    await supabase.from('inventory').update({ in_stock: inStock ?? 0, incoming: incoming ?? 0 }).eq('id', invRows[0].id);
  } else {
    await supabase.from('inventory').insert({ product_id: productId, in_stock: inStock ?? 0, incoming: incoming ?? 0 });
  }
}

export type ScanResult =
  | { ok: true; unitCode: string; modelName: string; status: string }
  | { ok: false; reason: 'UNIT_NOT_FOUND' }
  | { ok: false; reason: 'WRONG_SHIPMENT'; actualShipmentNumber: string | null }
  | { ok: false; reason: 'ALREADY_RECEIVED'; receivedAt: string | null; status: string };

/**
 * Scans one unit into the shipment. Idempotent by construction: a unit can
 * only leave EXPECTED once (guarded by the .eq('status','EXPECTED') on the
 * update — a concurrent/duplicate scan updates zero rows, not two).
 */
export async function receiveUnitByCode(
  supabase: SupabaseClient,
  params: { shipmentId: string; unitCode: string; condition: 'good' | 'damaged' | 'hold'; warehouse?: string; zone?: string; bay?: string; staffId?: string | null }
): Promise<ScanResult> {
  const code = params.unitCode.trim();
  const { data: unit } = await supabase
    .from('inventory_units')
    .select('id, status, shipment_id, shipment_item_id, product_id, received_at, products(model_name), shipments(shipment_number)')
    .eq('unit_code', code)
    .maybeSingle();

  if (!unit) return { ok: false, reason: 'UNIT_NOT_FOUND' };

  if (unit.shipment_id !== params.shipmentId) {
    return { ok: false, reason: 'WRONG_SHIPMENT', actualShipmentNumber: (unit as any).shipments?.shipment_number ?? null };
  }

  if (unit.status !== 'EXPECTED') {
    return { ok: false, reason: 'ALREADY_RECEIVED', receivedAt: unit.received_at, status: unit.status };
  }

  const nextStatus = params.condition === 'good' ? 'RECEIVED' : params.condition === 'damaged' ? 'DAMAGED' : 'HOLD';
  const nowIso = new Date().toISOString();

  const { data: updated } = await supabase
    .from('inventory_units')
    .update({
      status: nextStatus,
      condition: params.condition,
      received_at: nowIso,
      warehouse: params.warehouse || null,
      zone: params.zone || null,
      bay: params.bay || null,
    })
    .eq('id', unit.id)
    .eq('status', 'EXPECTED') // re-guard against a race between the read above and this write
    .select('id')
    .maybeSingle();

  if (!updated) return { ok: false, reason: 'ALREADY_RECEIVED', receivedAt: unit.received_at, status: unit.status };

  // shipment_items.quantity_received reflects physical arrival, independent
  // of condition — a damaged unit still arrived, it just isn't sellable.
  const shipmentItemId = (unit as any).shipment_item_id as string | null;
  if (shipmentItemId) {
    const { data: si } = await supabase.from('shipment_items').select('quantity_received').eq('id', shipmentItemId).single();
    await supabase
      .from('shipment_items')
      .update({ quantity_received: (si?.quantity_received ?? 0) + 1 })
      .eq('id', shipmentItemId);
  }

  await recomputeInventoryFromUnits(supabase, unit.product_id);

  await supabase.from('activities').insert({
    entity_type: 'inventory_unit',
    entity_id: unit.id,
    activity_type: 'status_change',
    description: `Received — condition: ${params.condition}${params.warehouse ? ` — ${[params.warehouse, params.zone, params.bay].filter(Boolean).join(' / ')}` : ''}`,
    staff_id: params.staffId ?? null,
  });

  return { ok: true, unitCode: code, modelName: (unit as any).products?.model_name ?? 'Unknown model', status: nextStatus };
}

/** RECEIVED (good condition) -> IN_STOCK. The separate "accept" event decision 1 requires. */
export async function acceptUnitIntoStock(supabase: SupabaseClient, unitId: string, staffId?: string | null) {
  const { data: unit } = await supabase.from('inventory_units').select('id, status, product_id').eq('id', unitId).single();
  if (!unit || unit.status !== 'RECEIVED') return { ok: false as const, reason: 'NOT_RECEIVED' as const };

  await supabase
    .from('inventory_units')
    .update({ status: 'IN_STOCK', accepted_at: new Date().toISOString() })
    .eq('id', unitId)
    .eq('status', 'RECEIVED');

  await recomputeInventoryFromUnits(supabase, unit.product_id);

  await supabase.from('activities').insert({
    entity_type: 'inventory_unit',
    entity_id: unitId,
    activity_type: 'status_change',
    description: 'Accepted into stock',
    staff_id: staffId ?? null,
  });

  return { ok: true as const };
}

/**
 * IN_STOCK -> RESERVED, atomically. A single UPDATE ... WHERE status =
 * 'IN_STOCK' is already atomic in Postgres (row-locked and serialized by the
 * database itself) — the exact same guarantee receiveUnitByCode/
 * acceptUnitIntoStock already rely on via .eq('status', ...). Two concurrent
 * assignment attempts against the same unit can never both succeed: whichever
 * commits first changes the status away from IN_STOCK, so the second matches
 * zero rows and fails cleanly rather than racing.
 */
export async function assignUnitToOrder(supabase: SupabaseClient, unitId: string, orderId: string, staffId?: string | null) {
  const { data: unit } = await supabase.from('inventory_units').select('id, status, product_id').eq('id', unitId).maybeSingle();
  if (!unit) return { ok: false as const, reason: 'NOT_FOUND' as const };

  const { data: updated } = await supabase
    .from('inventory_units')
    .update({ status: 'RESERVED', order_id: orderId })
    .eq('id', unitId)
    .eq('status', 'IN_STOCK')
    .select('id')
    .maybeSingle();

  if (!updated) return { ok: false as const, reason: 'NOT_AVAILABLE' as const, currentStatus: unit.status };

  await recomputeInventoryFromUnits(supabase, unit.product_id);

  await supabase.from('activities').insert({
    entity_type: 'inventory_unit',
    entity_id: unitId,
    activity_type: 'status_change',
    description: `Assigned to order`,
    staff_id: staffId ?? null,
  });

  return { ok: true as const };
}

/**
 * RESERVED -> IN_STOCK, atomically. Only reverses a reservation — SOLD and
 * DELIVERED units are never touched by this (the .eq('status','RESERVED')
 * guard makes that structurally impossible, not just a convention).
 */
export async function unassignUnitFromOrder(supabase: SupabaseClient, unitId: string, staffId?: string | null) {
  const { data: unit } = await supabase.from('inventory_units').select('id, status, product_id').eq('id', unitId).maybeSingle();
  if (!unit) return { ok: false as const, reason: 'NOT_FOUND' as const };

  const { data: updated } = await supabase
    .from('inventory_units')
    .update({ status: 'IN_STOCK', order_id: null })
    .eq('id', unitId)
    .eq('status', 'RESERVED')
    .select('id')
    .maybeSingle();

  if (!updated) return { ok: false as const, reason: 'NOT_RESERVED' as const, currentStatus: unit.status };

  await recomputeInventoryFromUnits(supabase, unit.product_id);

  await supabase.from('activities').insert({
    entity_type: 'inventory_unit',
    entity_id: unitId,
    activity_type: 'status_change',
    description: 'Unassigned from order — returned to stock',
    staff_id: staffId ?? null,
  });

  return { ok: true as const };
}

/**
 * IN_STOCK or RECEIVED -> DAMAGED/HOLD, atomically. A unit already RESERVED,
 * SOLD, or DELIVERED can't be pulled back into this by construction — the
 * .in('status', [...]) guard on the write only matches the two pre-sale
 * states this action is meant for.
 */
export async function markUnitCondition(supabase: SupabaseClient, unitId: string, condition: 'damaged' | 'hold', staffId?: string | null) {
  const { data: unit } = await supabase.from('inventory_units').select('id, status, product_id').eq('id', unitId).maybeSingle();
  if (!unit) return { ok: false as const, reason: 'NOT_FOUND' as const };

  const nextStatus = condition === 'damaged' ? 'DAMAGED' : 'HOLD';
  const { data: updated } = await supabase
    .from('inventory_units')
    .update({ status: nextStatus, condition })
    .eq('id', unitId)
    .in('status', ['IN_STOCK', 'RECEIVED'])
    .select('id')
    .maybeSingle();

  if (!updated) return { ok: false as const, reason: 'NOT_ELIGIBLE' as const, currentStatus: unit.status };

  await recomputeInventoryFromUnits(supabase, unit.product_id);

  await supabase.from('activities').insert({
    entity_type: 'inventory_unit',
    entity_id: unitId,
    activity_type: 'status_change',
    description: `Marked ${nextStatus}`,
    staff_id: staffId ?? null,
  });

  return { ok: true as const };
}

/**
 * Controlled list for `inventory_units.delivery_condition`. The column
 * itself has no DB check constraint (unlike installation_type), so this is
 * enforced at the application layer only — adding a constraint is a schema
 * change and wasn't approved for this stage. Any value outside this list is
 * silently dropped to null by the caller rather than written raw.
 */
export const DELIVERY_CONDITIONS = ['Good', 'Minor Damage', 'Damaged', 'Customer Accepted With Notes'] as const;
export type DeliveryCondition = (typeof DELIVERY_CONDITIONS)[number];

export interface DeliveryInput {
  deliveryDate: string | null;
  deliveredBy: string | null;
  condition: string | null;
  acknowledged: boolean;
  notes: string | null;
}

/**
 * RESERVED -> DELIVERED, atomically — same `.eq('status', ...)` guard
 * pattern as assignUnitToOrder/markUnitCondition above. A unit can only be
 * delivered while explicitly reserved to an order: RESERVED implies
 * order_id is set by construction (assignUnitToOrder always sets both
 * together, unassignUnitFromOrder always clears both together), so no
 * separate order check is needed here — the status guard already enforces it.
 */
export async function recordUnitDelivery(supabase: SupabaseClient, unitId: string, input: DeliveryInput, staffId?: string | null) {
  const { data: unit } = await supabase.from('inventory_units').select('id, status, order_id, product_id').eq('id', unitId).maybeSingle();
  if (!unit) return { ok: false as const, reason: 'NOT_FOUND' as const };

  const { data: updated } = await supabase
    .from('inventory_units')
    .update({
      status: 'DELIVERED',
      delivery_date: input.deliveryDate,
      delivered_by: input.deliveredBy,
      delivery_condition: input.condition,
      customer_acknowledged_at: input.acknowledged ? new Date().toISOString() : null,
      delivery_notes: input.notes,
    })
    .eq('id', unitId)
    .eq('status', 'RESERVED')
    .select('id')
    .maybeSingle();

  if (!updated) return { ok: false as const, reason: 'NOT_RESERVED' as const, currentStatus: unit.status };

  let orderNumber: string | null = null;
  if (unit.order_id) {
    const { data: order } = await supabase.from('orders').select('order_number').eq('id', unit.order_id).maybeSingle();
    orderNumber = order?.order_number ?? null;
  }

  const parts = ['Delivered'];
  if (orderNumber) parts.push(`— Order ${orderNumber}`);
  if (input.deliveredBy) parts.push(`— by ${input.deliveredBy}`);

  await supabase.from('activities').insert({
    entity_type: 'inventory_unit',
    entity_id: unitId,
    activity_type: 'status_change',
    description: parts.join(' '),
    staff_id: staffId ?? null,
  });

  await activateWarrantyOnDelivery(supabase, unitId, unit.order_id, unit.product_id, input.deliveryDate);

  return { ok: true as const };
}

/**
 * Edits already-recorded delivery details without touching status — for a
 * unit that is already DELIVERED (correcting a date, adding notes after the
 * fact, etc). Deliberately refuses to run on any other status: use
 * recordUnitDelivery for the RESERVED -> DELIVERED transition itself.
 */
export async function updateUnitDeliveryDetails(supabase: SupabaseClient, unitId: string, input: DeliveryInput, staffId?: string | null) {
  const { data: unit } = await supabase.from('inventory_units').select('id, status, customer_acknowledged_at').eq('id', unitId).maybeSingle();
  if (!unit) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (unit.status !== 'DELIVERED') return { ok: false as const, reason: 'NOT_DELIVERED' as const, currentStatus: unit.status };

  // Preserve the original acknowledgement timestamp if it was already set —
  // unchecking then rechecking the box in an edit shouldn't reset "when did
  // the customer first acknowledge" to right now.
  const ackTimestamp = input.acknowledged ? (unit.customer_acknowledged_at ?? new Date().toISOString()) : null;

  await supabase
    .from('inventory_units')
    .update({
      delivery_date: input.deliveryDate,
      delivered_by: input.deliveredBy,
      delivery_condition: input.condition,
      customer_acknowledged_at: ackTimestamp,
      delivery_notes: input.notes,
    })
    .eq('id', unitId);

  await supabase.from('activities').insert({
    entity_type: 'inventory_unit',
    entity_id: unitId,
    activity_type: 'note',
    description: 'Delivery details updated',
    staff_id: staffId ?? null,
  });

  return { ok: true as const };
}

/**
 * Adds `months` to a plain YYYY-MM-DD date, clamping to the last valid day
 * of the target month (e.g. Jan 31 + 1 month -> Feb 28/29, never rolling
 * into March). Works entirely on the y/m/d integers rather than the JS
 * `Date` object's local-timezone arithmetic, so it can't suffer the same
 * UTC-vs-local rollback bug fixed in the admin/customer date formatters.
 */
function addMonthsClamped(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const totalMonths = m - 1 + months;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12; // 0-indexed, always positive
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(d, lastDayOfTargetMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

/**
 * Shared warranty-activation core, used by both the delivery and
 * installation trigger points so there is exactly one place that resolves
 * duration and freezes it — not two copies to keep in sync.
 *
 * Establishes the warranty start date and end date on the given `source`
 * event, per settings.warranty_start_source. Duration resolution:
 * product.warranty_duration_months ?? settings.default_warranty_months
 * (BUXENA's 24-month standard) — never guessed beyond what's actually
 * configured in Settings/Products.
 *
 * The resolved duration is frozen into warranties.duration_months_applied
 * at the exact moment of activation and never recomputed: changing the
 * default or a product's override afterward only affects warranties
 * activated from that point on, never one already recorded. This function
 * refuses to touch a warranty that already has a warranty_start_date (a
 * real, previously recorded value always wins, regardless of which source
 * — delivery or installation — originally set it, and by the same rule its
 * duration/end date are equally frozen). unique(unit_id) on `warranties`
 * already guarantees one warranty per unit at the DB level; this function
 * respects that by updating in place rather than ever inserting a second row.
 */
async function activateWarranty(
  supabase: SupabaseClient,
  unitId: string,
  orderId: string | null,
  productId: string,
  startDate: string | null,
  source: 'delivery_date' | 'installation_date'
) {
  if (!startDate) return;

  const settings = await getSettings(supabase);
  if (settings.warranty_start_source !== source) return;

  const { data: existing } = await supabase.from('warranties').select('id, warranty_start_date, status').eq('unit_id', unitId).maybeSingle();
  if (existing?.warranty_start_date) return; // already activated — frozen, never re-touched

  const { data: product } = await supabase.from('products').select('warranty_duration_months').eq('id', productId).maybeSingle();
  const durationMonths = product?.warranty_duration_months ?? settings.default_warranty_months;
  const warrantyEndDate = addMonthsClamped(startDate, durationMonths);

  let customerId: string | null = null;
  if (orderId) {
    const { data: order } = await supabase.from('orders').select('customer_id').eq('id', orderId).maybeSingle();
    customerId = order?.customer_id ?? null;
  }

  if (!existing) {
    await supabase.from('warranties').insert({
      unit_id: unitId,
      customer_id: customerId,
      order_id: orderId,
      warranty_start_date: startDate,
      warranty_end_date: warrantyEndDate,
      duration_months_applied: durationMonths,
      status: 'ACTIVE',
    });
  } else {
    await supabase
      .from('warranties')
      .update({
        warranty_start_date: startDate,
        warranty_end_date: warrantyEndDate,
        duration_months_applied: durationMonths,
        status: existing.status === 'NOT_REGISTERED' ? 'ACTIVE' : existing.status,
      })
      .eq('id', existing.id);
  }
}

function activateWarrantyOnDelivery(supabase: SupabaseClient, unitId: string, orderId: string | null, productId: string, deliveryDate: string | null) {
  return activateWarranty(supabase, unitId, orderId, productId, deliveryDate, 'delivery_date');
}

function activateWarrantyOnInstallation(supabase: SupabaseClient, unitId: string, orderId: string | null, productId: string, installationDate: string | null) {
  return activateWarranty(supabase, unitId, orderId, productId, installationDate, 'installation_date');
}

/**
 * Controlled list for `inventory_units.installation_status` — free text in
 * the DB (no check constraint, same "app-validated" convention already used
 * for delivery_condition), validated here instead. Only COMPLETED
 * represents a finished installation; it is never inferred merely from
 * installation_date having a value — the workflow has to actually reach
 * this status.
 */
export const INSTALLATION_STATUSES = ['NOT_SCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

const INSTALLATION_STATUS_LABELS: Record<string, string> = {
  NOT_SCHEDULED: 'Not Scheduled',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export interface InstallationInput {
  installationType: string | null;
  installationStatus: InstallationStatus;
  installationDate: string | null;
  installerCompany: string | null;
  electricianName: string | null;
  notes: string | null;
}

/**
 * Updates a unit's installation record. Deliberately not status-guarded the
 * way delivery is — installation has no scarce resource to race over, just
 * staff-entered descriptive fields plus one real side effect (warranty
 * activation), and that side effect already has its own independent
 * freeze-guard in activateWarranty. The one precondition enforced here is
 * that the physical unit must actually have been DELIVERED — a sauna can't
 * be installed before it arrives.
 *
 * Per the approved design, installation_date means the ACTUAL completed
 * date (not a scheduled/planned date — that's explicitly deferred to a
 * future column), so warranty activation only fires when the submitted
 * status is COMPLETED and a date is present.
 *
 * Activity logging is limited to real status transitions (comparing against
 * the unit's previous installation_status, treating null as NOT_SCHEDULED
 * so the very first save of the default value doesn't log a no-op entry) —
 * editing notes/installer/electrician without changing status logs nothing,
 * per "avoid noisy entries for trivial edits."
 */
export async function recordInstallationUpdate(supabase: SupabaseClient, unitId: string, input: InstallationInput, staffId?: string | null) {
  const { data: unit } = await supabase
    .from('inventory_units')
    .select('id, status, order_id, product_id, installation_status')
    .eq('id', unitId)
    .maybeSingle();
  if (!unit) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (unit.status !== 'DELIVERED') return { ok: false as const, reason: 'NOT_DELIVERED' as const, currentStatus: unit.status };

  await supabase
    .from('inventory_units')
    .update({
      installation_type: input.installationType,
      installation_status: input.installationStatus,
      installation_date: input.installationDate,
      installer_company: input.installerCompany,
      electrician_name: input.electricianName,
      installation_notes: input.notes,
    })
    .eq('id', unitId);

  const prevNormalized = unit.installation_status ?? 'NOT_SCHEDULED';
  if (prevNormalized !== input.installationStatus) {
    let orderNumber: string | null = null;
    if (unit.order_id) {
      const { data: order } = await supabase.from('orders').select('order_number').eq('id', unit.order_id).maybeSingle();
      orderNumber = order?.order_number ?? null;
    }

    let description: string;
    if (input.installationStatus === 'COMPLETED') {
      const parts = ['Installation completed'];
      if (input.installationType) parts.push(`— ${input.installationType}`);
      if (orderNumber) parts.push(`— Order ${orderNumber}`);
      if (input.installerCompany) parts.push(`— by ${input.installerCompany}`);
      description = parts.join(' ');
    } else {
      description = `Installation status: ${INSTALLATION_STATUS_LABELS[prevNormalized] ?? prevNormalized} → ${INSTALLATION_STATUS_LABELS[input.installationStatus] ?? input.installationStatus}`;
    }

    await supabase.from('activities').insert({
      entity_type: 'inventory_unit',
      entity_id: unitId,
      activity_type: 'status_change',
      description,
      staff_id: staffId ?? null,
    });
  }

  if (input.installationStatus === 'COMPLETED' && input.installationDate) {
    await activateWarrantyOnInstallation(supabase, unitId, unit.order_id, unit.product_id, input.installationDate);
  }

  return { ok: true as const };
}
