// Statuses that count toward "incoming" — Draft never does (a PO that isn't
// placed yet isn't real incoming stock), Cancelled/Received are resolved.
// Shared by shipment-inventory.ts (quantity-based incoming) and
// inventory-units.ts (unit-based incoming) so both agree on what "actually
// ordered" means — kept in its own module so neither has to import the other.
export const ACTIVE_SHIPMENT_STATUSES = [
  'Ordered', 'In Production', 'Ready to Ship', 'In Transit', 'Arrived', 'Partially Received',
];
