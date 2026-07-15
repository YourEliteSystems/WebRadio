# Assets

The WebRadio Theme SDK allows themes to include additional assets such as fonts, icons, images and wallpapers.

These resources help create a unique visual identity while keeping the theme self-contained and portable.

Assets should always be organized in a structured way to ensure maintainability and compatibility.

---

# Overview

A typical theme may contain various asset types.

```text id="d4s1jv"
assets/

├── fonts/
├── icons/
├── images/
├── wallpapers/
└── logos/
```

Each directory serves a specific purpose.

---

# Fonts

Themes may include custom fonts.

Recommended structure:

```text id="a91hde"
assets/

└── fonts/

    ├── Inter-Regular.ttf
    ├── Inter-Bold.ttf
    └── LICENSE.txt
```

Register fonts using `@font-face`.

Example:

```css id="m7k2tz"
@font-face {

    font-family: "Inter";

    src: url("./assets/fonts/Inter-Regular.ttf");

    font-weight: 400;

}
```

Then reference the font through the public variable:

```css id="j3vcpq"
:root {

    --wr-font-family: "Inter", sans-serif;

}
```

---

# Icons

Themes may replace or extend icons where supported.

Recommended structure:

```text id="2xkzpc"
assets/

└── icons/

    ├── play.svg
    ├── pause.svg
    ├── settings.svg
    └── search.svg
```

SVG is recommended because it scales without quality loss.

---

# Images

Images may be used for decorative elements.

Examples include:

* Background textures
* Illustrations
* Empty-state graphics
* Decorative banners

Recommended structure:

```text id="rbt0ml"
assets/

└── images/

    ├── background.png
    ├── banner.jpg
    └── empty-state.svg
```

---

# Wallpapers

Some themes may provide optional wallpapers.

```text id="efru2p"
assets/

└── wallpapers/

    ├── dark.jpg
    ├── blue.jpg
    └── abstract.png
```

Wallpapers should complement the interface without reducing readability.

---

# Logos

Themes may optionally include branding assets.

```text id="8s2nux"
assets/

└── logos/

    ├── logo-light.svg
    └── logo-dark.svg
```

Logo usage depends on future Theme SDK capabilities.

---

# File Formats

Recommended formats:

| Asset      | Recommended Format |
| ---------- | ------------------ |
| Icons      | SVG                |
| Images     | PNG, WebP          |
| Wallpapers | JPG, WebP          |
| Logos      | SVG                |
| Fonts      | TTF, OTF, WOFF2    |

Choose modern formats whenever possible.

---

# Asset References

Reference assets using relative paths.

Example:

```css id="uwg6ar"
background-image:

url("./assets/images/background.png");
```

Keeping all assets inside the theme directory ensures portability.

---

# Performance

Large assets increase loading times.

Recommendations:

* Optimize PNG files.
* Prefer SVG for icons.
* Compress wallpapers.
* Remove unused resources.
* Avoid duplicate files.

Smaller themes load faster and consume less memory.

---

# Accessibility

When using custom assets:

* Maintain sufficient contrast.
* Avoid distracting backgrounds.
* Ensure icons remain recognizable.
* Test readability on different screen sizes.

Visual design should never reduce usability.

---

# Best Practices

✔ Use SVG for icons.

✔ Compress images before publishing.

✔ Keep filenames descriptive.

✔ Organize assets by type.

✔ Include font licenses where required.

✔ Remove unused assets before release.

---

# Common Mistakes

Typical issues include:

* Oversized images.
* Missing font files.
* Broken relative paths.
* Mixing unrelated asset types.
* Including unused resources.

Keeping assets organized improves both maintenance and performance.

---

# Future Improvements

Future Theme SDK versions may support additional asset types such as:

* Animated backgrounds
* Custom cursors
* Sound effects
* Startup animations
* Video backgrounds
* Lottie animations

These features will be introduced in a backwards-compatible manner whenever possible.

---

# Next Step

Continue with **Best Practices** to learn how to create professional, consistent and future-proof WebRadio themes.
