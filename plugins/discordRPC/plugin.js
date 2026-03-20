const RPC = require("discord-rpc");
const clientId = "1482831973826301972";
const rpc = new RPC.Client({ transport: "ipc" });
let startTimestamp = new Date();

module.exports = {
  init() {
    rpc.on("ready", () => {
      console.log("Discord RPC verbunden");
    });
    rpc.login({ clientId }).catch(console.error);
  },
  onMetadata(meta) {
    rpc.setActivity({
      details: meta.StreamTitle || "Radio hören",
      state: meta.station || "WebRadio",
      startTimestamp,
      largeImageKey: "radio",
      largeImageText: "WebRadio",
      instance:false
    });
  },
  initRenderer(){
    const area = document.getElementById("plugin-area");
    if(!area) return;
    const badge = document.createElement("div");
    badge.className = "plugin-badge";
    badge.textContent = "Discord verbunden";
    area.appendChild(badge);
  }
};