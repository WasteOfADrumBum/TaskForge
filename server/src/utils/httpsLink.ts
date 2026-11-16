// Only https links without credentials are kept; TaskForge never fetches them. Returns the
// normalized link ('' clears it), or which rule it broke so callers can word their own message.
export const readHttpsLink = (
  value: unknown,
  max: number,
): { value: string } | { error: 'invalid' | 'not-https' } => {
  if (value === '' || value === null) return { value: '' };
  if (typeof value !== 'string' || value.length > max) return { error: 'invalid' };
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return { error: 'not-https' };
    const normalized = url.toString();
    // Normalizing can lengthen a link (percent-encoding), so check the stored form too.
    if (normalized.length > max) return { error: 'invalid' };
    return { value: normalized };
  } catch {
    return { error: 'invalid' };
  }
};
