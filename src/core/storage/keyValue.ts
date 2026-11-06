// Copied from math-tank src/core/storage/keyValue.ts.
/** Minimal key-value store: the localStorage adapter in the app, in-memory in tests. */
export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  /** Deletes the key; an import or transfer that fails puts back a key that was missing before. */
  remove(key: string): void;
}

/**
 * localStorage adapter. Accessing `localStorage` itself can throw (Safari private mode,
 * blocked site data), so the lookup happens inside each call; storage.ts catches the error.
 */
export function localStorageKeyValue(): KeyValue {
  const store = (): Storage => {
    let ls: Storage | undefined;
    try {
      ls = globalThis.localStorage;
    } catch (e) {
      throw new Error('localStorage is blocked', { cause: e });
    }
    if (!ls) throw new Error('localStorage is not available');
    return ls;
  };
  return {
    get: (key) => store().getItem(key),
    set: (key, value) => store().setItem(key, value),
    remove: (key) => store().removeItem(key),
  };
}

export function memoryKeyValue(initial: Record<string, string> = {}): KeyValue {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}
