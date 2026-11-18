/**
 * Personal Dashboard — js/app.js
 *
 * All modules live under the window.Dashboard namespace using the IIFE module
 * pattern.  No build tools, no imports — plain <script> tag compatible.
 */

/* ─────────────────────────────────────────────────────────────────────────────
 * Namespace bootstrap
 * ───────────────────────────────────────────────────────────────────────────*/
window.Dashboard = window.Dashboard || {};

/* ─────────────────────────────────────────────────────────────────────────────
 * StorageService
 * Wraps localStorage with namespaced keys and uniform error handling.
 *
 * Keys used:
 *   dashboard_theme       – "light" | "dark"
 *   dashboard_username    – string
 *   dashboard_tasks       – Task[]
 *   dashboard_tasks_sort  – "default" | "az" | "completed-last"
 *   dashboard_links       – Link[]
 *
 * Requirements: 8.1, 8.4, 8.5
 * ───────────────────────────────────────────────────────────────────────────*/
Dashboard.StorageService = (function () {
  'use strict';

  /**
   * Emit storage:error on the EventBus when it is available.
   * EventBus is wired in a later task; this guard prevents errors during
   * early initialisation.
   *
   * @param {"read"|"write"} op
   * @param {string} key
   */
  function _emitError(op, key) {
    if (
      window.Dashboard &&
      window.Dashboard.EventBus &&
      typeof window.Dashboard.EventBus.emit === 'function'
    ) {
      window.Dashboard.EventBus.emit('storage:error', { op: op, key: key });
    }
  }

  /**
   * Retrieve and JSON-parse a value from localStorage.
   *
   * @param {string} key  The full namespaced key (e.g. "dashboard_tasks").
   * @returns {*|null}    Parsed value, or null when the key is absent or an
   *                      error occurs.
   */
  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /**
   * JSON-stringify and store a value in localStorage.
   *
   * @param {string} key    The full namespaced key.
   * @param {*}      value  Any JSON-serialisable value.
   * @returns {boolean}     true on success, false on error (e.g. quota exceeded).
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      _emitError('write', key);
      return false;
    }
  }

  /**
   * Remove a key from localStorage.  Silently ignored if the key is absent or
   * localStorage is unavailable.
   *
   * @param {string} key  The full namespaced key.
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Removal failure is not critical; ignore silently.
    }
  }

  /**
   * Test whether localStorage is usable by performing a write / read / delete
   * cycle with a temporary sentinel key.
   *
   * @returns {boolean}  true when localStorage is available and functional.
   */
  function isAvailable() {
    var testKey = '__dashboard_storage_test__';
    try {
      localStorage.setItem(testKey, '1');
      var readBack = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return readBack === '1';
    } catch (e) {
      return false;
    }
  }

  return {
    get: get,
    set: set,
    remove: remove,
    isAvailable: isAvailable,
  };
}());

/* ─────────────────────────────────────────────────────────────────────────────
 * EventBus
 * Lightweight pub/sub used for cross-widget communication.
 *
 * API:
 *   on(event, handler)  – register handler for event; noop if already added
 *   off(event, handler) – remove handler for event; noop if not found
 *   emit(event, data)   – invoke all handlers for event with data
 *
 * Multiple handlers per event are supported.  Handlers are stored per-event
 * and iterated over a snapshot copy so that a handler may safely call off()
 * on itself during emission without causing missed or duplicate invocations.
 *
 * Requirements: 8.1
 * ───────────────────────────────────────────────────────────────────────────*/
Dashboard.EventBus = (function () {
  'use strict';

  /**
   * Internal registry: maps event name → array of handler functions.
   * @type {Object.<string, Function[]>}
   */
  var _listeners = {};

  /**
   * Register a handler for an event.
   * Adding the same handler reference a second time for the same event is a
   * noop — it will not be duplicated.
   *
   * @param {string}   event    Event name (e.g. "storage:error").
   * @param {Function} handler  Callback invoked with the emitted payload.
   */
  function on(event, handler) {
    if (typeof handler !== 'function') {
      return;
    }
    if (!_listeners[event]) {
      _listeners[event] = [];
    }
    // Guard against duplicate registration of the same function reference.
    if (_listeners[event].indexOf(handler) === -1) {
      _listeners[event].push(handler);
    }
  }

  /**
   * Remove a previously registered handler.
   * If the handler was not registered for the event this is a noop.
   *
   * @param {string}   event    Event name.
   * @param {Function} handler  The exact function reference passed to on().
   */
  function off(event, handler) {
    if (!_listeners[event]) {
      return;
    }
    var idx = _listeners[event].indexOf(handler);
    if (idx !== -1) {
      _listeners[event].splice(idx, 1);
    }
  }

  /**
   * Emit an event, invoking all registered handlers with the given payload.
   * Iterates over a snapshot of the handler array taken at emission time so
   * that handlers which call off() on themselves do not disrupt the loop.
   *
   * @param {string} event  Event name.
   * @param {*}      data   Payload forwarded to every handler.
   */
  function emit(event, data) {
    if (!_listeners[event]) {
      return;
    }
    // Snapshot the array before iteration to allow safe removal during emit.
    var snapshot = _listeners[event].slice();
    for (var i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](data);
      } catch (e) {
        // A misbehaving handler must not prevent other handlers from running.
        // eslint-disable-next-line no-console
        if (typeof console !== 'undefined' && console.error) {
          console.error('[EventBus] handler error for event "' + event + '":', e);
        }
      }
    }
  }

  return {
    on: on,
    off: off,
    emit: emit,
  };
}());

/* ─────────────────────────────────────────────────────────────────────────────
 * ThemeManager
 * Reads, applies, and toggles the Light / Dark theme.
 *
 * API:
 *   init()          – read saved theme from Storage, apply it, attach the
 *                     toggle-button click listener
 *   applyTheme(t)   – set document.documentElement.dataset.theme to t and
 *                     update the toggle label; call this before first paint
 *                     to prevent a flash of the wrong theme
 *   toggle()        – flip the current theme, persist it, emit theme:changed
 *   current()       – return the currently active theme string ("light"|"dark")
 *
 * Storage key : "dashboard_theme"
 * DOM ids used: #theme-toggle (button), .theme-toggle__label (label text)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 * ───────────────────────────────────────────────────────────────────────────*/
Dashboard.ThemeManager = (function () {
  'use strict';

  var STORAGE_KEY = 'dashboard_theme';
  var DEFAULT_THEME = 'light';

  /** Currently active theme — kept in sync with the DOM attribute. */
  var _currentTheme = DEFAULT_THEME;

  /**
   * Apply a theme by writing the data-theme attribute on <html>.
   * Also updates the toggle button label to show the active theme.
   * This is intentionally synchronous so it can run before first paint.
   *
   * @param {"light"|"dark"} theme
   */
  function applyTheme(theme) {
    // Normalise to a known value; fall back to default if anything unexpected.
    var resolved = (theme === 'dark') ? 'dark' : 'light';
    _currentTheme = resolved;
    document.documentElement.dataset.theme = resolved;

    // Update label text when the toggle element is present in the DOM.
    var label = document.querySelector('.theme-toggle__label');
    if (label) {
      label.textContent = resolved === 'dark' ? 'Dark' : 'Light';
    }
  }

  /**
   * Flip the active theme, persist the new value, and emit theme:changed.
   */
  function toggle() {
    var next = (_currentTheme === 'light') ? 'dark' : 'light';
    applyTheme(next);

    // Persist the new theme; Requirement 7.6 says a storage error must not
    // display an error — the session simply retains the theme in memory only.
    Dashboard.StorageService.set(STORAGE_KEY, next);

    // Notify other modules.
    Dashboard.EventBus.emit('theme:changed', { theme: next });
  }

  /**
   * Return the currently active theme string.
   *
   * @returns {"light"|"dark"}
   */
  function current() {
    return _currentTheme;
  }

  /**
   * Initialise ThemeManager:
   *  1. Read the saved theme from Storage (default: "light" if absent).
   *  2. Apply it to the document (prevents flash — call early in bootstrap).
   *  3. Attach the click listener to the #theme-toggle button.
   */
  function init() {
    var saved = Dashboard.StorageService.get(STORAGE_KEY);
    applyTheme(saved || DEFAULT_THEME);

    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  return {
    init: init,
    applyTheme: applyTheme,
    toggle: toggle,
    current: current,
  };
}());

/* ─────────────────────────────────────────────────────────────────────────────
 * GreetingWidget
 * Displays the current time, date, and a time-of-day greeting.
 *
 * Pure helpers (no DOM, no side-effects):
 *   _getGreeting(h)  – hour (0–23) → greeting string
 *   _formatTime(d)   – Date → "HH:MM" (zero-padded)
 *   _formatDate(d)   – Date → "Monday, 1 January 2025"
 *
 * init() and _tick() will be added in task 4.3.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 * ───────────────────────────────────────────────────────────────────────────*/
Dashboard.GreetingWidget = (function () {
  'use strict';

  /**
   * Map an hour (0–23) to the appropriate time-of-day greeting string.
   *
   * Boundaries (Requirements 1.3–1.6):
   *   05–11 → "Good Morning"
   *   12–17 → "Good Afternoon"
   *   18–20 → "Good Evening"
   *   21–04 → "Good Night"
   *
   * @param {number} h  Integer hour in the range 0–23.
   * @returns {string}  One of the four greeting strings.
   */
  function _getGreeting(h) {
    if (h >= 5 && h <= 11) {
      return 'Good Morning';
    }
    if (h >= 12 && h <= 17) {
      return 'Good Afternoon';
    }
    if (h >= 18 && h <= 20) {
      return 'Good Evening';
    }
    // Covers 21–23 and 0–4 (Good Night).
    return 'Good Night';
  }

  /**
   * Format a Date object as a zero-padded "HH:MM" string.
   *
   * @param {Date} d  Any valid Date object.
   * @returns {string}  e.g. "09:05" or "23:47"
   */
  function _formatTime(d) {
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

  /**
   * Format a Date object as "Weekday, D Month YYYY".
   * The day number is NOT zero-padded (e.g. "Monday, 1 January 2025").
   *
   * @param {Date} d  Any valid Date object.
   * @returns {string}  e.g. "Monday, 1 January 2025"
   */
  function _formatDate(d) {
    var DAYS = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday'
    ];
    var MONTHS = [
      'January', 'February', 'March', 'April',
      'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December'
    ];
    var dayName   = DAYS[d.getDay()];
    var dayNumber = d.getDate();          // no zero-padding
    var monthName = MONTHS[d.getMonth()];
    var year      = d.getFullYear();
    return dayName + ', ' + dayNumber + ' ' + monthName + ' ' + year;
  }

  return {
    _getGreeting: _getGreeting,
    _formatTime:  _formatTime,
    _formatDate:  _formatDate,
  };
}());

/* ─────────────────────────────────────────────────────────────────────────────
 * GreetingWidget implementation
 * ───────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  var widget = window.Dashboard.GreetingWidget;
  var intervalId = null;
  var name = '';

  function _truncateName(value) {
    return String(value || '').trim().slice(0, 50);
  }

  function _render() {
    var now = new Date();
    var timeEl = document.getElementById('greeting-time');
    var dateEl = document.getElementById('greeting-date');
    var textEl = document.getElementById('greeting-text');
    if (timeEl) timeEl.textContent = widget._formatTime(now);
    if (dateEl) dateEl.textContent = widget._formatDate(now);
    if (textEl) {
      var greeting = widget._getGreeting(now.getHours());
      textEl.textContent = name ? greeting + ', ' + name : greeting;
    }
  }

  function _tick() {
    _render();
  }

  function _loadName() {
    var saved = Dashboard.StorageService.get('dashboard_username');
    if (typeof saved !== 'string') saved = '';
    name = _truncateName(saved);
  }

  function init() {
    _loadName();
    var input = document.getElementById('username-input');
    var form = document.getElementById('username-form');
    if (input) input.value = name;
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var nextName = input ? _truncateName(input.value) : '';
        if (nextName) {
          Dashboard.StorageService.set('dashboard_username', nextName);
        } else {
          Dashboard.StorageService.remove('dashboard_username');
        }
        name = nextName;
        if (input) input.value = nextName;
        _render();
        Dashboard.EventBus.emit('username:changed', { username: nextName });
      });
    }
    Dashboard.EventBus.on('username:changed', function (payload) {
      var changedName = typeof payload === 'string'
        ? payload
        : (payload && payload.username);
      name = _truncateName(changedName);
      _render();
    });
    _render();
    if (intervalId === null) intervalId = window.setInterval(_tick, 60000);
  }

  widget.init = init;
  widget._tick = _tick;
  widget._truncateName = _truncateName;
}());

Dashboard.FocusTimerWidget = (function () {
  'use strict';

  var INITIAL = 1500;
  var state = { status: 'idle', remaining: INITIAL };
  var intervalId = null;

  function _format(seconds) {
    var safe = Math.max(0, Number(seconds) || 0);
    var minutes = Math.floor(safe / 60);
    var secs = safe % 60;
    return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function _render() {
    var display = document.getElementById('timer-display');
    var start = document.getElementById('timer-start');
    var stop = document.getElementById('timer-stop');
    var reset = document.getElementById('timer-reset');
    var notification = document.getElementById('timer-notification');
    if (display) display.textContent = _format(state.remaining);
    if (start) start.disabled = state.status === 'running';
    if (stop) stop.disabled = state.status !== 'running';
    if (reset) reset.disabled = state.status === 'idle';
    if (notification) {
      var ended = state.status === 'ended';
      notification.hidden = !ended;
    }
  }

  function _tick() {
    if (state.status !== 'running') return;
    state.remaining = Math.max(0, state.remaining - 1);
    if (state.remaining === 0) {
      state.status = 'ended';
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      Dashboard.EventBus.emit('timer:ended', {});
    }
    _render();
  }

  function start() {
    if (state.status === 'running') return false;
    if (state.status === 'ended') state.remaining = INITIAL;
    state.status = 'running';
    if (intervalId === null) intervalId = window.setInterval(_tick, 1000);
    _render();
    return true;
  }

  function stop() {
    if (state.status !== 'running') return false;
    state.status = 'paused';
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    _render();
    return true;
  }

  function reset() {
    if (state.status === 'idle' && state.remaining === INITIAL) return false;
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    state.status = 'idle';
    state.remaining = INITIAL;
    _render();
    return true;
  }

  function init() {
    var startBtn = document.getElementById('timer-start');
    var stopBtn = document.getElementById('timer-stop');
    var resetBtn = document.getElementById('timer-reset');
    if (startBtn) startBtn.onclick = start;
    if (stopBtn) stopBtn.onclick = stop;
    if (resetBtn) resetBtn.onclick = reset;
    _render();
  }

  var api = {
    init: init,
    start: start,
    stop: stop,
    reset: reset,
    _tick: _tick,
    _render: _render,
    _format: _format,
    getState: function () { return { status: state.status, remaining: state.remaining }; },
  };
  Object.defineProperty(api, 'state', { get: function () { return state; } });
  Object.defineProperty(api, '_state', { get: function () { return state; } });
  return api;
}());

Dashboard.TodoWidget = (function () {
  'use strict';

  var TASK_KEY = 'dashboard_tasks';
  var SORT_KEY = 'dashboard_tasks_sort';
  var tasks = [];
  var sortOrder = 'default';
  var idCounter = 0;

  function ValidationError(message) {
    var error = new Error(message);
    error.name = 'ValidationError';
    return error;
  }

  function _persist() {
    Dashboard.StorageService.set(TASK_KEY, tasks);
  }

  function _newId() {
    idCounter += 1;
    return 'task-' + Date.now() + '-' + idCounter;
  }

  function _load() {
    var saved = Dashboard.StorageService.get(TASK_KEY);
    tasks = Array.isArray(saved) ? saved.filter(function (task) {
      return task && typeof task.id !== 'undefined' && typeof task.label === 'string';
    }) : [];
    var savedSort = Dashboard.StorageService.get(SORT_KEY);
    sortOrder = (savedSort === 'az' || savedSort === 'completed-last') ? savedSort : 'default';
  }

  function addTask(label) {
    var clean = typeof label === 'string' ? label.trim() : '';
    if (!clean) return ValidationError('Task label cannot be empty.');
    if (clean.length > 200) return ValidationError('Task label cannot exceed 200 characters.');
    var task = { id: _newId(), label: clean, completed: false, createdAt: Date.now() };
    tasks.push(task);
    _persist();
    _render();
    return task;
  }

  function deleteTask(id) {
    for (var i = 0; i < tasks.length; i += 1) {
      if (tasks[i].id === id) {
        var removed = tasks.splice(i, 1)[0];
        _persist();
        _render();
        return removed;
      }
    }
    return false;
  }

  function editTask(id, label) {
    var clean = typeof label === 'string' ? label.trim() : '';
    if (!clean) return false;
    if (clean.length > 200) return ValidationError('Task label cannot exceed 200 characters.');
    for (var i = 0; i < tasks.length; i += 1) {
      if (tasks[i].id === id) {
        tasks[i].label = clean;
        _persist();
        _render();
        return tasks[i];
      }
    }
    return false;
  }

  function toggleComplete(id) {
    for (var i = 0; i < tasks.length; i += 1) {
      if (tasks[i].id === id) {
        tasks[i].completed = !tasks[i].completed;
        _persist();
        _render();
        return tasks[i];
      }
    }
    return false;
  }

  function _getSorted(source, option) {
    var copy = (source || []).slice();
    if (option === 'az') {
      return copy.sort(function (a, b) {
        return String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' });
      });
    }
    if (option === 'completed-last') {
      return copy.sort(function (a, b) {
        return Number(Boolean(a.completed)) - Number(Boolean(b.completed));
      });
    }
    return copy.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  }

  function setSortOrder(option) {
    if (option !== 'default' && option !== 'az' && option !== 'completed-last') return false;
    sortOrder = option;
    Dashboard.StorageService.set(SORT_KEY, option);
    _render();
    return true;
  }

  function _render() {
    var list = document.getElementById('todo-list');
    var empty = document.getElementById('todo-empty');
    var sortSelect = document.getElementById('todo-sort-select');
    if (sortSelect) {
      sortSelect.disabled = tasks.length === 0;
      sortSelect.value = sortOrder;
    }
    if (empty) empty.hidden = tasks.length !== 0;
    if (!list) return;
    list.replaceChildren();
    var sorted = _getSorted(tasks, sortOrder);
    sorted.forEach(function (task) {
      var li = document.createElement('li');
      li.className = 'todo-item' + (task.completed ? ' todo-item--completed' : '');
      li.dataset.taskId = task.id;

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-item__checkbox';
      checkbox.checked = !!task.completed;
      checkbox.setAttribute('aria-label', 'Mark task complete');
      checkbox.addEventListener('change', function () { toggleComplete(task.id); });

      var label = document.createElement('span');
      label.className = 'todo-item__label';
      label.textContent = task.label;

      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'todo-item__edit';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'todo-item__edit-input';
        input.maxLength = 200;
        input.value = task.label;
        li.replaceChild(input, label);
        input.focus();
        input.select();
        var save = function () { editTask(task.id, input.value); };
        input.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') _render();
        });
        input.addEventListener('blur', save);
      });

      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'todo-item__delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () { deleteTask(task.id); });

      li.appendChild(checkbox);
      li.appendChild(label);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  }

  function init() {
    _load();
    var form = document.getElementById('todo-form');
    var input = document.getElementById('todo-input');
    var error = document.getElementById('todo-error');
    var sortSelect = document.getElementById('todo-sort-select');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        try {
          var result = addTask(input ? input.value : '');
          if (result && result.name === 'ValidationError') {
            if (error) {
              error.textContent = result.message;
              error.hidden = false;
            }
          } else {
            if (input) input.value = '';
            if (error) { error.textContent = ''; error.hidden = true; }
          }
        } catch (e) {
          if (error) {
            error.textContent = e.message;
            error.hidden = false;
          }
        }
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        setSortOrder(sortSelect.value);
      });
    }
    _render();
  }

  var api = {
    init: init,
    addTask: addTask,
    deleteTask: deleteTask,
    editTask: editTask,
    toggleComplete: toggleComplete,
    setSortOrder: setSortOrder,
    _getSorted: _getSorted,
    _persist: _persist,
    _render: _render,
    getTasks: function () { return tasks.slice(); },
  };
  Object.defineProperty(api, 'tasks', { get: function () { return tasks; } });
  Object.defineProperty(api, '_tasks', { get: function () { return tasks; } });
  return api;
}());

Dashboard.QuickLinksWidget = (function () {
  'use strict';

  var STORAGE_KEY = 'dashboard_links';
  var links = [];
  var idCounter = 0;

  function ValidationError(message) {
    var error = new Error(message);
    error.name = 'ValidationError';
    return error;
  }

  function _validateUrl(url) {
    if (typeof url !== 'string') return false;
    if (!/^https?:\/\//i.test(url)) return false;
    try {
      var parsed = new URL(url);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !!parsed.hostname;
    } catch (e) {
      return false;
    }
  }

  function _persist() {
    Dashboard.StorageService.set(STORAGE_KEY, links);
  }

  function _load() {
    var saved = Dashboard.StorageService.get(STORAGE_KEY);
    links = Array.isArray(saved) ? saved.filter(function (link) {
      return link && typeof link.id !== 'undefined' &&
        typeof link.label === 'string' && typeof link.url === 'string';
    }) : [];
  }

  function addLink(label, url) {
    var cleanLabel = typeof label === 'string' ? label.trim() : '';
    if (!cleanLabel) return ValidationError('Link label cannot be empty.');
    if (cleanLabel.length > 100) return ValidationError('Link label cannot exceed 100 characters.');
    if (!_validateUrl(url)) return ValidationError('Enter a valid HTTP or HTTPS URL.');
    if (links.length >= 20) return ValidationError('You can add up to 20 links.');
    idCounter += 1;
    var link = { id: 'link-' + Date.now() + '-' + idCounter, label: cleanLabel, url: url };
    links.push(link);
    _persist();
    _render();
    return link;
  }

  function deleteLink(id) {
    for (var i = 0; i < links.length; i += 1) {
      if (links[i].id === id) {
        var removed = links.splice(i, 1)[0];
        _persist();
        _render();
        return removed;
      }
    }
    return false;
  }

  function _render() {
    var list = document.getElementById('links-list');
    if (!list) return;
    list.replaceChildren();
    links.forEach(function (link) {
      var li = document.createElement('li');
      li.className = 'links-item';
      li.dataset.linkId = link.id;

      var anchor = document.createElement('a');
      anchor.className = 'links-item__button';
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = link.label;

      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'links-item__delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', 'Delete ' + link.label);
      deleteBtn.addEventListener('click', function () { deleteLink(link.id); });

      li.appendChild(anchor);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  }

  function init() {
    _load();
    var form = document.getElementById('links-form');
    var labelInput = document.getElementById('link-label-input');
    var urlInput = document.getElementById('link-url-input');
    var error = document.getElementById('links-error');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        try {
          var result = addLink(labelInput ? labelInput.value : '', urlInput ? urlInput.value : '');
          if (result && result.name === 'ValidationError') {
            if (error) {
              error.textContent = result.message;
              error.hidden = false;
            }
          } else {
            if (labelInput) labelInput.value = '';
            if (urlInput) urlInput.value = '';
            if (error) { error.textContent = ''; error.hidden = true; }
          }
        } catch (e) {
          if (error) {
            error.textContent = e.message;
            error.hidden = false;
          }
        }
      });
    }
    _render();
  }

  var api = {
    init: init,
    addLink: addLink,
    deleteLink: deleteLink,
    _validateUrl: _validateUrl,
    _persist: _persist,
    _render: _render,
    getLinks: function () { return links.slice(); },
  };
  Object.defineProperty(api, 'links', { get: function () { return links; } });
  Object.defineProperty(api, '_links', { get: function () { return links; } });
  return api;
}());

Dashboard.Dashboard = (function () {
  'use strict';

  var warningShown = false;
  var initialized = false;

  function _showStorageWarning() {
    var banner = document.getElementById('storage-warning');
    if (banner) banner.hidden = false;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    Dashboard.ThemeManager.applyTheme(
      Dashboard.StorageService.get('dashboard_theme') || 'light'
    );

    var unavailable = !Dashboard.StorageService.isAvailable();
    if (unavailable) _showStorageWarning();

    Dashboard.ThemeManager.init();
    Dashboard.GreetingWidget.init();
    Dashboard.FocusTimerWidget.init();
    Dashboard.TodoWidget.init();
    Dashboard.QuickLinksWidget.init();

    Dashboard.EventBus.on('storage:error', function () {
      if (warningShown) return;
      warningShown = true;
      var existing = document.getElementById('storage-warning');
      if (existing) {
        existing.textContent = 'Could not save changes — storage may be full.';
        existing.hidden = false;
      }
    });
  }

  return {
    init: init,
  };
}());

/* Apply the saved theme as early as the script executes. */
(function () {
  try {
    var saved = Dashboard.StorageService.get('dashboard_theme');
    Dashboard.ThemeManager.applyTheme(saved || 'light');
  } catch (e) {
    Dashboard.ThemeManager.applyTheme('light');
  }
}());

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Dashboard.Dashboard.init);
  } else {
    Dashboard.Dashboard.init();
  }
}
