# Frequently Asked Questions (FAQ)

This chapter answers the most common questions about creating themes for WebRadio.

If your theme does not work as expected, you will likely find the solution here.

---

# My theme is not detected.

### Possible causes

* The theme directory is incorrect.
* `theme.json` is missing.
* The manifest contains invalid JSON.
* The theme failed validation.

### Solution

Verify that your theme follows the recommended directory structure.

```text
MyTheme/

├── theme.json
├── variables.css
└── preview.png
```

Review the Diagnostics log for detailed error information.

---

# My theme does not appear in WebRadio.

Possible reasons include:

* Invalid theme ID
* Duplicate theme ID
* Manifest validation failed
* Missing stylesheet

Check the application logs for additional details.

---

# My CSS changes are not applied.

Possible causes:

* Incorrect CSS filename
* Wrong path inside `theme.json`
* CSS syntax error
* Browser cache (during development)

Verify that the `css` property points to the correct file.

Example:

```json
{
    "css": "variables.css"
}
```

---

# My preview image is missing.

Ensure that:

* `preview.png` exists.
* The filename matches the manifest.
* The image format is supported.
* The image is not corrupted.

Recommended format:

* PNG
* 1280 × 720 pixels

---

# My custom font does not load.

Check the following:

* Font file exists.
* Relative path is correct.
* `@font-face` is configured correctly.
* File format is supported.

Example:

```css
@font-face {

    font-family: "Inter";

    src: url("./assets/fonts/Inter-Regular.ttf");

}
```

---

# My icons are missing.

Verify:

* The SVG files exist.
* Relative paths are correct.
* File names match exactly.
* Icons are included in the theme package.

SVG is the recommended icon format.

---

# Can I modify WebRadio's HTML?

No.

Themes should only modify presentation through the public Theme SDK.

Changing application internals is unsupported and may break after updates.

---

# Can I use JavaScript inside a theme?

No.

Themes are intended for visual customization only.

Application logic belongs inside plugins.

---

# Can I create Light and Dark themes?

Yes.

You may provide separate themes or implement both styles within a single theme if supported by future Theme SDK features.

---

# Can themes include images?

Yes.

Themes may include:

* Icons
* Wallpapers
* Background images
* Logos
* Decorative graphics

All assets should remain inside the theme directory.

---

# Can themes include custom fonts?

Yes.

Supported font formats include:

* TTF
* OTF
* WOFF2

Include the appropriate license where required.

---

# Why should I use CSS variables?

CSS variables provide:

* Better compatibility
* Easier maintenance
* Cleaner code
* Future-proof themes

Themes should avoid overriding internal selectors whenever possible.

---

# My colors look different on another monitor.

This is normal.

Different displays use different color calibration.

Always test your theme on multiple displays when possible.

---

# My theme looks broken after a WebRadio update.

Possible reasons include:

* Deprecated variables
* Unsupported internal CSS overrides
* Outdated theme version

Always use the documented public CSS variables to minimize compatibility issues.

---

# How do I distribute my theme?

Recommended methods include:

* GitHub
* GitLab
* Project website
* Future WebRadio Theme Marketplace

Include:

* README
* License
* Preview image
* Changelog

---

# Theme Development Checklist

Before publishing your theme:

```text
✓ Valid theme.json

✓ CSS loads correctly

✓ Uses official CSS variables

✓ Preview image included

✓ Assets organized

✓ Responsive layout

✓ Accessible colors

✓ Optimized images

✓ Documentation included

✓ Tested on latest WebRadio version
```

---

# Where can I get help?

Useful resources include:

* Theme SDK
* Plugin SDK
* Architecture documentation
* GitHub Issues
* GitHub Discussions

These resources should answer most questions related to theme development.

---

# Congratulations

You have completed the WebRadio Theme SDK.

You should now understand:

* Theme structure
* Theme manifests
* CSS variables
* Component styling
* Asset management
* Best practices
* Complete example themes

You are now ready to design professional themes for WebRadio.
