document.addEventListener('DOMContentLoaded', async () => {
    const feedUrlInput = document.getElementById('feed-url-input');
    const addFeedButton = document.getElementById('add-feed-button');
    const feedList = document.getElementById('feed-list');

    const renderFeeds = async () => {
        const [feeds, feedErrors, feedInfo] = await Promise.all([
            window.electronAPI.getFeeds(),
            window.electronAPI.getFeedErrors(),
            window.electronAPI.getFeedInfo()
        ]);

        feedList.innerHTML = ''; // Clear existing list
        feeds.forEach(feedUrl => {
            const listItem = document.createElement('li');
            const error = feedErrors[feedUrl];
            const info = feedInfo[feedUrl];
            listItem.innerHTML = `
                <div class="feed-info">
                    <span>${feedUrl}</span>
                    ${info ? `<span class="last-update">Última atualização: ${info.date} - <a href="#" class="post-link" data-link="${info.link}">"${info.title}"</a></span>` : ''}
                </div>
                <div class="feed-actions">
                    ${error ? `<span class="error-message">${error}</span>` : ''}
                    <button class="delete-feed-button" data-feed-url="${feedUrl}">Deletar</button>
                </div>
            `;
            feedList.appendChild(listItem);
        });

        document.querySelectorAll('.delete-feed-button').forEach(button => {
            button.addEventListener('click', async (event) => {
                const urlToDelete = event.target.dataset.feedUrl;
                await window.electronAPI.deleteFeed(urlToDelete);
                renderFeeds(); // Re-render the list after deletion
            });
        });

        document.querySelectorAll('.post-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const postLink = event.target.dataset.link;
                window.electronAPI.openLink(postLink);
            });
        });
    };

    addFeedButton.addEventListener('click', async () => {
        const feedUrl = feedUrlInput.value.trim();
        if (feedUrl) {
            await window.electronAPI.addFeed(feedUrl);
            feedUrlInput.value = ''; // Clear input
            renderFeeds(); // Re-render the list after adding
        }
    });

    // Listen for the feeds-checked event from the main process
    window.electronAPI.onFeedsChecked(() => {
        renderFeeds();
    });

    // Initial render of feeds
    renderFeeds();
});
