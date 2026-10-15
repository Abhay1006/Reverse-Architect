/**
 * Normalize a member name so naming conventions compare equal:
 * `getInstance`, `get_instance` and `GetInstance` all become `getinstance`.
 */
export function normName(name: string): string {
  return name.replace(/_/g, '').toLowerCase();
}

/**
 * True if `name` is `prefix` followed by a further word, in camelCase
 * (`withUrl`) or snake_case (`with_url`) — so `settle` does not match `set`.
 */
export function hasWordPrefix(name: string, prefix: string): boolean {
  if (!name.toLowerCase().startsWith(prefix)) return false;
  const rest = name.slice(prefix.length);
  return /^[A-Z]/.test(rest) || /^_[a-z]/i.test(rest);
}
