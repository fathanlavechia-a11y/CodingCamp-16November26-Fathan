// @vitest-environment jsdom
/**
 * Property-based test: Task persistence round-trip
 *
 * Property 5: Task persistence round-trip
 * Validates: Requirements 4.2, 4.8, 4.11, 8.3
 *
 * For any array of Task objects saved via StorageService.set("dashboard_tasks", tasks),
 * reading back via StorageService.get("dashboard_tasks") returns a structurally
 * equivalent array (same ids, labels, completed states, createdAt values).
 *
 * Feature: personal-dashboard, Property 5: task persistence round-trip
 */

import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Minimal localStorage shim — used when the jsdom environment is unavailable
// (e.g. Node 26 with experimental localStorage stub that is not fully usable).
// ---------------------------------------------------------------------------
class LocalStorageShim {
  constructor() {
    this._store = new Map();
  }
  getItem(key) {
    return this._store.has(key) ? this._store.get(key) : null;
  }
  setItem(key, value) {
    this._store.set(key, String(value));
  }
  removeItem(key) {
    this._store.delete(key);
  }
  clear() {
    this._store.clear();
  }
  get length() {
    return this._store.size;
  }
}

/**
 * Returns a usable localStorage-compatible object.
 * Prefers the JSDOM-provided window.localStorage; falls back to a shim
 * when neither window.localStorage nor the bare 'localStorage' global is set
 * (which happens on Node 26+ where experimental localStorage is undefined
 * unless --localstorage-file is provided).
 */
function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  // Fall back: install a shim on globalThis so the IIFE-based StorageService
  // picks it up via its own `localStorage` reference.
  if (!globalThis._lsShim) {
    globalThis._lsShim = new LocalStorageShim();
  }
  return globalThis._lsShim;
}

// Ensure localStorage is available before the StorageService IIFE runs.
// This assignment has no effect if the environment already provides localStorage.
if (typeof localStorage === 'undefined') {
  // eslint-disable-next-line no-global-assign
  Object.defineProperty(globalThis, 'localStorage', {
    value: getStorage(),
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Inline StorageService (mirrors the IIFE in js/app.js, adapted for ESM tests)
// ---------------------------------------------------------------------------
const StorageService = (() => {
  function _store() {
    // Re-resolve every call in case the global was replaced.
    return globalThis.localStorage;
  }

  function get(key) {
    try {
      const raw = _store().getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function set(key, value) {
    try {
      _store().setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    try {
      _store().removeItem(key);
    } catch {
      // silent
    }
  }

  function isAvailable() {
    const testKey = '__dashboard_storage_test__';
    try {
      _store().setItem(testKey, '1');
      const readBack = _store().getItem(testKey);
      _store().removeItem(testKey);
      return readBack === '1';
    } catch {
      return false;
    }
  }

  return { get, set, remove, isAvailable };
})();

// ---------------------------------------------------------------------------
// fast-check Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid task id: non-empty string of reasonable length */
const taskIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter(s => s.length > 0);

/** Generates a valid task label: 1–200 printable characters */
const taskLabelArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0);

/** Generates a realistic timestamp (year 2000 to year 2100) */
const createdAtArb = fc.integer({ min: 946684800000, max: 4102444800000 });

/** Generates a single Task object */
const taskArb = fc.record({
  id: taskIdArb,
  label: taskLabelArb,
  completed: fc.boolean(),
  createdAt: createdAtArb,
});

/** Generates an array of Tasks (0–20 tasks) */
const taskArrayArb = fc.array(taskArb, { minLength: 0, maxLength: 20 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StorageService — Property 5: Task persistence round-trip', () => {
  const KEY = 'dashboard_tasks';

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  /**
   * **Validates: Requirements 4.2, 4.8, 4.11, 8.3**
   *
   * For any array of Task objects, saving then loading produces an array that
   * is structurally equivalent: same length, same ids, same labels, same
   * completed states, and same createdAt timestamps.
   */
  it('round-trips any task array through StorageService with structural equivalence', () => {
    fc.assert(
      fc.property(taskArrayArb, (tasks) => {
        // Write
        const writeResult = StorageService.set(KEY, tasks);
        expect(writeResult).toBe(true);

        // Read back
        const loaded = StorageService.get(KEY);

        // Must not be null
        expect(loaded).not.toBeNull();

        // Must be an array of the same length
        expect(Array.isArray(loaded)).toBe(true);
        expect(loaded.length).toBe(tasks.length);

        // Every task must match field-by-field
        for (let i = 0; i < tasks.length; i++) {
          expect(loaded[i].id).toBe(tasks[i].id);
          expect(loaded[i].label).toBe(tasks[i].label);
          expect(loaded[i].completed).toBe(tasks[i].completed);
          expect(loaded[i].createdAt).toBe(tasks[i].createdAt);
        }

        // Clean up between fc iterations to avoid cross-contamination.
        globalThis.localStorage.clear();
      }),
      { numRuns: 100, verbose: false }
    );
  });

  /**
   * **Validates: Requirements 4.11, 8.3**
   *
   * When reading a key that has never been written, StorageService.get returns
   * null (not an empty array or undefined), so callers can safely default to [].
   */
  it('returns null when no tasks have been persisted', () => {
    const loaded = StorageService.get(KEY);
    expect(loaded).toBeNull();
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * Overwriting an existing task array with a new one leaves only the new data
   * in storage — the previous array is fully replaced.
   */
  it('overwrites previous task array on subsequent set calls', () => {
    fc.assert(
      fc.property(taskArrayArb, taskArrayArb, (first, second) => {
        StorageService.set(KEY, first);
        StorageService.set(KEY, second);

        const loaded = StorageService.get(KEY);
        expect(Array.isArray(loaded)).toBe(true);
        expect(loaded.length).toBe(second.length);

        for (let i = 0; i < second.length; i++) {
          expect(loaded[i].id).toBe(second[i].id);
          expect(loaded[i].label).toBe(second[i].label);
          expect(loaded[i].completed).toBe(second[i].completed);
          expect(loaded[i].createdAt).toBe(second[i].createdAt);
        }

        globalThis.localStorage.clear();
      }),
      { numRuns: 100, verbose: false }
    );
  });
});
