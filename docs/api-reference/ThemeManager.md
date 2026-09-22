# ThemeManager

The `ThemeManager` is responsible for discovering, validating, loading and applying themes within WebRadio.

It acts as the central coordinator of the Theme System and ensures that only valid themes are available to users.

The ThemeManager is initialized during application startup by the `Application` class.

---

# Responsibilities

The ThemeManager is responsible for:

* Discovering installed themes
* Loading theme manifests
* Validating theme metadata
* Registering available themes
* Applying themes
* Switching active themes
* Removing themes
* Tracking the active theme
* Providing information about installed themes

Only one theme can be active at a time.

---

# Lifecycle

Every theme follows a predictable lifecycle.

```text id="pvqgq5"
Theme Directory

↓

Theme Discovery

↓

Manifest Loading

↓

Validation

↓

Registration

↓

Available

↓

Activated

↓

Applied

↓

Deactivated
```

The ThemeManager coordinates each stage.

---

# ThemeManager Access (1.0.7-alpha.1)

The ThemeManager is managed internally by WebRadio.

Plugins and application code should not instantiate a ThemeManager directly.

---

# Theme Discovery (current)

Theme discovery scans configured theme directories.

### Returns

```javascript id="gzc8qh"
Array<ThemeManifest>
```

Only valid theme manifests are returned.

---

# Theme Loading (current)

Theme loading performs:

* manifest loading
* validation
* theme registration

Themes are available after successful loading.

---

# Theme Application (current)

Activating a theme changes the active theme.

Applying a theme typically deactivates the currently active theme.

---

# Theme Status (current)

* `getTheme(themeId)` returns a theme or `undefined`
* `getThemes()` returns every registered theme
* `getActiveTheme()` returns the currently active theme or `null`
* `hasTheme(themeId)` checks whether a theme exists

---

# Theme Reload (current)

Theme reload is available for development and live preview use.

In WebRadio 1.0.7-alpha.1, theme management also supports:

* built-in themes
* user themes
* user-override behavior (user theme overrides a built-in theme with the same ID)
* theme reload without restarting the application

> **Hinweis:** Ein `webradio.json` als separates zentrales Theme-Manifest existiert in dieser Version nicht als allgemeine Konfigurationsdatei für das Theme-System.

---

# Theme States (1.0.7-alpha.1)

A theme may exist in one of the following states.

```text id="w0m7gn"
Discovered

Validated

Registered

Available

Active

Inactive

Failed
```

Only one theme can be active simultaneously.

---

# Validation (1.0.7-alpha.1)

Before registering a theme, the ThemeManager validates:

* Theme ID
* Theme name
* Manifest format
* CSS entry file
* Preview image (where required)
* Version
* Manifest structure

Invalid themes are skipped and reported through the logging system.

---

# Error Handling (1.0.7-alpha.1)

If a theme fails validation or loading:

* The error is logged.
* The theme is ignored.
* Remaining themes continue loading.

A broken theme should never prevent WebRadio from starting.

---

# Best Practices (1.0.7-alpha.1)

✔ Validate every theme before registration.

✔ Allow only one active theme.

✔ Reload themes without restarting the application when possible.

✔ Log validation errors clearly.

✔ Keep the active theme synchronized across all application windows.

---

# Common Mistakes (1.0.7-alpha.1)

Typical implementation issues include:

* Duplicate theme IDs.
* Missing stylesheet.
* Missing preview image.
* Invalid manifest.
* Broken asset references.
* Applying multiple themes simultaneously.

The ThemeManager should always maintain a consistent visual state.

---

# Related APIs (1.0.7-alpha.1)

The ThemeManager works closely with:

* Theme SDK
* Theme Manifest
* Theme CSS Variables
* Storage (for active theme persistence where applicable)
* Logger

---

# See Also

* Theme SDK
* Theme Manifest
* Theme CSS Variables
* ThemeManager architecture
