export function toThemeFileUrl(cssPath) {
  if (!cssPath) return '';
  return cssPath.startsWith('file://')
    ? cssPath
    : 'file:///' + cssPath.replace(/\\/g, '/');
}

export function applyThemeCss(cssPath) {
  const fileUrl = toThemeFileUrl(cssPath);
  if (!fileUrl) return '';

  let link = document.getElementById('theme-style');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'theme-style';
    document.head.appendChild(link);
  }
  link.href = fileUrl;
  return fileUrl;
}

export function resolveActiveTheme(themes, activeId) {
  if (!themes?.length) return null;
  if (activeId) {
    const saved = themes.find(t => t.id === activeId);
    if (saved) return saved;
  }
  return themes.find(t => t.id === 'default') || themes[0];
}

let isListeningForThemeChanges = false;

export function listenToThemeChanges(callback) {
  if (window.themeAPI?.onThemeChanged) {
    window.themeAPI.onThemeChanged((data) => {
      if (data?.css) {
        applyThemeCss(data.css);
      } else if (data?.themeId) {
        loadAndApplySavedTheme();
      }
      if (typeof callback === 'function') {
        callback(data);
      }
    });
    isListeningForThemeChanges = true;
  }
}

export async function loadAndApplySavedTheme() {
  if (!window.themeAPI?.getThemes) return null;

  if (!isListeningForThemeChanges) {
    listenToThemeChanges();
  }

  const [themes, activeId] = await Promise.all([
    window.themeAPI.getThemes(),
    window.themeAPI.getActiveTheme()
  ]);

  const theme = resolveActiveTheme(themes, activeId);
  if (!theme) return null;

  applyThemeCss(theme.css);
  return theme;
}
