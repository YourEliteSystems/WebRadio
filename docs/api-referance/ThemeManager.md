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

# Constructor

The ThemeManager is created internally by WebRadio.

Applications and plugins should never instantiate a ThemeManager directly.

Example:

```javascript id="w6tfxh"
const themeManager = new ThemeManager();
```

Normally, themes are managed automatically during application startup.

---

# Methods

## discoverThemes()

Searches the configured theme directory for available themes.

### Syntax

```javascript id="krnyd7"
const themes = await themeManager.discoverThemes();
```

### Returns

```javascript id="gzc8qh"
Array<ThemeManifest>
```

Only valid theme manifests are returned.

---

## loadThemes()

Loads every discovered theme.

### Syntax

```javascript id="o3m79m"
await themeManager.loadThemes();
```

This method performs:

* Manifest loading
* Validation
* Theme registration

Themes are available after successful loading.

---

## applyTheme()

Activates a theme.

### Syntax

```javascript id="b3gsb4"
await themeManager.applyTheme(themeId);
```

Applying a theme automatically deactivates the currently active theme.

---

## getTheme()

Returns a theme by its unique identifier.

### Syntax

```javascript id="r2r4n9"
const theme = themeManager.getTheme(themeId);
```

### Returns

```javascript id="jghn5d"
Theme | undefined
```

---

## getThemes()

Returns every registered theme.

### Syntax

```javascript id="pypsq2"
const themes = themeManager.getThemes();
```

### Returns

```javascript id="4m3jjq"
Array<Theme>
```

---

## getActiveTheme()

Returns the currently active theme.

### Syntax

```javascript id="m9b8mf"
const activeTheme = themeManager.getActiveTheme();
```

### Returns

```javascript id="mv3ncb"
Theme | null
```

---

## hasTheme()

Checks whether a theme exists.

### Syntax

```javascript id="z9v0yx"
themeManager.hasTheme(themeId);
```

### Returns

```javascript id="ub13j6"
Boolean
```

---

## reloadTheme()

Reloads a theme.

### Syntax

```javascript id="bx3kzu"
await themeManager.reloadTheme(themeId);
```

Reloading is primarily intended for development and live preview functionality.

---

# Theme States

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

# Validation

Before registering a theme, the ThemeManager validates:

* Theme ID
* Theme name
* Manifest format
* CSS entry file
* Preview image
* Version
* Asset paths
* SDK compatibility

Invalid themes are skipped and reported through the logging system.

---

# Error Handling

If a theme fails validation or loading:

* The error is logged.
* The theme is ignored.
* Remaining themes continue loading.

A broken theme should never prevent WebRadio from starting.

---

# Best Practices

✔ Validate every theme before registration.

✔ Allow only one active theme.

✔ Reload themes without restarting the application when possible.

✔ Log validation errors clearly.

✔ Keep the active theme synchronized across all application windows.

---

# Common Mistakes

Typical implementation issues include:

* Duplicate theme IDs.
* Missing stylesheet.
* Missing preview image.
* Invalid manifest.
* Broken asset references.
* Applying multiple themes simultaneously.

The ThemeManager should always maintain a consistent visual state.

---

# Related APIs

The ThemeManager works closely with:

* Theme
* ThemeLoader
* ThemeValidator
* Application
* Storage
* Logger

Together these components form the WebRadio Theme System.

---

# Example

```javascript id="paxhjg"
await themeManager.loadThemes();

await themeManager.applyTheme("midnight");

const activeTheme = themeManager.getActiveTheme();
```

---

# See Also

* Theme
* ThemeLoader
* ThemeValidator
* Application
* Logger
* Storage
* Theme SDK
