document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chatForm');
    const userInput = document.getElementById('userInput');
    const chatArea = document.getElementById('chatArea');

    // Helper: Scroll to bottom
    const scrollToBottom = () => {
        chatArea.scrollTop = chatArea.scrollHeight;
    };

    // Helper: Escape HTML to avoid XSS
    const escapeHTML = (str) => {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    };

    // Very basic markdown parser for bold and line breaks
    const formatAIResponse = (text) => {
        let formatted = escapeHTML(text);
        // Replace bold **text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Replace new lines with <br>
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    };

    // Append Message to UI
    const appendMessage = (sender, text, id = null) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');

        if (sender === 'user') {
            msgDiv.classList.add('msg-user');
            msgDiv.textContent = text;
        } else if (sender === 'loading') {
            msgDiv.classList.add('msg-loading');
            msgDiv.textContent = text;
            if (id) msgDiv.id = id;
        } else {
            msgDiv.classList.add('msg-ai');
            msgDiv.innerHTML = formatAIResponse(text);
        }

        chatArea.appendChild(msgDiv);
        scrollToBottom();
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = userInput.value.trim();
        if (!message) return;

        // 1. Append user message
        appendMessage('user', message);

        // Clear input
        userInput.value = '';

        // 2. Append loading bubble
        const loadingId = 'loading-' + Date.now();
        appendMessage('loading', 'AI is thinking...', loadingId);

        try {
            // 3. Send request to backend API
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();

            // Remove loading bubble
            const loadingBubble = document.getElementById(loadingId);
            if (loadingBubble) {
                loadingBubble.remove();
            }

            // 4. Append AI response
            if (response.ok) {
                appendMessage('ai', data.reply);
            } else {
                appendMessage('ai', '⚠️ Error: ' + (data.error || 'Failed to fetch response. Make sure the server is running.'));
            }

        } catch (error) {
            console.error('Chat Error:', error);
            const loadingBubble = document.getElementById(loadingId);
            if (loadingBubble) {
                loadingBubble.remove();
            }
            appendMessage('ai', '⚠️ Server connection error. Make sure your local Node server is running on port 3000.');
        }
    });
});
