/** Normalize phone numbers for voice gateway lookup.
 *  Reject withheld, malformed and unknown caller IDs — never guess an identity.
 */
export function normalizeInovitoPhone(value: string): string | null {
  if (value.length > 40) {
    return null;
  }
  const compact = value.replace(/[\s().-]/g, "");

  // Portugal: mobile / geographic 9-digit national format.
  if (/^[29]\d{8}$/.test(compact)) {
    return `+351${compact}`;
  }
  if (/^351[29]\d{8}$/.test(compact)) {
    return `+${compact}`;
  }
  if (/^00[1-9]\d{7,14}$/.test(compact)) {
    return `+${compact.slice(2)}`;
  }
  if (/^\+[1-9]\d{7,14}$/.test(compact)) {
    return compact;
  }
  return null;
}
