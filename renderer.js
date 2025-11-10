// Lógica de Frontend para interagir com o main process via contextBridge

const form = document.getElementById('add-feed-form');
const feedUrlInput = document.getElementById('feed-url');
const feedListDiv = document.getElementById('feed-list');

// Função para renderizar a lista de feeds
function renderFeeds(feeds) {
    feedListDiv.innerHTML = '';
    if (feeds.length === 0) {
        feedListDiv.innerHTML = '<p>Nenhum feed adicionado ainda.</p>';
        return;
    }

    feeds.forEach(feed => {
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `
            <span>${feed.url}</span>
            <button data-id="${feed._id}">Deletar</button>
        `;
        feedListDiv.appendChild(item);
    });
}

// Lidar com o envio do formulário para adicionar um novo feed
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedUrl = feedUrlInput.value;
    try {
        const result = await window.electronAPI.addFeed(feedUrl);
        if (result.success) {
            alert('Feed adicionado com sucesso!');
            feedUrlInput.value = '';
            // A lista será atualizada automaticamente pelo evento 'feeds-updated'
        } else {
            alert(`Erro ao adicionar feed: ${result.message}`);
        }
    } catch (error) {
        console.error('Erro ao adicionar feed:', error);
        alert('Ocorreu um erro ao tentar adicionar o feed.');
    }
});

// Lidar com o clique no botão de deletar
feedListDiv.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON') {
        const feedId = e.target.dataset.id;
        if (confirm('Tem certeza que deseja deletar este feed?')) {
            try {
                const result = await window.electronAPI.deleteFeed(feedId);
                if (result.success) {
                    alert('Feed deletado com sucesso!');
                    // A lista será atualizada automaticamente pelo evento 'feeds-updated'
                } else {
                    alert(`Erro ao deletar feed: ${result.message}`);
                }
            } catch (error) {
                console.error('Erro ao deletar feed:', error);
                alert('Ocorreu um erro ao tentar deletar o feed.');
            }
        }
    }
});

// Inicialização: Carregar feeds existentes
async function loadFeeds() {
    try {
        const feeds = await window.electronAPI.getFeeds();
        renderFeeds(feeds);
    } catch (error) {
        console.error('Erro ao carregar feeds:', error);
        feedListDiv.innerHTML = '<p>Erro ao carregar feeds.</p>';
    }
}

// Escutar por atualizações na lista de feeds
window.electronAPI.onFeedsUpdated((feeds) => {
    renderFeeds(feeds);
});

// Escutar por novos posts para exibir notificações (apenas para fins de demonstração, a notificação real será no main process)
window.electronAPI.onNewPost((post) => {
    console.log('Novo post recebido:', post);
    // No aplicativo final, a notificação será exibida pelo main process.
    // Aqui, podemos apenas logar ou atualizar um status na UI.
});

loadFeeds();
