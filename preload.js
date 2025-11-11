const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getFeeds: () => ipcRenderer.invoke('get-feeds'),
    addFeed: (feedUrl) => ipcRenderer.invoke('add-feed', feedUrl),
    deleteFeed: (feedUrl) => ipcRenderer.invoke('delete-feed', feedUrl),
    getFeedErrors: () => ipcRenderer.invoke('get-feed-errors'),
    getFeedInfo: () => ipcRenderer.invoke('get-feed-info'),
    openLink: (link) => ipcRenderer.invoke('open-link', link),
    sendTestNotification: () => ipcRenderer.invoke('send-test-notification'), // Adiciona a função de teste de notificação
    onFeedsChecked: (callback) => ipcRenderer.on('feeds-checked', callback),
});
