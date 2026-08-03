const { SettingsStore } = require("./settings-store");

const settings = new SettingsStore();
settings.update({ agentLocked:false });
console.log("Vertex remote access is unlocked for paired devices.");
