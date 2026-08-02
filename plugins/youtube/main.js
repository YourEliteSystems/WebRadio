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
    this.context = null;
  }
};
