export function parseRupeesToPaise(value) {
  if (typeof value !== 'string') return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const rupees = BigInt(match[1]);
  const paise = BigInt((match[2] || '').padEnd(2, '0') || '0');
  const total = rupees * 100n + paise;
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
