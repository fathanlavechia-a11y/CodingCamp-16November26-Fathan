class LocalStorageShim {
  constructor() {
    this.store = new Map();
  }

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageShim(),
    configurable: true,
    writable: true,
  });
}
