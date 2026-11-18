# Requirements Document

## Introduction

A personal dashboard web application built with vanilla HTML, CSS, and JavaScript. It runs entirely in the browser with no backend server and persists all user data via the Local Storage API. The dashboard is deployable as a static site on GitHub Pages and usable as a browser extension.

The MVP includes four widgets: a Greeting panel, a Focus Timer, a To-Do List, and a Quick Links panel. Three optional challenges are included: Light/Dark mode toggle, a custom user name in the greeting, and task sorting.

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **Greeting_Widget**: The UI section that displays the current time, date, and a time-of-day greeting.
- **Focus_Timer**: The UI section that runs a 25-minute countdown timer.
- **Todo_List**: The UI section that manages the user's task list.
- **Quick_Links**: The UI section that displays user-defined shortcut links.
- **Storage**: The browser's `localStorage` API used to persist all user data client-side.
- **Task**: A single to-do item with a text label, a completion state, and a creation timestamp.
- **Link**: A user-defined record consisting of a display label and a URL.
- **Theme**: The active color scheme of the Dashboard, either `light` or `dark`.
- **User_Name**: An optional display name entered by the user, stored in Storage and shown in the greeting.

---

## Requirements

### Requirement 1: Greeting Widget

**User Story:** As a user, I want to see the current time, date, and a personalized greeting when I open the dashboard, so that I have immediate context for my day.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Greeting_Widget SHALL display the current local time in HH:MM format, updating every 60 seconds.
2. WHEN the Dashboard loads, THE Greeting_Widget SHALL display the current local date including the day of the week, day number, month, and year.
3. WHEN the local time is between 05:00 and 11:59, THE Greeting_Widget SHALL display the greeting text "Good Morning".
4. WHEN the local time is between 12:00 and 17:59, THE Greeting_Widget SHALL display the greeting text "Good Afternoon".
5. WHEN the local time is between 18:00 and 20:59, THE Greeting_Widget SHALL display the greeting text "Good Evening".
6. WHEN the local time is between 21:00 and 04:59, THE Greeting_Widget SHALL display the greeting text "Good Night".
7. WHERE a User_Name has been saved, THE Greeting_Widget SHALL append the User_Name to the greeting text, separated by a comma and space (e.g., "Good Morning, Fathan"), with User_Name truncated to a maximum of 50 characters.
8. WHERE no User_Name has been saved, THE Greeting_Widget SHALL display the greeting text without a name suffix.
9. WHEN the displayed minute changes, THE Greeting_Widget SHALL re-evaluate the current time period and update the greeting text if the time period has changed.

---

### Requirement 2: Custom Name in Greeting

**User Story:** As a user, I want to set my name in the dashboard, so that the greeting feels personal.

#### Acceptance Criteria

1. THE Dashboard SHALL provide an input field that allows the user to enter a User_Name of up to 50 printable characters.
2. WHEN the user submits a non-empty User_Name, THE Storage SHALL save the User_Name under a fixed key.
3. WHEN the Dashboard loads and Storage contains a saved User_Name, THE Greeting_Widget SHALL display the greeting incorporating the saved User_Name within 500 milliseconds of the Dashboard becoming visible.
4. IF the user submits an empty User_Name, THEN THE Dashboard SHALL remove the User_Name from Storage and THE Greeting_Widget SHALL display the default greeting without a name within 500 milliseconds.
5. WHEN the Dashboard loads and Storage does not contain a saved User_Name, THE Greeting_Widget SHALL display the default greeting without a name.
6. IF Storage is unavailable when the Dashboard loads, THEN THE Greeting_Widget SHALL display the default greeting without a name.

---

### Requirement 3: Focus Timer

**User Story:** As a user, I want a 25-minute countdown timer with start, stop, and reset controls, so that I can run focused work sessions.

#### Acceptance Criteria

1. WHEN the Focus_Timer is in the idle state, THE Focus_Timer SHALL display a remaining time of 25:00.
2. WHEN the user activates the start control, THE Focus_Timer SHALL begin counting down from the current remaining time in one-second intervals.
3. WHILE the Focus_Timer is running, THE Focus_Timer SHALL update the displayed remaining time once per second in MM:SS format.
4. WHEN the user activates the stop control, THE Focus_Timer SHALL pause the countdown and retain the current remaining time.
5. WHEN the user activates the reset control, THE Focus_Timer SHALL stop the countdown and restore the remaining time to 25:00.
6. WHEN the remaining time reaches 00:00, THE Focus_Timer SHALL stop the countdown and display a visible on-page notification indicating the session has ended.
7. WHILE the Focus_Timer is running, THE Focus_Timer SHALL disable the start control and enable the stop and reset controls.
8. WHILE the Focus_Timer is paused or idle, THE Focus_Timer SHALL enable the start control and disable the stop control.
9. IF the user activates the start control while the Focus_Timer is already running, THE Focus_Timer SHALL ignore the input and maintain the current countdown state.
10. IF the user activates the stop control while the Focus_Timer is idle or paused, THE Focus_Timer SHALL ignore the input and maintain the current remaining time.

---

### Requirement 4: To-Do List

**User Story:** As a user, I want to manage a list of tasks I can add, edit, complete, sort, and delete, so that I can track my work directly in the dashboard.

#### Acceptance Criteria

1. THE Todo_List SHALL provide an input field accepting up to 200 characters and a submit control for adding a new Task.
2. WHEN the user submits a non-empty task label, THE Todo_List SHALL append a new Task with a completion state of `false` and store the updated task array in Storage.
3. IF the user submits an empty task label, THEN THE Todo_List SHALL not add a Task and SHALL display an inline validation message indicating that the task label cannot be empty.
4. IF the user submits a task label exceeding 200 characters, THEN THE Todo_List SHALL not add a Task and SHALL display an inline validation message indicating the character limit.
5. WHEN the user activates the edit control on a Task, THE Todo_List SHALL present the existing task label in an editable field prepopulated with the current label.
6. WHEN the user saves a non-empty edited label, THE Todo_List SHALL update the Task label in the displayed list and in Storage.
7. IF the user saves an empty edited label, THEN THE Todo_List SHALL discard the edit and retain the original Task label unchanged.
8. WHEN the user activates the complete control on a Task, THE Todo_List SHALL toggle the Task's completion state between `true` and `false` and update Storage.
9. WHEN a Task has a completion state of `true`, THE Todo_List SHALL apply a visual distinction (e.g., strikethrough) to that Task.
10. WHEN the user activates the delete control on a Task, THE Todo_List SHALL remove the Task from the displayed list and from Storage.
11. WHEN the Dashboard loads and Storage contains a saved task array, THE Todo_List SHALL restore and display all saved Tasks in their previously saved order.
12. IF Storage contains no saved task array when the Dashboard loads, THEN THE Todo_List SHALL display an empty task list with no Tasks shown.

---

### Requirement 5: Task Sorting

**User Story:** As a user, I want to sort my task list, so that I can view tasks in a preferred order.

#### Acceptance Criteria

1. THE Todo_List SHALL provide a sort control with the following options: "Default" (creation order, ascending by creation timestamp), "A–Z" (alphabetical ascending by task title, case-insensitive), and "Completed Last" (incomplete tasks displayed before completed tasks, preserving relative creation order within each group).
2. WHEN the user selects a sort option, THE Todo_List SHALL reorder the displayed Tasks according to the selected option within 300 milliseconds without modifying the underlying Storage order.
3. WHEN new Tasks are added while a non-default sort is active, THE Todo_List SHALL apply the active sort order to include the new Task in the sorted view within 300 milliseconds of the Task being added.
4. THE Todo_List SHALL persist the user's selected sort option so that the same sort option is applied when the Todo_List is reloaded or the page is refreshed.
5. IF the task list contains no Tasks, THEN THE Todo_List SHALL display the sort control in a disabled state and display a message indicating the list is empty.

---

### Requirement 6: Quick Links

**User Story:** As a user, I want to save and launch favorite website links from the dashboard, so that I can reach them in one click.

#### Acceptance Criteria

1. THE Quick_Links SHALL provide an input field for a display label (maximum 100 characters), an input field for a URL, and a submit control for adding a new Link.
2. WHEN the user submits a Link with a non-empty label and a URL that begins with `http://` or `https://` and contains a non-empty host, THE Quick_Links SHALL add the Link as a clickable button and save the updated link array to Storage.
3. IF the user submits a Link with an empty label, THEN THE Quick_Links SHALL not add the Link and SHALL display an inline validation message indicating the label is required.
4. IF the user submits a Link with a URL that does not begin with `http://` or `https://` or has an empty host, THEN THE Quick_Links SHALL not add the Link and SHALL display an inline validation message indicating the URL is invalid.
5. WHEN the user activates a Link button, THE Quick_Links SHALL open the associated URL in a new browser tab.
6. WHEN the user activates the delete control on a Link, THE Quick_Links SHALL remove the Link from the displayed list and from Storage.
7. WHEN the Dashboard loads and Storage contains a saved link array, THE Quick_Links SHALL restore and display all saved Links.
8. IF the displayed link list already contains 20 Links and the user submits a new Link, THEN THE Quick_Links SHALL not add the Link and SHALL display an inline message indicating the maximum number of Links has been reached.

---

### Requirement 7: Light / Dark Mode

**User Story:** As a user, I want to toggle between light and dark color schemes, so that I can use the dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a toggle control that switches the Theme between `light` and `dark` and displays the currently active Theme value.
2. WHEN the user activates the theme toggle, THE Dashboard SHALL apply the new Theme to all UI elements within 100 milliseconds without a page reload.
3. WHEN the Dashboard loads, THE Dashboard SHALL read the saved Theme from Storage and apply it before first render to prevent a flash of the wrong theme.
4. WHEN no Theme is saved in Storage, THE Dashboard SHALL apply the `light` Theme as the default.
5. WHEN the user changes the Theme, THE Dashboard SHALL save the new Theme value to Storage.
6. IF Storage is unavailable when saving the Theme, THEN THE Dashboard SHALL retain the new Theme for the current session without displaying an error to the user.

---

### Requirement 8: Data Persistence and Storage

**User Story:** As a user, I want all my data to be automatically saved in the browser, so that nothing is lost when I close or refresh the page.

#### Acceptance Criteria

1. THE Storage SHALL persist all user data (tasks, links, User_Name, Theme) using the browser's `localStorage` API under namespaced keys, where each key is prefixed with a consistent application-specific namespace (e.g., `dashboard_`) to avoid collisions with other scripts.
2. WHEN the Dashboard loads, THE Dashboard SHALL read all persisted data from Storage and render the UI state within 500ms of the page load event, before accepting user input.
3. WHEN any user data (tasks, links, User_Name, Theme) changes, THE Dashboard SHALL write the updated data to Storage within 300ms of the change event.
4. IF Storage is unavailable or throws an error on read, THEN THE Dashboard SHALL display a visible warning message and continue operating with default in-memory state, where tasks and links default to empty lists, User_Name defaults to an empty string, and Theme defaults to light mode.
5. IF Storage is unavailable or throws an error on write, THEN THE Dashboard SHALL display a visible warning message indicating that data will not be saved, and the in-memory state SHALL remain unaffected.

---

### Requirement 9: Layout, Responsiveness, and Performance

**User Story:** As a user, I want the dashboard to load quickly and look clean on any screen size, so that I can use it on desktop or as a browser extension without friction.

#### Acceptance Criteria

1. THE Dashboard SHALL load and render the initial view within 2 seconds on a connection with a minimum download speed of 10 Mbps.
2. THE Dashboard SHALL present all four widgets in a readable layout on viewport widths from 320px to 1920px, with no widget content clipped, overflowing its container, or requiring horizontal scrolling.
3. WHEN the user interacts with any UI control (button, input, toggle), THE Dashboard SHALL reflect the state change within 100ms of the interaction event.
4. THE Dashboard SHALL use exactly one CSS file located at `css/styles.css` and exactly one JavaScript file located at `js/app.js`.
5. THE Dashboard SHALL function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari, where "functions correctly" means all acceptance criteria in this specification pass without error in each browser.
