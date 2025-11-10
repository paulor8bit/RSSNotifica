const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Funções para gerenciar feeds (a serem implementadas no main.js)
  addFeed: (feedUrl) => ipcRenderer.invoke('add-feed', feedUrl),
  deleteFeed: (feedId) => ipcRenderer.invoke('delete-feed', feedId),
  getFeeds: () => ipcRenderer.invoke('get-feeds'),
  
  // Funções para comunicação de eventos (a serem implementadas no main.js)
  onNewPost: (callback) => ipcRenderer.on('new-post', (event, post) => callback(post)),
  onFeedsUpdated: (callback) => ipcRenderer.on('feeds-updated', (event, feeds) => callback(feeds))
});
