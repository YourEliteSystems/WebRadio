class ThemeProvider {

  constructor(loader) {
    this.loader = loader;
  }

  getThemes() {
    return this.loader.getThemes();
  }

}

module.exports = ThemeProvider;