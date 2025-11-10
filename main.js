import { app, BrowserWindow, ipcMain, Notification, nativeTheme, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import RSSParser from 'rss-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store({
    defaults: {
        feeds: [],
        lastChecked: {},
        feedErrors: {},
        feedInfo: {}
    }
});
const parser = new RSSParser();

let mainWindow;

// Set the theme to dark
nativeTheme.themeSource = 'dark';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Start checking RSS feeds periodically
    checkFeeds(); // Check once on startup
    setInterval(checkFeeds, 60 * 1000); // Check every minute
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('get-feeds', () => {
    return store.get('feeds', []);
});

ipcMain.handle('get-feed-errors', () => {
    return store.get('feedErrors', {});
});

ipcMain.handle('get-feed-info', () => {
    return store.get('feedInfo', {});
});

ipcMain.handle('open-link', (event, link) => {
    shell.openExternal(link);
});

ipcMain.handle('add-feed', (event, feedUrl) => {
    const feeds = store.get('feeds', []);
    if (!feeds.includes(feedUrl)) {
        feeds.push(feedUrl);
        store.set('feeds', feeds);
        checkFeeds(); // Check the new feed immediately
    }
    return feeds;
});

ipcMain.handle('delete-feed', (event, feedUrl) => {
    let feeds = store.get('feeds', []);
    feeds = feeds.filter(feed => feed !== feedUrl);
    store.set('feeds', feeds);

    const feedErrors = store.get('feedErrors', {});
    delete feedErrors[feedUrl];
    store.set('feedErrors', feedErrors);

    const feedInfo = store.get('feedInfo', {});
    delete feedInfo[feedUrl];
    store.set('feedInfo', feedInfo);

    return feeds;
});

async function checkFeeds() {
    const feeds = store.get('feeds', []);
    const lastChecked = store.get('lastChecked', {});
    const feedErrors = store.get('feedErrors', {});
    const feedInfo = store.get('feedInfo', {});

    for (const feedUrl of feeds) {
        try {
            const feed = await parser.parseURL(feedUrl);
            const latestPost = feed.items[0];

            if (feedErrors[feedUrl]) {
                delete feedErrors[feedUrl]; // Clear error on success
            }

            if (latestPost) {
                feedInfo[feedUrl] = {
                    title: latestPost.title,
                    date: new Date(latestPost.pubDate).toLocaleString(),
                    link: latestPost.link
                };

                const feedLastChecked = lastChecked[feedUrl];
                if (!feedLastChecked || new Date(latestPost.pubDate) > new Date(feedLastChecked)) {
                    new Notification({
                        title: `Novo post em ${feed.title}`,
                        body: latestPost.title,
                        silent: false,
                    }).show();
                    lastChecked[feedUrl] = latestPost.pubDate;
                }
            }
        } catch (error) {
            console.error(`Erro ao verificar o feed ${feedUrl}:`, error);
            feedErrors[feedUrl] = 'Não foi possível carregar o feed. Verifique a URL.';
        }
    }
    store.set('lastChecked', lastChecked);
    store.set('feedErrors', feedErrors);
    store.set('feedInfo', feedInfo);
    // Notify the renderer process that the feeds have been checked
    if(mainWindow) {
        mainWindow.webContents.send('feeds-checked');
    }
}
