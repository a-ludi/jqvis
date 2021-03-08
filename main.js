const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require('electron');
const fs = require('fs');
let win;

function createWindow()
{
  // Erstelle das Browser-Fenster.
  win = new BrowserWindow({
    icon: 'icon.png',
    backgroundColor: "#D6D8DC",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
        nodeIntegration: true,
    },
  });

  // and load the index.html of the app.
  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
}

ipcMain.on('openFile', async (event, options) => {
  console.log('Received event `openFile`');
  let { canceled, filePaths } = await dialog.showOpenDialog(win, options);

  if (!canceled)
    event.reply('fileNames', filePaths);
});

app.on('ready', createWindow);
