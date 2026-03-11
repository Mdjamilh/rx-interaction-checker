const KEY = "rx-check:recent";
const MAX = 5;

/** Lists checked on this device, newest first. Only drug names are kept, and only locally. */
export function recentLists(): string[][] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((l): l is string[] => Array.isArray(l) && l.every((n) => typeof n === "string")) : [];
  } catch {
    return [];
  }
}

export function rememberList(names: string[]): string[][] {
  const key = (l: string[]) => [...l].map((n) => n.toLowerCase()).sort().join("|");
  const next = [names, ...recentLists().filter((l) => key(l) !== key(names))].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the feature just doesn't persist.
  }
  return next;
}

export function forgetLists(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
