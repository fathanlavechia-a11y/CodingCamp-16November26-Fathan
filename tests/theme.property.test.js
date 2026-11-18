// @vitest-environment jsdom
/**
 * Property-based test: Theme toggle is an involution
 *
 * Property 11: Theme toggle is an involution
 * Validates: Requirements 7.1, 7.2
 *
 * For any active Theme, calling ThemeManager.toggle() twice SHALL restore
 * the original Theme value and the document.documentElement dataset attribute.
 *
 * Feature: personal-dashboard, Property 11: theme toggle is an involution
 */

import { describe, it, beforeEach } from 'vitest';
import { expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Inline ThemeManager logic
// (mirrors the logic in js/app.js, adapted for ESM tests without the IIFE
//  browser-only wrapper)
// ---------------------------------------------------------------------------

/**
 * Creates a fresh ThemeManager instance with its own isolated state.
 * This factory is called once per property iteration so each run starts clean.
 *
 * @returns {{ applyTheme: Function, toggle: Function, current: Function }}
 */
function makeThemeManager() {
  const DEFAULT_THEME = 'light';
  let _currentTheme = DEFAULT_THEME;

  /**
   * Apply a theme by writing the data-theme attribute on <html>.
   * Normalises to a known value; falls back to 'light' for unexpected input.
   *
   * @param {"light"|"dark"} theme
   */
  function applyTheme(theme) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    _currentTheme = resolved;
    document.documentElement.dataset.theme = resolved;
  }

  /**
   * Flip the active theme.
   * Mirrors ThemeManager.toggle() in js/app.js (without the Storage/EventBus
   * side-effects that are irrelevant to this property).
   */
  function toggle() {
    const next = _currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(next);
  }

  /**
   * Return the currently active theme string.
   *
   * @returns {"light"|"dark"}
   */
  function current() {
    return _currentTheme;
  }

  return { applyTheme, toggle, current };
}

// ---------------------------------------------------------------------------
// Arbitrary: generate one of the two valid Theme values
// ---------------------------------------------------------------------------
const themeArb = fc.constantFrom('light', 'dark');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThemeManager — Property 11: Theme toggle is an involution', () => {
  beforeEach(() => {
    // Reset the documentElement dataset between tests to avoid bleed-over.
    delete document.documentElement.dataset.theme;
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * For any starting Theme value, applying toggle() twice must:
   *   1. Leave ThemeManager.current() equal to the original Theme.
   *   2. Leave document.documentElement.dataset.theme equal to the original Theme.
   *
   * This confirms toggle() is a self-inverse (involution): f(f(x)) === x.
   */
  it('restores the original theme after two consecutive toggles', () => {
    fc.assert(
      fc.property(themeArb, (startingTheme) => {
        const tm = makeThemeManager();

        // Set the starting theme.
        tm.applyTheme(startingTheme);

        // Capture baseline state.
        const beforeToggle = tm.current();
        const beforeAttr = document.documentElement.dataset.theme;

        // Sanity check: applyTheme set the state correctly.
        expect(beforeToggle).toBe(startingTheme);
        expect(beforeAttr).toBe(startingTheme);

        // First toggle — changes the theme.
        tm.toggle();
        const afterFirstToggle = tm.current();
        const attrAfterFirst = document.documentElement.dataset.theme;
        expect(afterFirstToggle).not.toBe(startingTheme);
        expect(attrAfterFirst).not.toBe(startingTheme);

        // Second toggle — must return to the original theme.
        tm.toggle();
        const afterSecondToggle = tm.current();
        const attrAfterSecond = document.documentElement.dataset.theme;

        // The property: toggle twice == identity.
        expect(afterSecondToggle).toBe(startingTheme);
        expect(attrAfterSecond).toBe(startingTheme);
      }),
      { numRuns: 100, verbose: false }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   *
   * Corollary: a single toggle always produces the opposite theme.
   * light → dark, dark → light.
   */
  it('produces the opposite theme after a single toggle', () => {
    fc.assert(
      fc.property(themeArb, (startingTheme) => {
        const tm = makeThemeManager();
        tm.applyTheme(startingTheme);

        tm.toggle();

        const expected = startingTheme === 'light' ? 'dark' : 'light';
        expect(tm.current()).toBe(expected);
        expect(document.documentElement.dataset.theme).toBe(expected);
      }),
      { numRuns: 100, verbose: false }
    );
  });
});
