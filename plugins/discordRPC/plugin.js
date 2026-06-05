const RPC = require("discord-rpc");
const clientId = "1512468839508476037";
let rpc = null;
let startTimestamp = new Date();

module.exports = {
  init() {
    if (!rpc) {
      rpc = new RPC.Client({ transport: "ipc" });
      rpc.on("ready", () => {
        console.log("Discord RPC verbunden");
      });
      rpc.login({ clientId }).catch(console.error);
    }
  },
  onMetadata(meta) {
    if (rpc) {
      rpc.setActivity({
        details: meta.StreamTitle || "Radio hören",
        state: meta.station || "WebRadio",
        startTimestamp,
        largeImageKey: "logo",
        largeImageText: "WebRadio",
        instance: false
      }).catch(console.error);
    }
  },
  onStop() {
    if (rpc) {
      rpc.clearActivity().catch(console.error);
    }
  },
  destroy() {
    if (rpc) {
      rpc.clearActivity().catch(console.error);
      rpc.destroy().catch(console.error);
      rpc = null;
    }
  }
};