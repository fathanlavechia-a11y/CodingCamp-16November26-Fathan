/**
 * Unit tests for ThemeManager
 *
 * Requirements: 7.3, 7.4
 *
 * Strategy: app.js attaches modules to window.Dashboard using the IIFE
 * pattern.  We load it via the Function constructor so that `window` resolves
 * to the JSDOM global, then exercise ThemeManager directly.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

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
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', src)(globalThis, globalThis.localStorage);
  return globalThis.window.Dashboard;
}

// ─────────────────────────────────────────────────────────────────────────────
// ThemeManager
// ─────────────────────────────────────────────────────────────────────────────

describe('ThemeManager', () => {
  let ThemeManager;

  beforeEach(() => {
    // Reset Dashboard namespace and storage before each test.
    globalThis.window.Dashboard = undefined;
    localStorage.clear();
    // Reset the data-theme attribute so tests are independent.
    document.documentElement.removeAttribute('data-theme');

    const Dashboard = loadApp();
    ThemeManager = Dashboard.ThemeManager;
  });

  // ── Requirement 7.4: default theme is "light" when nothing stored ────────────

  describe('Requirement 7.4 — default theme', () => {
    it('current() returns "light" before init() when storage is empty', () => {
      // No saved theme in storage; ThemeManager should default to "light".
      expect(ThemeManager.current()).toBe('light');
    });

    it('init() applies "light" theme when storage has no saved theme', () => {
      // Confirm nothing is stored.
      expect(localStorage.getItem('dashboard_theme')).toBeNull();

      ThemeManager.init();

      expect(ThemeManager.current()).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('applyTheme() with an unrecognised value falls back to "light"', () => {
      ThemeManager.applyTheme('unknown');
      expect(ThemeManager.current()).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  // ── Requirement 7.3: saved theme applied before first paint ─────────────────

  describe('Requirement 7.3 — saved theme applied on init', () => {
    it('init() reads and applies a saved "dark" theme from storage', () => {
      // Pre-populate storage with a saved theme.
      localStorage.setItem('dashboard_theme', JSON.stringify('dark'));

      ThemeManager.init();

      expect(ThemeManager.current()).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('init() reads and applies a saved "light" theme from storage', () => {
      localStorage.setItem('dashboard_theme', JSON.stringify('light'));

      ThemeManager.init();

      expect(ThemeManager.current()).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('applyTheme() sets data-theme synchronously (before next tick)', () => {
      // applyTheme must be synchronous — no await, no setTimeout.
      // We call it and immediately check the attribute without yielding.
      ThemeManager.applyTheme('dark');

      // No await — this is the same tick.
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
  });

  // ── toggle applies data-theme attribute within same tick ─────────────────────

  describe('toggle() — applies data-theme synchronously', () => {
    it('toggle() from "light" sets data-theme to "dark" within the same tick', () => {
      ThemeManager.applyTheme('light');

      ThemeManager.toggle();

      // No await — attribute must be updated synchronously.
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(ThemeManager.current()).toBe('dark');
    });

    it('toggle() from "dark" sets data-theme to "light" within the same tick', () => {
      ThemeManager.applyTheme('dark');

      ThemeManager.toggle();

      expect(document.documentElement.dataset.theme).toBe('light');
      expect(ThemeManager.current()).toBe('light');
    });

    it('toggle() persists the new theme to storage', () => {
      ThemeManager.applyTheme('light');
      ThemeManager.toggle();

      const stored = JSON.parse(localStorage.getItem('dashboard_theme'));
      expect(stored).toBe('dark');
    });

    it('toggle() twice restores the original theme (involution)', () => {
      ThemeManager.applyTheme('light');

      ThemeManager.toggle(); // light → dark
      ThemeManager.toggle(); // dark  → light

      expect(ThemeManager.current()).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  // ── applyTheme() sets both the attribute and current() ───────────────────────

  describe('applyTheme()', () => {
    it('applyTheme("dark") updates current() and data-theme', () => {
      ThemeManager.applyTheme('dark');
      expect(ThemeManager.current()).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('applyTheme("light") updates current() and data-theme', () => {
      ThemeManager.applyTheme('dark'); // set to dark first
      ThemeManager.applyTheme('light');
      expect(ThemeManager.current()).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });
});
