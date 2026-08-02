module.exports = {
  context: null,

  init(context) {
    this.context = context;
    const logger = context.logger("DiscordRPC");

    // Initialisiere Storage
    if (!context.storage.exists()) {
      context.storage.set("initialized", true);
    }

    // Registriere Event-Listener
    context.events.on("play", this.handlePlay.bind(this, context));
    context.events.on("stop", this.handleStop.bind(this, context));
    context.events.on("metadata", this.handleMetadata.bind(this, context));

    logger.info("Discord RPC Integration initialized");
  },

  handlePlay(context, data) {
    const logger = context.logger;
    logger.debug("Discord RPC Integration: play event received");
  },

  handleStop(context) {
    const logger = context.logger;
    logger.debug("Discord RPC Integration: stop event received");
  },

  handleMetadata(context, data) {
    const logger = context.logger;
    logger.debug("Discord RPC Integration: metadata event received");
  },

  destroy() {
    const logger = this.context.logger;
    
    // Cleanup
    logger.info("Discord RPC Integration destroyed");
    this.context = null;
  }
};
