const RPC = require("discord-rpc");
const eventBus = require("../eventBus");
const SettingsManager = require("../storage/SettingsManager");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("DiscordRichPresence");

const CLIENT_ID = "1512468839508476037";

class DiscordRichPresence {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.currentStation = null;
    this.startTimestamp = null;
    this.isEnabled = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.reconnectTimer = null;
  }

  initialize() {
    try {
      const settings = SettingsManager.get();
      this.isEnabled = settings.integrations?.discordRichPresence === true;

      if (this.isEnabled) {
        this.connect();
      }

      this.setupEventListeners();
      logger.info("Discord Rich Presence initialized");
    } catch (err) {
      logger.error("Failed to initialize Discord Rich Presence:", err);
    }
  }

  setupEventListeners() {
    eventBus.on("play", this.handlePlay.bind(this));
    eventBus.on("stop", this.handleStop.bind(this));
    eventBus.on("metadata", this.handleMetadata.bind(this));
  }

  removeEventListeners() {
    eventBus.off("play", this.handlePlay.bind(this));
    eventBus.off("stop", this.handleStop.bind(this));
    eventBus.off("metadata", this.handleMetadata.bind(this));
  }

  async connect() {
    if (this.client) {
      return;
    }

    try {
      this.client = new RPC.Client({ transport: "ipc" });

      this.client.on("ready", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info("Discord RPC connected");
      });

      this.client.on("disconnected", () => {
        this.isConnected = false;
        logger.warn("Discord RPC disconnected");
        this.scheduleReconnect();
      });

      await this.client.login({ clientId: CLIENT_ID });
    } catch (err) {
      logger.error("Failed to connect to Discord RPC:", err);
      this.client = null;
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.isEnabled) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnect attempts reached, giving up");
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.client = null;
      this.connect();
    }, delay);
  }

  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.client) {
      return;
    }

    try {
      await this.clearActivity();
      await this.client.destroy();
      this.client = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      logger.info("Discord RPC disconnected");
    } catch (err) {
      logger.error("Error disconnecting Discord RPC:", err);
    }
  }

  async setActivity(station, metadata = {}) {
    if (!this.client || !this.isConnected) {
      if (!this.client && this.isEnabled) {
        this.connect();
      }
      return;
    }

    try {
      const activity = {
        details: metadata.Song || metadata.StreamTitle || "Radio hören",
        state: metadata.Artist || station?.name || "WebRadio",
        startTimestamp: this.startTimestamp,
        largeImageKey: "logo",
        largeImageText: station?.name || "WebRadio",
        smallImageKey: "webradio",
        smallImageText: "WebRadio",
        instance: false
      };

      if (metadata.Album) {
        activity.assets = {
          largeImageKey: "logo",
          largeImageText: metadata.Album
        };
      }

      await this.client.setActivity(activity);
      logger.debug("Discord activity updated:", activity);
    } catch (err) {
      logger.error("Failed to set Discord activity:", err);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  async clearActivity() {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      await this.client.clearActivity();
      logger.debug("Discord activity cleared");
    } catch (err) {
      logger.error("Failed to clear Discord activity:", err);
    }
  }

  handlePlay(data) {
    if (!this.isEnabled) {
      return;
    }

    this.currentStation = data;
    this.startTimestamp = Date.now();

    if (!this.client) {
      this.connect();
    }

    this.setActivity(this.currentStation);
  }

  handleStop() {
    if (!this.isEnabled) {
      return;
    }

    this.currentStation = null;
    this.startTimestamp = null;
    this.clearActivity();
  }

  handleMetadata(metadata) {
    if (!this.isEnabled || !this.currentStation) {
      return;
    }

    this.setActivity(this.currentStation, metadata);
  }

  async updateSettings(settings) {
    const wasEnabled = this.isEnabled;
    this.isEnabled = settings.integrations?.discordRichPresence === true;

    if (this.isEnabled && !wasEnabled) {
      logger.info("Discord Rich Presence enabled");
      await this.connect();
    } else if (!this.isEnabled && wasEnabled) {
      logger.info("Discord Rich Presence disabled");
      await this.disconnect();
    }
  }

  async shutdown() {
    this.removeEventListeners();
    await this.disconnect();
    logger.info("Discord Rich Presence shutdown");
  }
}

module.exports = new DiscordRichPresence();
