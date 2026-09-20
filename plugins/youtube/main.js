module.exports = {
  context: null,

  init(context) {
    this.context = context;
    const logger = context.logger;

    // Plugin-Storage initialisieren
    if (!context.storage.exists()) {
      context.storage.set("searchHistory", []);
      context.storage.set("volume", 100);
      context.storage.set("autoplay", true);
    }

    // Unified Player API: MediaHub Provider aktivieren
    if (context.player && context.player.setActiveProvider) {
      context.player.setActiveProvider("mediahub");
      logger.info("MediaHub Provider aktiviert");
    }

    // HTTP Server URL für Plugin-Ressourcen
    if (context.httpOrigin) {
      logger.info(`Plugin HTTP Origin: ${context.httpOrigin}`);
    }

    logger.info("YouTube Integration Plugin initialized");
  },

  onPlay(data, context) {
    // Wenn YouTube Video spielt, Metadaten speichern
    if (context && data && data.source === "youtube") {
      context.storage.set("lastPlayed", {
        videoId: data.videoId,
        title: data.title,
        timestamp: Date.now()
      });
    }
  },

  onStop(context) {
    // Cleanup bei Stopp - keine Aktion nötig
  },

  onVolumeChange(volume, context) {
    // Lautstärke speichern
    if (context) {
      context.storage.set("volume", volume);
    }
  },

  destroy() {
    // Cleanup beim Deaktivieren
    // Unified Player API: MediaHub Provider deaktivieren
    if (this.context && this.context.player && this.context.player.setActiveProvider) {
      this.context.player.setActiveProvider("radio"); // Zurück zu Radio
    }
    
    this.context = null;
  }
};
