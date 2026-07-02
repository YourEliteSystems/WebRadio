ipcMain.handle("ui:getPages", () => {

    return UIManager.getByType("page");

});