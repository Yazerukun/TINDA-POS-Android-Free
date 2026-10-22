import 'fake-indexeddb/auto'

if (typeof globalThis.window === 'undefined') {
  const store = new Map<string, string>()
  const mockLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    }
  }
  // @ts-expect-error mock window in test
  globalThis.window = {
    localStorage: mockLocalStorage
  }
  // @ts-expect-error mock localStorage in test
  globalThis.localStorage = mockLocalStorage
}
