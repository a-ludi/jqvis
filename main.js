const { app, BrowserWindow } = require('electron')

function createWindow()
{
  // Erstelle das Browser-Fenster.
  const win = new BrowserWindow({
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

app.on('ready', createWindow);
