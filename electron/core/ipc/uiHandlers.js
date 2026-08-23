"use strict";

const { ipcMain } = require("electron");
const UIManager = require("../ui/UIManager");

function registerUiHandlers() {

    ipcMain.handle("ui:getPages", () => {

        return UIManager.getByType("page");

    });

}

module.exports = registerUiHandlers;