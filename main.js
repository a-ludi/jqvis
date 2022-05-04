const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require('electron');
const { writeFile } = require('fs').promises;
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
        contextIsolation: false,
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

ipcMain.on('saveFile', async (event, contents, options) => {
  console.log('Received event `saveFile`');
  const { canceled, filePath } = await dialog.showSaveDialog(win, options);
  const reply = {
    cancelled: canceled,
    fileName: filePath,
    error: null,
  };

  if (!canceled)
  {
    try
    {
      if (typeof(contents) === 'function')
        await writeFile(filePath, contents());
      else
        await writeFile(filePath, contents);
    }
    catch (err)
    {
      reply.error = err;
    }
  }

  event.reply('fileWritten', reply);
});

app.on('ready', createWindow);
