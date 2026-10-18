const PT_NATIONAL = /^[29]\d{8}$/;
const PT_COUNTRY_PREFIX = /^351[29]\d{8}$/;
const INTERNATIONAL_00 = /^00[1-9]\d{7,14}$/;
const INTERNATIONAL_PLUS = /^\+[1-9]\d{7,14}$/;

/** Normalize phone numbers for voice gateway lookup.
 *  Reject withheld, malformed and unknown caller IDs — never guess an identity.
 */
export function normalizeInovitoPhone(value: string): string | null {
  if (value.length > 40) {
    return null;
  }
  const compact = value.replace(/[\s().-]/g, "");

  // Portugal: mobile / geographic 9-digit national format.
  if (PT_NATIONAL.test(compact)) {
    return `+351${compact}`;
  }
  if (PT_COUNTRY_PREFIX.test(compact)) {
    return `+${compact}`;
  }
  if (INTERNATIONAL_00.test(compact)) {
    return `+${compact.slice(2)}`;
  }
  if (INTERNATIONAL_PLUS.test(compact)) {
    return compact;
  }
  return null;
}
