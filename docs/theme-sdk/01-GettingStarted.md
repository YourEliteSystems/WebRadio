# Getting Started

Welcome to the WebRadio Theme SDK.

In this guide you will create your first custom theme and learn how WebRadio discovers, validates and applies themes.

By the end of this chapter you will have a working theme that can be selected inside WebRadio.

---

# Before You Begin

Before creating your first theme, make sure you have:

* WebRadio installed
* Access to the themes directory
* A code editor (for example Visual Studio Code)
* Basic knowledge of CSS

No JavaScript knowledge is required for basic theme development.

---

# Theme Directory

All themes are stored inside the application's themes directory.

```text
themes/

├── Default/
├── Midnight/
├── Glass/
└── ...
```

Each theme is located inside its own directory.

---

# Creating Your First Theme

Create a new directory inside the themes folder.

```text
themes/

└── MyTheme/
```

This directory will contain all files belonging to your theme.

---

# Create the Theme Manifest

Every theme requires a `theme.json`.

Example:

```json
{
    "id": "my-theme",
    "name": "My Theme",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "My first WebRadio theme.",
    "css": "variables.css"
}
```

The manifest tells WebRadio how to identify and load your theme.

The manifest format is explained in detail in the next chapter.

---

# Create the CSS File

Create a file called:

```text
variables.css
```

Inside the file define your first CSS variables.

Example:

```css
:root {

    --color-primary: #3b82f6;

    --color-background: #1b1b1b;

    --color-surface: #252525;

    --color-text: #ffffff;

}
```

These variables will override the application's default appearance.

---

# Project Structure

Your first theme should now look like this:

```text
MyTheme/

├── theme.json
└── variables.css
```

As your theme grows, additional folders may be added for assets such as icons, fonts and images.

---

# Starting WebRadio

Launch WebRadio normally.

During startup the ThemeManager will:

1. Discover the theme.
2. Read the theme manifest.
3. Validate the manifest.
4. Load the CSS file.
5. Register the theme.

If everything is configured correctly, your theme is now available.

---

# Activating Your Theme

Open the application settings and navigate to the **Appearance** section.

Select your newly created theme from the available themes.

Once selected, WebRadio immediately applies the new styling.

---

# Verifying Your Theme

A successful startup typically follows this sequence:

```text
Theme discovered

↓

Manifest validated

↓

CSS loaded

↓

Theme registered

↓

Theme applied
```

If your colors are visible inside the application, your theme has been loaded successfully.

---

# Common Mistakes

The most common issues are:

* Missing `theme.json`
* Invalid JSON syntax
* Incorrect CSS filename
* Missing CSS variables
* CSS syntax errors

If a theme cannot be loaded, review the Diagnostics log for detailed information.

---

# Next Step

Congratulations!

You have created your first WebRadio theme.

Continue with **Theme Manifest** to learn about every field supported by `theme.json`.
