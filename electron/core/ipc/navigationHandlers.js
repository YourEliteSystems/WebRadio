"use strict";

const { ipcMain } = require("electron");
const NavigationManager = require("../navigation/NavigationManager");

function registerNavigationHandlers() {

    ipcMain.handle("navigation:getTree", () => {
        return NavigationManager.getTree();
    });

    ipcMain.handle("navigation:getSections", () => {
        return NavigationManager.getSections();
    });

    ipcMain.handle("navigation:getItems", (_, sectionId) => {
        return NavigationManager.getItems(sectionId);
    });

    ipcMain.handle("navigation:registerSection", (_, section, pluginId = "renderer") => {
        return NavigationManager.registerSection(section, pluginId);
    });

    ipcMain.handle("navigation:registerItem", (_, item, pluginId = "renderer") => {
        return NavigationManager.registerItem(item, pluginId);
    });

    ipcMain.handle("navigation:updateItem", (_, id, updates, pluginId = "renderer") => {
        return NavigationManager.updateItem(id, updates, pluginId);
    });

    ipcMain.handle("navigation:removeItem", (_, id, pluginId = "renderer") => {
        return NavigationManager.removeItem(id, pluginId);
    });

    ipcMain.handle("navigation:removeSection", (_, id, pluginId = "renderer") => {
        return NavigationManager.removeSection(id, pluginId);
    });

}

module.exports = registerNavigationHandlers;
