// @ts-ignore — qrcode ships no bundled TypeScript types
import QRCode from 'qrcode';

/**
 * QR generation for physical inventory units. The QR payload is a
 * future-safe public URL built from the unit's public_token — never its
 * unit_code, never the raw Supabase id, never any cost/customer/internal
 * data. The /unit/[token] destination isn't built yet (explicitly deferred),
 * but the QR content is stable now: once that page ships, every label
 * already printed keeps working without reprinting anything.
 */
export function unitPublicUrl(publicToken: string): string {
  return `https://buxena.com/unit/${publicToken}`;
}

/** High-contrast black/white only — deliberately not on-brand gold, for scan reliability on office/thermal printers. */
export async function generateUnitQrDataUrl(publicToken: string): Promise<string> {
  return QRCode.toDataURL(unitPublicUrl(publicToken), {
    color: { dark: '#000000', light: '#FFFFFF' },
    margin: 1,
    width: 300,
    errorCorrectionLevel: 'M',
  });
}
