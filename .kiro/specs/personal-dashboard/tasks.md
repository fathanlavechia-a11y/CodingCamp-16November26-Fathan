# Implementation Plan: Personal Dashboard

## Overview

Build a single-page personal dashboard using vanilla HTML, CSS, and JavaScript. All logic runs in the browser with no backend or build step. The app ships as `index.html` + `css/styles.css` + `js/app.js`, persists data via `localStorage` under namespaced keys, and is deployable as a static site on GitHub Pages.

## Tasks

- [x] 1. Set up project skeleton and HTML structure
  - Create `index.html` with semantic markup for all four widget sections (Greeting, Focus Timer, To-Do List, Quick Links)
  - Add a theme toggle button, a user-name input panel, and a storage-warning banner placeholder
  - Link `css/styles.css` and `js/app.js` with a `defer` attribute
  - Create empty `css/styles.css` and `js/app.js` files
  - _Requirements: 9.4_

- [x] 2. Implement StorageService and EventBus
  - [x] 2.1 Implement `StorageService`
    - Write the `StorageService` IIFE module on the `Dashboard` namespace with `get`, `set`, `remove`, and `isAvailable` methods
    - Use namespaced keys (`dashboard_theme`, `dashboard_username`, `dashboard_tasks`, `dashboard_tasks_sort`, `dashboard_links`)
    - Wrap all `localStorage` calls in try/catch; `set` returns `false` on error; `get` returns `null` on error
    - Emit `storage:error` on write failure (wire to EventBus after EventBus is implemented)
    - _Requirements: 8.1, 8.4, 8.5_
  - [x] 2.2 Implement `EventBus`
    - Write the `EventBus` IIFE module with `on`, `off`, and `emit` methods
    - Support multiple handlers per event and safe removal
    - _Requirements: 8.1_
  - [x] 2.3 Write property test for `StorageService` round-trip
    - **Property 5: Task persistence round-trip**
    - **Validates: Requirements 4.2, 4.8, 4.11, 8.3**
  - [x] 2.4 Write unit tests for `StorageService` and `EventBus`
    - Unavailable storage falls back to defaults; `set()` quota error returns `false` and shows warning
    - EventBus handler registration, emission, and removal
    - _Requirements: 8.4, 8.5_

- [ ] 3. Implement ThemeManager
  - [x] 3.1 Implement `ThemeManager`
    - Write `ThemeManager` IIFE module with `init`, `applyTheme`, `toggle`, and `current` methods
    - `applyTheme` sets `document.documentElement.dataset.theme`; must be called before first paint to prevent flash
    - `init` reads from `StorageService` and attaches the toggle button listener
    - `toggle` flips theme, saves to Storage, emits `theme:changed`
    - Default theme is `"light"` when nothing is stored
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [-] 3.2 Write property test for `ThemeManager.toggle`
    - **Property 11: Theme toggle is an involution**
    - **Validates: Requirements 7.1, 7.2**
  - [-] 3.3 Write unit tests for `ThemeManager`
    - Default theme is `"light"` when nothing stored; toggle applies `data-theme` attribute within same tick; saved theme applied before first paint
    - _Requirements: 7.3, 7.4_

- [ ] 4. Implement GreetingWidget
  - [ ] 4.1 Implement pure helper functions `_getGreeting`, `_formatTime`, `_formatDate`
    - `_getGreeting(h)` maps hour 0–23 to one of four greeting strings per the time-of-day boundaries in the design
    - `_formatTime(d)` returns `"HH:MM"` from a Date object
    - `_formatDate(d)` returns `"Monday, 1 January 2025"` format from a Date object
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [~] 4.2 Write property test for `_getGreeting` coverage
    - **Property 1: Greeting time-period coverage**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**
  - [~] 4.3 Implement `GreetingWidget.init` and `_tick`
    - `init` renders time, date, and greeting; starts a 60-second interval calling `_tick`
    - `_tick` re-evaluates the current time period and updates the greeting if the period has changed
    - Reads saved `User_Name` from `StorageService` on init and on `username:changed` event
    - Appends User_Name (truncated to 50 characters) to the greeting when present
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 2.3, 2.5, 2.6_
  - [~] 4.4 Implement user-name input panel
    - Attach submit handler: save non-empty name to `StorageService`, emit `username:changed`; clear storage and emit on empty submit
    - Update greeting display within 500ms of submission
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [~] 4.5 Write property test for user-name truncation
    - **Property 2: User name truncation invariant**
    - **Validates: Requirements 1.7, 2.1**
  - [~] 4.6 Write unit tests for `GreetingWidget`
    - Correct greeting at boundary hours (05:00, 12:00, 18:00, 21:00, 04:59); name appended when set; name omitted when empty
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [~] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement FocusTimerWidget
  - [~] 6.1 Implement the Focus Timer finite state machine
    - Define state object `{ status: "idle"|"running"|"paused"|"ended", remaining: number }` where remaining is 0–1500 seconds
    - Implement `start`, `stop`, `reset`, and `_tick` methods enforcing the FSM transitions (Idle → Running → Paused/Ended, etc.)
    - `_tick` is called by `setInterval` every 1 second; decrements remaining; transitions to `"ended"` at 0
    - Guard duplicate starts and no-op stops/resets per requirements 3.9 and 3.10
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.9, 3.10_
  - [~] 6.2 Implement `FocusTimerWidget._render` and control state
    - `_render` updates the MM:SS display and toggles enabled/disabled state of Start, Stop, and Reset buttons based on FSM status
    - Show a visible on-page notification when status transitions to `"ended"`
    - _Requirements: 3.3, 3.6, 3.7, 3.8_
  - [~] 6.3 Write unit tests for `FocusTimerWidget`
    - Initial display is "25:00"; start→stop→start resumes from paused time; reset from running returns to 25:00; completion fires notification
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

- [ ] 7. Implement TodoWidget
  - [~] 7.1 Implement `addTask` and `deleteTask` with persistence
    - `addTask(label)` validates: non-empty after trim, ≤ 200 characters; creates Task with `id`, `label`, `completed: false`, `createdAt: Date.now()`; appends to in-memory array; calls `_persist()`; returns Task or ValidationError
    - `deleteTask(id)` removes the matching Task from the array, calls `_persist()`
    - `_persist()` calls `StorageService.set("dashboard_tasks", tasks)`
    - On load, restore tasks from `StorageService.get("dashboard_tasks")` or default to `[]`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.10, 4.11, 4.12_
  - [~] 7.2 Write property test for `addTask` list growth
    - **Property 3: Task addition grows the list**
    - **Validates: Requirements 4.2**
  - [~] 7.3 Write property test for invalid label rejection
    - **Property 4: Whitespace and over-length labels are rejected**
    - **Validates: Requirements 4.3, 4.4**
  - [~] 7.4 Write property test for task persistence round-trip
    - **Property 5: Task persistence round-trip**
    - **Validates: Requirements 4.2, 4.8, 4.11, 8.3**
  - [~] 7.5 Implement `editTask` and `toggleComplete`
    - `editTask(id, label)` validates non-empty; updates label in array; calls `_persist()`; discards edit silently if empty
    - `toggleComplete(id)` flips `completed` boolean for the matching Task; calls `_persist()`
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9_
  - [~] 7.6 Write property test for `toggleComplete` involution
    - **Property 6: Toggle completion is an involution**
    - **Validates: Requirements 4.8**
  - [~] 7.7 Write unit tests for `TodoWidget` edit and toggle
    - Edit saves new label; editing to empty retains original; delete removes task; completed task shows visual distinction
    - _Requirements: 4.5, 4.6, 4.7, 4.9_
  - [~] 7.8 Implement `setSortOrder` and `_getSorted`
    - `_getSorted(tasks, opt)` returns a sorted copy without mutating the source array
    - Supports `"default"` (ascending `createdAt`), `"az"` (case-insensitive alphabetical), `"completed-last"` (incomplete before complete, relative order preserved)
    - `setSortOrder(option)` updates active sort, persists preference to `dashboard_tasks_sort`, re-renders within 300ms
    - Restore saved sort preference on load
    - Disable sort control and show empty-list message when task array is empty
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [~] 7.9 Write property test for sort immutability
    - **Property 7: Sort does not mutate storage order**
    - **Validates: Requirements 5.2**
  - [~] 7.10 Write property test for sorted ordering predicate
    - **Property 8: Sorted list satisfies its ordering predicate**
    - **Validates: Requirements 5.1, 5.2**
  - [~] 7.11 Write unit tests for `TodoWidget` sort
    - Sort preference persists across reload; empty list disables sort control; new tasks obey active sort within 300ms
    - _Requirements: 5.3, 5.4, 5.5_

- [~] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement QuickLinksWidget
  - [~] 9.1 Implement `_validateUrl`
    - Pure function: returns `true` if URL begins with `http://` or `https://` and has a non-empty host; `false` otherwise
    - _Requirements: 6.2, 6.4_
  - [~] 9.2 Write property test for `_validateUrl`
    - **Property 9: Valid links accepted, invalid links rejected**
    - **Validates: Requirements 6.2, 6.4**
  - [~] 9.3 Implement `addLink` and `deleteLink` with persistence
    - `addLink(label, url)` validates: non-empty label (≤ 100 chars), valid URL per `_validateUrl`, link count < 20; creates Link with `id`, `label`, `url`; calls `_persist()`
    - `deleteLink(id)` removes matching Link; calls `_persist()`
    - On load, restore links from `StorageService.get("dashboard_links")` or default to `[]`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8_
  - [~] 9.4 Write property test for link persistence round-trip
    - **Property 10: Link persistence round-trip**
    - **Validates: Requirements 6.7, 8.3**
  - [~] 9.5 Implement `_render` and link button behavior
    - Render each Link as a clickable button that opens its URL in a new tab (`target="_blank"`, `rel="noopener noreferrer"`)
    - Attach delete controls per link
    - Display inline validation messages for each error type (empty label, invalid URL, 20-link cap)
    - _Requirements: 6.5, 6.6, 6.3, 6.4, 6.8_
  - [~] 9.6 Write unit tests for `QuickLinksWidget`
    - Valid link opens in new tab; 21st link rejected; delete removes correct link by id; invalid URL shows inline message
    - _Requirements: 6.5, 6.6, 6.8_

- [ ] 10. Implement Dashboard.init and storage error handling
  - [~] 10.1 Implement `Dashboard.init`
    - Call `ThemeManager.applyTheme()` synchronously before DOMContentLoaded finishes to prevent flash
    - On `DOMContentLoaded`, call `init()` on each widget in order: ThemeManager, GreetingWidget, FocusTimerWidget, TodoWidget, QuickLinksWidget
    - Check `StorageService.isAvailable()` at startup; if unavailable, render the storage-warning banner and pass in-memory defaults to all widgets
    - _Requirements: 8.2, 8.4, 9.1_
  - [~] 10.2 Wire storage write-failure warnings
    - Subscribe to `storage:error` on EventBus; show a one-time inline notification "Could not save changes — storage may be full." on write errors
    - _Requirements: 8.5_
  - [~] 10.3 Write integration smoke test
    - `Dashboard.init()` with a mocked `localStorage` containing all keys renders all four widgets with the correct saved state
    - _Requirements: 8.2, 9.3_

- [ ] 11. Write CSS and implement responsive layout
  - [~] 11.1 Write base styles and CSS custom properties for theming
    - Define `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, and related custom properties for both `[data-theme="light"]` and `[data-theme="dark"]` on `:root`
    - Apply base resets, typography, and box-sizing
    - _Requirements: 7.2, 9.4_
  - [~] 11.2 Implement responsive grid layout
    - Lay out the four widgets in a CSS Grid that adapts from a single column (320px) to a two-column layout at wider breakpoints, up to 1920px
    - Ensure no widget content clips, overflows its container, or causes horizontal scroll at any viewport width in the 320px–1920px range
    - _Requirements: 9.2_
  - [~] 11.3 Style all widget components and interactive states
    - Style inputs, buttons, task items (including strikethrough for completed), link buttons, timer display, and sort control
    - Apply `transition` or immediate DOM update so theme changes and state changes reflect within 100ms
    - _Requirements: 7.2, 9.3_

- [~] 12. Final checkpoint — Ensure all tests pass
  - Run `npx vitest --run`; fix any failures.
  - Verify the app loads in Chrome, Firefox, Edge, and Safari.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Property tests use [fast-check](https://fast-check.dev/) with a minimum of 100 iterations each; unit tests use [Vitest](https://vitest.dev/) with JSDOM.
- Install dev dependencies with `npm install --save-dev vitest fast-check jsdom`; run tests with `npx vitest --run`. These tools are dev-only and not shipped to production.
- The dependency graph below excludes checkpoint tasks and top-level parent tasks (no decimal notation).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "2.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4", "6.1", "7.1"] },
    { "id": 5, "tasks": ["4.5", "4.6", "6.2", "7.2", "7.3", "7.4", "9.1"] },
    { "id": 6, "tasks": ["6.3", "7.5", "9.2", "9.3"] },
    { "id": 7, "tasks": ["7.6", "7.7", "7.8", "9.4", "9.5"] },
    { "id": 8, "tasks": ["7.9", "7.10", "7.11", "9.6", "10.1"] },
    { "id": 9, "tasks": ["10.2", "11.1"] },
    { "id": 10, "tasks": ["10.3", "11.2"] },
    { "id": 11, "tasks": ["11.3"] }
  ]
}
```
