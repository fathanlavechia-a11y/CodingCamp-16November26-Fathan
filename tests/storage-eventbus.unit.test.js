/**
 * Unit tests for StorageService and EventBus
 *
 * Requirements: 8.4, 8.5
 *
 * Strategy: app.js is written for plain <script> tags and attaches modules to
 * window.Dashboard.  We load it in JSDOM by reading the source and running it
 * via the Function constructor so that `window` resolves to the JSDOM global.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Execute app.js in the current JSDOM window.
 * Returns the populated window.Dashboard namespace.
 */
function loadApp() {
  const src = readFileSync(
    resolve(__dirname, '../js/app.js'),
    'utf8'
  );
  // Run the source in a function whose `window` / `localStorage` resolve to
  // the JSDOM globals provided by Vitest.
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', src)(globalThis, globalThis.localStorage);
  return globalThis.window.Dashboard;
}

// ─────────────────────────────────────────────────────────────────────────────
// StorageService
// ─────────────────────────────────────────────────────────────────────────────

describe('StorageService', () => {
  let StorageService;

  beforeEach(() => {
    // Reset the Dashboard namespace so each test starts fresh.
    globalThis.window.Dashboard = undefined;
    // Clear JSDOM localStorage between tests.
    localStorage.clear();
    // Load a fresh copy of the module.
    const Dashboard = loadApp();
    StorageService = Dashboard.StorageService;
  });

  // ── isAvailable ─────────────────────────────────────────────────────────────

  describe('isAvailable()', () => {
    it('returns true when localStorage is functioning normally', () => {
      expect(StorageService.isAvailable()).toBe(true);
    });

    it('returns false when localStorage.setItem throws', () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(StorageService.isAvailable()).toBe(false);
      // Restore is handled automatically after the test by vi.restoreAllMocks
      // but let's tidy up explicitly.
      localStorage.setItem = originalSetItem;
    });
  });

  // ── get / set round-trip ─────────────────────────────────────────────────────

  describe('get() and set()', () => {
    it('stores and retrieves a string value', () => {
      StorageService.set('dashboard_username', 'Alice');
      expect(StorageService.get('dashboard_username')).toBe('Alice');
    });

    it('stores and retrieves an array', () => {
      const tasks = [{ id: '1', label: 'Buy milk', completed: false, createdAt: 1000 }];
      StorageService.set('dashboard_tasks', tasks);
      expect(StorageService.get('dashboard_tasks')).toEqual(tasks);
    });

    it('returns null for a key that has never been set', () => {
      expect(StorageService.get('dashboard_nonexistent')).toBeNull();
    });

    it('returns null when the stored value is not valid JSON', () => {
      // Bypass StorageService and write corrupt data directly.
      localStorage.setItem('dashboard_bad', '{not json}');
      expect(StorageService.get('dashboard_bad')).toBeNull();
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deletes the key so get() returns null afterwards', () => {
      StorageService.set('dashboard_theme', 'dark');
      StorageService.remove('dashboard_theme');
      expect(StorageService.get('dashboard_theme')).toBeNull();
    });

    it('does not throw when removing a key that does not exist', () => {
      expect(() => StorageService.remove('dashboard_nonexistent')).not.toThrow();
    });
  });

  // ── Requirement 8.4: unavailable storage falls back to defaults ─────────────

  describe('Requirement 8.4 — unavailable storage', () => {
    it('isAvailable() returns false when localStorage is blocked', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('SecurityError');
      });
      expect(StorageService.isAvailable()).toBe(false);
      vi.restoreAllMocks();
    });

    it('get() returns null (default) when localStorage.getItem throws', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(StorageService.get('dashboard_tasks')).toBeNull();
      vi.restoreAllMocks();
    });

    it('set() returns false when localStorage is unavailable on write', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(StorageService.set('dashboard_tasks', [])).toBe(false);
      vi.restoreAllMocks();
    });
  });

  // ── Requirement 8.5: set() quota error returns false and emits event ─────────

  describe('Requirement 8.5 — write failure', () => {
    it('set() returns false when a quota error is thrown', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });
      const result = StorageService.set('dashboard_tasks', [{ id: '1' }]);
      expect(result).toBe(false);
      vi.restoreAllMocks();
    });

    it('set() emits storage:error on the EventBus when a write fails', () => {
      // Wire up EventBus (it is defined in the same app.js load).
      const { EventBus } = globalThis.window.Dashboard;
      const errorHandler = vi.fn();
      EventBus.on('storage:error', errorHandler);

      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });

      StorageService.set('dashboard_tasks', []);

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'write', key: 'dashboard_tasks' })
      );

      EventBus.off('storage:error', errorHandler);
      vi.restoreAllMocks();
    });

    it('in-memory state is unaffected by a write failure (set returns false but no throw)', () => {
      // Confirm set() does NOT throw — the caller keeps its in-memory value.
      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(() => StorageService.set('dashboard_theme', 'dark')).not.toThrow();
      vi.restoreAllMocks();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EventBus
// ─────────────────────────────────────────────────────────────────────────────

describe('EventBus', () => {
  let EventBus;

  beforeEach(() => {
    globalThis.window.Dashboard = undefined;
    localStorage.clear();
    const Dashboard = loadApp();
    EventBus = Dashboard.EventBus;
  });

  // ── handler registration ─────────────────────────────────────────────────────

  describe('on() — handler registration', () => {
    it('calls the registered handler when the event is emitted', () => {
      const handler = vi.fn();
      EventBus.on('test:event', handler);
      EventBus.emit('test:event', { value: 42 });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ value: 42 });
    });

    it('does not call the handler for a different event', () => {
      const handler = vi.fn();
      EventBus.on('test:a', handler);
      EventBus.emit('test:b', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not register the same handler reference twice', () => {
      const handler = vi.fn();
      EventBus.on('test:event', handler);
      EventBus.on('test:event', handler); // duplicate
      EventBus.emit('test:event', null);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('supports multiple distinct handlers for the same event', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      EventBus.on('test:multi', h1);
      EventBus.on('test:multi', h2);
      EventBus.emit('test:multi', 'payload');
      expect(h1).toHaveBeenCalledWith('payload');
      expect(h2).toHaveBeenCalledWith('payload');
    });

    it('ignores non-function handlers without throwing', () => {
      expect(() => EventBus.on('test:bad', 'not-a-function')).not.toThrow();
      expect(() => EventBus.on('test:bad', null)).not.toThrow();
    });
  });

  // ── emission ──────────────────────────────────────────────────────────────────

  describe('emit()', () => {
    it('does nothing when no handlers are registered for the event', () => {
      expect(() => EventBus.emit('test:nobody', {})).not.toThrow();
    });

    it('passes the payload unchanged to handlers', () => {
      const handler = vi.fn();
      const payload = { foo: 'bar', nested: { n: 1 } };
      EventBus.on('test:payload', handler);
      EventBus.emit('test:payload', payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('continues calling remaining handlers if one throws', () => {
      const bad = vi.fn().mockImplementation(() => { throw new Error('boom'); });
      const good = vi.fn();
      EventBus.on('test:resilience', bad);
      EventBus.on('test:resilience', good);
      // Should not throw and should still call the second handler.
      expect(() => EventBus.emit('test:resilience', null)).not.toThrow();
      expect(good).toHaveBeenCalledOnce();
    });
  });

  // ── handler removal ───────────────────────────────────────────────────────────

  describe('off() — handler removal', () => {
    it('prevents a removed handler from being called on subsequent emissions', () => {
      const handler = vi.fn();
      EventBus.on('test:remove', handler);
      EventBus.off('test:remove', handler);
      EventBus.emit('test:remove', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('is a noop when the handler was never registered', () => {
      const unregistered = vi.fn();
      expect(() => EventBus.off('test:noop', unregistered)).not.toThrow();
    });

    it('is a noop when the event has no listeners at all', () => {
      expect(() => EventBus.off('test:unknown-event', vi.fn())).not.toThrow();
    });

    it('only removes the specified handler, leaving others intact', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      EventBus.on('test:selective', h1);
      EventBus.on('test:selective', h2);
      EventBus.off('test:selective', h1);
      EventBus.emit('test:selective', 'x');
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledWith('x');
    });

    it('allows a handler to safely remove itself during emission', () => {
      let callCount = 0;
      function selfRemovingHandler() {
        callCount += 1;
        EventBus.off('test:self-remove', selfRemovingHandler);
      }
      EventBus.on('test:self-remove', selfRemovingHandler);
      EventBus.emit('test:self-remove', null); // first emit — handler fires and removes itself
      EventBus.emit('test:self-remove', null); // second emit — handler should NOT fire again
      expect(callCount).toBe(1);
    });
  });
});
