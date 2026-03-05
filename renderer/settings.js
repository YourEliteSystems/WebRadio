import { ipcRenderer } from "electron";

const autostartCheckbox = document.getElementById("autostart");
const startMinimizedCheckbox = document.getElementById("startMinimized");
const mediaKeysCheckbox = document.getElementById("mediaKeys");
const saveBtn = document.getElementById("saveBtn");

// Einstellungen laden
ipcRenderer.invoke("load-settings").then(settings => {
  autostartCheckbox.checked = settings.autostart;
  startMinimizedCheckbox.checked = settings.startMinimized;
  mediaKeysCheckbox.checked = settings.mediaKeys;
});

// Speichern
saveBtn.onclick = () => {
  const newSettings = {
    autostart: autostartCheckbox.checked,
    startMinimized: startMinimizedCheckbox.checked,
    mediaKeys: mediaKeysCheckbox.checked
  };
  ipcRenderer.invoke("save-settings", newSettings);
  alert("Einstellungen gespeichert");
};
