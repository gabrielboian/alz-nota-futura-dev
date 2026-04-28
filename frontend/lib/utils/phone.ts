/**
 * Phone number utilities for Brazilian mobile phones.
 *
 * Storage format : 55DDDXXXXXXXXX  (13 raw digits)
 * Display format : (DDD) XXXXX-XXXX
 */

/** Apply live mask to raw input value → returns formatted display string */
export function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  let out = `(${digits.slice(0, 2)}`;
  if (digits.length > 2) {
    out += `) ${digits.slice(2, 7)}`;
    if (digits.length > 7) {
      out += `-${digits.slice(7, 11)}`;
    }
  }
  return out;
}

/** Strip formatting and prepend 55 for API submission.
 *  Accepts display-formatted or raw 11-digit strings.
 *  Returns 13-digit string: 55 + DDD + 9 digits.
 */
export function normalizePhoneForApi(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 13 && digits.startsWith('55')) return digits;
  return digits; // let the backend validate and reject if wrong
}

/** Validate that the display-formatted value represents a full 11-digit mobile number. */
export function isPhoneValid(value: string): boolean {
  return value.replace(/\D/g, '').length === 11;
}
