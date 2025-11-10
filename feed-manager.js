const Datastore = require('nedb');
const FeedParser = require('feedparser');
const request = require('request'); // para fazer a requisição HTTP

// Inicializa o banco de dados Nedb para armazenar os feeds
const db = new Datastore({ filename: 'feeds.db', autoload: true });

// Intervalo de verificação (em milissegundos) - 5 minutos
const CHECK_INTERVAL = 5 * 60 * 1000; 

let mainWindow = null; // Referência para a janela principal do Electron

/**
 * Define a janela principal para que possamos enviar eventos para o frontend.
 * @param {BrowserWindow} window - A janela principal do Electron.
 */
function setMainWindow(window) {
    mainWindow = window;
}

/**
 * Envia a lista atualizada de feeds para o frontend.
 */
function sendFeedsUpdate() {
    db.find({}).sort({ url: 1 }).exec((err, feeds) => {
        if (err) {
            console.error('Erro ao buscar feeds:', err);
            return;
        }
        if (mainWindow) {
            mainWindow.webContents.send('feeds-updated', feeds);
        }
    });
}

/**
 * Adiciona um novo feed ao banco de dados.
 * @param {string} feedUrl - A URL do feed RSS.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function addFeed(feedUrl) {
    return new Promise((resolve) => {
        // 1. Verificar se o feed já existe
        db.findOne({ url: feedUrl }, (err, doc) => {
            if (err) {
                console.error('Erro ao buscar feed:', err);
                return resolve({ success: false, message: 'Erro interno do banco de dados.' });
            }
            if (doc) {
                return resolve({ success: false, message: 'Este feed já está cadastrado.' });
            }

            // 2. Tentar parsear o feed para validar a URL
            const req = request(feedUrl, { timeout: 10000, pool: false });
            req.setMaxListeners(50);
            req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36');
            req.setHeader('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');

            const feedparser = new FeedParser();

            req.on('error', (error) => {
                console.error('Erro na requisição do feed:', error);
                resolve({ success: false, message: 'Erro ao conectar com a URL do feed.' });
            });

            req.on('response', function (res) {
                if (res.statusCode !== 200) {
                    this.emit('error', new Error('Bad status code'));
                } else {
                    this.pipe(feedparser);
                }
            });

            feedparser.on('error', (error) => {
                console.error('Erro ao parsear feed:', error);
                resolve({ success: false, message: 'URL não parece ser um feed RSS/Atom válido.' });
            });

            feedparser.on('readable', function () {
                // Se chegou aqui, o feed é válido.
                // Parar o parsing e salvar no banco.
                req.abort(); 

                // 3. Inserir no banco de dados
                const newFeed = {
                    url: feedUrl,
                    lastCheck: new Date(),
                    lastPostTitle: null,
                    lastPostLink: null
                };

                db.insert(newFeed, (err, newDoc) => {
                    if (err) {
                        console.error('Erro ao inserir feed:', err);
                        return resolve({ success: false, message: 'Erro ao salvar no banco de dados.' });
                    }
                    sendFeedsUpdate(); // Notifica o frontend
                    resolve({ success: true, message: 'Feed adicionado com sucesso.' });
                });
            });
        });
    });
}

/**
 * Deleta um feed do banco de dados.
 * @param {string} feedId - O ID do feed a ser deletado.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function deleteFeed(feedId) {
    return new Promise((resolve) => {
        db.remove({ _id: feedId }, {}, (err, numRemoved) => {
            if (err) {
                console.error('Erro ao deletar feed:', err);
                return resolve({ success: false, message: 'Erro ao deletar do banco de dados.' });
            }
            if (numRemoved === 0) {
                return resolve({ success: false, message: 'Feed não encontrado.' });
            }
            sendFeedsUpdate(); // Notifica o frontend
            resolve({ success: true, message: 'Feed deletado com sucesso.' });
        });
    });
}

/**
 * Retorna todos os feeds do banco de dados.
 * @returns {Promise<Array>}
 */
async function getFeeds() {
    return new Promise((resolve, reject) => {
        db.find({}).sort({ url: 1 }).exec((err, docs) => {
            if (err) {
                console.error('Erro ao buscar feeds:', err);
                return reject(err);
            }
            resolve(docs);
        });
    });
}

/**
 * Verifica um feed específico por novos posts.
 * @param {object} feed - O objeto feed do banco de dados.
 */
function checkFeed(feed) {
    const req = request(feed.url, { timeout: 10000, pool: false });
    req.setMaxListeners(50);
    req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36');
    req.setHeader('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');

    const feedparser = new FeedParser();
    let newPostFound = false;
    let latestPost = null;

    req.on('error', (error) => {
        console.error(`Erro ao verificar feed ${feed.url}:`, error.message);
    });

    req.on('response', function (res) {
        if (res.statusCode !== 200) {
            this.emit('error', new Error('Bad status code'));
        } else {
            this.pipe(feedparser);
        }
    });

    feedparser.on('error', (error) => {
        console.error(`Erro ao parsear feed ${feed.url}:`, error.message);
    });

    feedparser.on('readable', function () {
        let item;
        while (item = this.read()) {
            // O FeedParser retorna os itens em ordem cronológica (mais antigo primeiro).
            // Vamos apenas pegar o primeiro item que é o mais recente.
            if (!latestPost) {
                latestPost = {
                    title: item.title,
                    link: item.link,
                    date: item.date || new Date()
                };
            }

            // Se o título do post mais recente for diferente do último post salvo, é um novo post.
            if (feed.lastPostTitle && item.title === feed.lastPostTitle) {
                // Encontramos o último post conhecido, podemos parar.
                break;
            }

            // Se for um post mais recente que o último salvo (ou se for o primeiro check)
            if (feed.lastPostTitle !== item.title) {
                newPostFound = true;
                // Envia notificação (será implementado na próxima fase)
                if (mainWindow) {
                    // Usamos ipcMain.send para enviar para o processo principal, que irá exibir a notificação
                    // O mainWindow.webContents.send envia para o processo de renderização, o que não é o ideal para notificações nativas
                    // No entanto, como o main.js está escutando em ipcMain.on, vamos usar o send do webContents
                    // para que o evento chegue ao main process.
                    // O evento 'new-post' é escutado no main.js, que por sua vez chama showNotification.
                    mainWindow.webContents.send('new-post', {
                        title: item.title,
                        link: item.link,
                        feedUrl: feed.url
                    });
                }
            }
        }
    });

    feedparser.on('end', () => {
        // Se encontramos um novo post, ou se é a primeira vez que verificamos, atualizamos o feed.
        if (latestPost) {
            db.update({ _id: feed._id }, { $set: {
                lastCheck: new Date(),
                lastPostTitle: latestPost.title,
                lastPostLink: latestPost.link
            }}, {}, (err, numReplaced) => {
                if (err) console.error('Erro ao atualizar feed:', err);
            });
        }
    });
}

/**
 * Inicia o loop de monitoramento de feeds.
 */
function startFeedMonitoring() {
    console.log('Iniciando monitoramento de feeds...');
    
    // Função que verifica todos os feeds
    const monitor = () => {
        db.find({}, (err, feeds) => {
            if (err) {
                console.error('Erro ao buscar feeds para monitoramento:', err);
                return;
            }
            feeds.forEach(checkFeed);
        });
    };

    // Executa a primeira verificação imediatamente
    monitor();

    // Configura o intervalo de verificação
    setInterval(monitor, CHECK_INTERVAL);
}

module.exports = {
    setMainWindow,
    addFeed,
    deleteFeed,
    getFeeds,
    startFeedMonitoring,
    sendFeedsUpdate
};
