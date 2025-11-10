const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const feedManager = require('./feed-manager'); // Importar o módulo de gerenciamento de feeds
const path = require('path');
const url = require('url');

function createWindow () {
  // Cria a janela principal
  // Cria a janela principal
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Define a janela principal no feedManager
  feedManager.setMainWindow(mainWindow);

  // Carrega o index.html do aplicativo
  mainWindow.loadFile('index.html');

  // Abre o DevTools (opcional)
  // mainWindow.webContents.openDevTools();
}

// Função para exibir a notificação nativa
function showNotification(title, body, url) {
    new Notification({
        title: title,
        body: body
    }).show();
    
    // Abrir o link no navegador padrão ao clicar na notificação (opcional)
    // const notification = new Notification({ title: title, body: body });
    // notification.on('click', () => {
    //     require('electron').shell.openExternal(url);
    // });
    // notification.show();
}

// Este método será chamado quando o Electron terminar a inicialização
app.whenReady().then(() => {
  createWindow();

  // Inicia o monitoramento de feeds
  feedManager.startFeedMonitoring();

  // Escutar por novos posts do feed-manager
  ipcMain.on('new-post', (event, post) => {
    showNotification('Novo Post RSS: ' + post.feedUrl, post.title, post.link);
  });

  app.on('activate', function () {
    // No macOS é comum recriar uma janela no aplicativo quando o ícone do dock é clicado e não há outras janelas abertas.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Sair quando todas as janelas estiverem fechadas, exceto no macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- Lógica de Backend (Handlers IPC) ---
ipcMain.handle('add-feed', async (event, feedUrl) => {
    return await feedManager.addFeed(feedUrl);
});

ipcMain.handle('delete-feed', async (event, feedId) => {
    return await feedManager.deleteFeed(feedId);
});

ipcMain.handle('get-feeds', async () => {
    return await feedManager.getFeeds();
});
