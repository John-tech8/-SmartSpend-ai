// js/miniBuddy.js
/**
 * Mini Buddy - Floating AI Financial Assistant Component
 * Provides complete conversational interface, voice controls,
 * PostgreSQL conversation persistence, and multilingual integration.
 */

(function () {
    class MiniBuddy {
        constructor() {
            this.isOpen = false;
            this.conversationId = localStorage.getItem('mini_buddy_active_conversation_id') || null;
            this.isGenerating = false;
            this.activeSpeakingMsgId = null;

            // Determine API base URL
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            // Use current origin if local or served by backend, else deployed backend
            this.apiBase = isLocal ? '' : (window.SMARTSPEND_API_URL || 'https://smartspend-ai-1-q37g.onrender.com');

            this.init();
        }

        getUserId() {
            if (typeof window.getUserId === 'function') {
                return window.getUserId();
            }
            let userId = localStorage.getItem('smartspend_user_id');
            if (!userId) {
                userId = 'guest-' + Math.random().toString(36).substring(2, 9);
                localStorage.setItem('smartspend_user_id', userId);
            }
            return userId;
        }

        getCurrentLanguage() {
            if (typeof window.getCurrentLanguage === 'function') {
                return window.getCurrentLanguage();
            }
            return localStorage.getItem('smartspend_lang') || 'en';
        }

        t(key, fallback = '') {
            if (typeof window.i18nTranslate === 'function') {
                return window.i18nTranslate(key, fallback);
            }
            return fallback || key;
        }

        init() {
            if (document.getElementById('miniBuddyLauncher')) {
                return; // Already initialized
            }

            this.injectStyles();
            this.renderDOM();
            this.attachEventListeners();

            // Load prior conversation if available
            this.loadInitialConversation();

            // Check if page opened with ?open_chat=true
            if (new URLSearchParams(window.location.search).get('open_chat') === 'true') {
                this.open();
            }
        }

        injectStyles() {
            if (!document.querySelector('link[href*="miniBuddy.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'css/miniBuddy.css';
                document.head.appendChild(link);
            }
        }

        renderDOM() {
            // 1. Floating Launcher Button
            const launcher = document.createElement('button');
            launcher.id = 'miniBuddyLauncher';
            launcher.className = 'mini-buddy-launcher';
            launcher.setAttribute('aria-label', 'Open Mini Buddy AI Chat');
            launcher.title = 'Mini Buddy - AI Financial Assistant';
            launcher.innerHTML = `
                <div class="mini-buddy-badge"></div>
                <svg viewBox="0 0 24 24">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.72V7h2a5 5 0 0 1 5 5v1h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v1a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-1H3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1v-1a5 5 0 0 1 5-5h2V5.72A2 2 0 0 1 10 4a2 2 0 0 1 2-2m-3 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-6 6h6v-1H9z"/>
                </svg>
            `;
            document.body.appendChild(launcher);

            // 2. Chat Window Container
            const windowEl = document.createElement('div');
            windowEl.id = 'miniBuddyWindow';
            windowEl.className = 'mini-buddy-window';
            windowEl.innerHTML = `
                <header class="mini-buddy-header">
                    <div class="mini-buddy-header-left">
                        <div class="mini-buddy-avatar">🤖</div>
                        <div class="mini-buddy-header-info">
                            <h3 class="mini-buddy-title" id="mbTitle">${this.t('minibuddy.name', 'Mini Buddy')}</h3>
                            <span class="mini-buddy-subtitle" id="mbSubtitle">
                                <span class="mini-buddy-online-dot"></span>
                                ${this.t('minibuddy.status_online', 'Online • Financial Assistant')}
                            </span>
                        </div>
                    </div>
                    <div class="mini-buddy-header-actions">
                        <button class="mini-buddy-btn-icon" id="mbNewChatBtn" title="${this.t('minibuddy.new_chat', 'New Chat')}">
                            <i class="fas fa-redo-alt" style="font-size: 13px;"></i>
                        </button>
                        <button class="mini-buddy-btn-icon" id="mbMinimizeBtn" title="Minimize">
                            <i class="fas fa-minus" style="font-size: 13px;"></i>
                        </button>
                        <button class="mini-buddy-btn-icon" id="mbCloseBtn" title="Close">
                            <i class="fas fa-times" style="font-size: 14px;"></i>
                        </button>
                    </div>
                </header>

                <div class="mini-buddy-messages" id="mbMessagesArea">
                    <!-- Dynamic Messages Appended Here -->
                </div>

                <div class="mini-buddy-input-area">
                    <form class="mini-buddy-form" id="mbChatForm">
                        <textarea 
                            id="mbUserInput" 
                            class="mini-buddy-input" 
                            rows="1" 
                            placeholder="${this.t('minibuddy.placeholder', 'Ask Mini Buddy about budgeting, saving...')}" 
                            required></textarea>
                        
                        <button type="button" class="mini-buddy-action-btn mini-buddy-voice-btn" id="mbMicBtn" title="Voice Input">
                            <i class="fas fa-microphone"></i>
                        </button>

                        <button type="submit" class="mini-buddy-action-btn mini-buddy-send-btn" id="mbSendBtn" title="Send Message">
                            <i class="fas fa-paper-plane" style="font-size: 13px;"></i>
                        </button>
                    </form>
                </div>
            `;
            document.body.appendChild(windowEl);
        }

        attachEventListeners() {
            const launcher = document.getElementById('miniBuddyLauncher');
            const windowEl = document.getElementById('miniBuddyWindow');
            const minimizeBtn = document.getElementById('mbMinimizeBtn');
            const closeBtn = document.getElementById('mbCloseBtn');
            const newChatBtn = document.getElementById('mbNewChatBtn');
            const chatForm = document.getElementById('mbChatForm');
            const userInput = document.getElementById('mbUserInput');
            const micBtn = document.getElementById('mbMicBtn');

            // Launcher toggle
            launcher.addEventListener('click', () => {
                this.toggle();
            });

            // Header controls
            minimizeBtn.addEventListener('click', () => this.close());
            closeBtn.addEventListener('click', () => this.close());
            newChatBtn.addEventListener('click', () => this.startNewConversation());

            // Enter key handling (Enter sends, Shift+Enter newlines)
            userInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });

            // Form Submit
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const msg = userInput.value.trim();
                if (!msg || this.isGenerating) return;
                this.sendMessage(msg);
                userInput.value = '';
                userInput.style.height = 'auto';
            });

            // Voice Microphone (STT)
            micBtn.addEventListener('click', () => {
                this.toggleVoiceRecording();
            });

            // Listen for global language change events
            window.addEventListener('languageChanged', (e) => {
                this.updateLanguageUI(e.detail.language);
            });

            // Wire any on-page trigger buttons (e.g. "AI Financial Advice" feature card)
            document.querySelectorAll('[data-open-minibuddy]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.open();
                });
            });
        }

        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        open() {
            const windowEl = document.getElementById('miniBuddyWindow');
            windowEl.classList.add('active');
            this.isOpen = true;
            this.scrollToBottom();

            // Focus input
            setTimeout(() => {
                const input = document.getElementById('mbUserInput');
                if (input) input.focus();
            }, 250);
        }

        close() {
            const windowEl = document.getElementById('miniBuddyWindow');
            windowEl.classList.remove('active');
            this.isOpen = false;

            // Stop speech if speaking
            if (window.speechService) {
                window.speechService.stopSpeaking();
                window.speechService.stopListening();
            }
        }

        scrollToBottom() {
            const area = document.getElementById('mbMessagesArea');
            if (area) {
                area.scrollTop = area.scrollHeight;
            }
        }

        formatTime(date = new Date()) {
            return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        escapeHTML(str) {
            return str.replace(/[&<>'"]/g,
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag] || tag)
            );
        }

        formatContent(text) {
            let escaped = this.escapeHTML(text);
            // Replace bold **text**
            escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Replace newlines
            escaped = escaped.replace(/\n/g, '<br>');
            return escaped;
        }

        /**
         * Render a single message bubble into the messages container
         */
        renderMessageBubble({ id, role, content, time = new Date() }) {
            const area = document.getElementById('mbMessagesArea');
            const msgRow = document.createElement('div');
            msgRow.className = `mini-buddy-msg-row ${role}`;
            if (id) msgRow.dataset.msgId = id;

            const bubble = document.createElement('div');
            bubble.className = 'mini-buddy-bubble';
            bubble.innerHTML = this.formatContent(content);

            const meta = document.createElement('div');
            meta.className = 'mini-buddy-msg-meta';
            meta.innerHTML = `<span>${this.formatTime(time)}</span>`;

            // If assistant message, add voice playback button
            if (role === 'assistant') {
                const ttsBtn = document.createElement('button');
                ttsBtn.className = 'mini-buddy-tts-btn';
                ttsBtn.innerHTML = `<i class="fas fa-volume-up"></i> ${this.t('minibuddy.speak', 'Listen')}`;
                ttsBtn.title = 'Speak this message';

                ttsBtn.addEventListener('click', () => {
                    this.toggleSpeechPlayback(ttsBtn, content, id);
                });

                meta.appendChild(ttsBtn);
            }

            msgRow.appendChild(bubble);
            msgRow.appendChild(meta);
            area.appendChild(msgRow);

            this.scrollToBottom();
        }

        showTypingIndicator() {
            const area = document.getElementById('mbMessagesArea');
            if (document.getElementById('mbTypingIndicator')) return;

            const typingDiv = document.createElement('div');
            typingDiv.id = 'mbTypingIndicator';
            typingDiv.className = 'mini-buddy-typing';
            typingDiv.innerHTML = `
                <div class="mini-buddy-dots">
                    <span class="mini-buddy-dot"></span>
                    <span class="mini-buddy-dot"></span>
                    <span class="mini-buddy-dot"></span>
                </div>
                <span>${this.t('minibuddy.typing', 'Mini Buddy is thinking...')}</span>
            `;
            area.appendChild(typingDiv);
            this.scrollToBottom();
        }

        hideTypingIndicator() {
            const typing = document.getElementById('mbTypingIndicator');
            if (typing) typing.remove();
        }

        /**
         * Load conversation from PostgreSQL backend
         */
        async loadInitialConversation() {
            const area = document.getElementById('mbMessagesArea');
            area.innerHTML = '';

            const userId = this.getUserId();

            if (this.conversationId) {
                try {
                    const response = await fetch(`${this.apiBase}/api/conversations/${this.conversationId}/messages?userId=${encodeURIComponent(userId)}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.messages && data.messages.length > 0) {
                            data.messages.forEach(msg => {
                                this.renderMessageBubble({
                                    id: msg.id,
                                    role: msg.role,
                                    content: msg.content,
                                    time: msg.created_at
                                });
                            });
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('Could not load previous conversation from DB, showing fresh greeting:', e.message);
                }
            }

            // Fresh initial greeting
            this.showInitialGreeting();
        }

        showInitialGreeting() {
            const greeting = this.t(
                'minibuddy.greeting',
                "Hi! I'm Mini Buddy 🤖, your personal financial buddy. I'm here to help you understand your spending, improve your savings habits and make smarter financial decisions. What would you like to know?"
            );
            this.renderMessageBubble({
                id: 'greeting-' + Date.now(),
                role: 'assistant',
                content: greeting
            });
        }

        /**
         * Send user message to PostgreSQL + Grok AI backend
         */
        async sendMessage(text) {
            this.isGenerating = true;
            const userId = this.getUserId();
            const language = this.getCurrentLanguage();

            // 1. Render user bubble
            this.renderMessageBubble({
                role: 'user',
                content: text
            });

            // 2. Show Typing Indicator
            this.showTypingIndicator();

            try {
                const response = await fetch(`${this.apiBase}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': userId
                    },
                    body: JSON.stringify({
                        message: text,
                        conversationId: this.conversationId,
                        userId: userId,
                        language: language
                    })
                });

                const data = await response.json();
                this.hideTypingIndicator();

                if (response.ok && data.reply) {
                    if (data.conversationId) {
                        this.conversationId = data.conversationId;
                        localStorage.setItem('mini_buddy_active_conversation_id', data.conversationId);
                    }

                    // Render AI bubble
                    this.renderMessageBubble({
                        id: data.aiMessage?.id || 'reply-' + Date.now(),
                        role: 'assistant',
                        content: data.reply
                    });
                } else {
                    const errorMsg = data.error || this.t('minibuddy.error', '⚠️ Something went wrong with the AI service. Please try again.');
                    this.renderMessageBubble({
                        role: 'assistant',
                        content: errorMsg
                    });
                }
            } catch (err) {
                console.error('Chat request failed:', err);
                this.hideTypingIndicator();
                this.renderMessageBubble({
                    role: 'assistant',
                    content: this.t('minibuddy.error', '⚠️ Something went wrong. Please check your connection and try again.')
                });
            } finally {
                this.isGenerating = false;
            }
        }

        /**
         * Clear active conversation
         */
        async startNewConversation() {
            const confirmText = this.t('minibuddy.clear_confirm', 'Clear this conversation history?');
            if (!confirm(confirmText)) return;

            const userId = this.getUserId();

            if (this.conversationId) {
                try {
                    await fetch(`${this.apiBase}/api/conversations/${this.conversationId}?userId=${encodeURIComponent(userId)}`, {
                        method: 'DELETE'
                    });
                } catch (e) {
                    console.error('Failed to clear conversation on backend:', e);
                }
            }

            this.conversationId = null;
            localStorage.removeItem('mini_buddy_active_conversation_id');

            const area = document.getElementById('mbMessagesArea');
            area.innerHTML = '';
            this.showInitialGreeting();
        }

        /**
         * Handle Voice TTS (Play / Pause / Stop)
         */
        toggleSpeechPlayback(btnEl, text, messageId) {
            if (!window.speechService) return;

            const lang = this.getCurrentLanguage();

            if (window.speechService.isSpeaking(messageId)) {
                window.speechService.stopSpeaking();
                btnEl.classList.remove('speaking');
                btnEl.innerHTML = `<i class="fas fa-volume-up"></i> ${this.t('minibuddy.speak', 'Listen')}`;
                return;
            }

            // Reset any other speaking button
            document.querySelectorAll('.mini-buddy-tts-btn.speaking').forEach(b => {
                b.classList.remove('speaking');
                b.innerHTML = `<i class="fas fa-volume-up"></i> ${this.t('minibuddy.speak', 'Listen')}`;
            });

            btnEl.classList.add('speaking');
            btnEl.innerHTML = `<i class="fas fa-stop"></i> ${this.t('minibuddy.stop_speaking', 'Stop')}`;

            window.speechService.speak({
                text,
                lang,
                messageId,
                onEnd: () => {
                    btnEl.classList.remove('speaking');
                    btnEl.innerHTML = `<i class="fas fa-volume-up"></i> ${this.t('minibuddy.speak', 'Listen')}`;
                },
                onError: () => {
                    btnEl.classList.remove('speaking');
                    btnEl.innerHTML = `<i class="fas fa-volume-up"></i> ${this.t('minibuddy.speak', 'Listen')}`;
                }
            });
        }

        /**
         * Handle Microphone STT input
         */
        toggleVoiceRecording() {
            const micBtn = document.getElementById('mbMicBtn');
            const userInput = document.getElementById('mbUserInput');

            if (!window.speechService) {
                alert('Speech service is not available.');
                return;
            }

            if (window.speechService.isListening()) {
                window.speechService.stopListening();
                micBtn.classList.remove('listening');
                return;
            }

            const lang = this.getCurrentLanguage();
            micBtn.classList.add('listening');

            const started = window.speechService.startListening({
                lang,
                onResult: (transcript) => {
                    if (transcript) {
                        userInput.value = (userInput.value ? userInput.value + ' ' : '') + transcript;
                        userInput.focus();
                    }
                },
                onEnd: () => {
                    micBtn.classList.remove('listening');
                },
                onError: (err) => {
                    micBtn.classList.remove('listening');
                    if (err.message) {
                        alert(err.message);
                    }
                }
            });

            if (!started) {
                micBtn.classList.remove('listening');
            }
        }

        /**
         * Live UI translation update when language changes
         */
        updateLanguageUI(newLang) {
            const titleEl = document.getElementById('mbTitle');
            const subtitleEl = document.getElementById('mbSubtitle');
            const inputEl = document.getElementById('mbUserInput');
            const newChatBtn = document.getElementById('mbNewChatBtn');

            if (titleEl) titleEl.textContent = this.t('minibuddy.name', 'Mini Buddy');
            if (subtitleEl) {
                subtitleEl.innerHTML = `<span class="mini-buddy-online-dot"></span> ${this.t('minibuddy.status_online', 'Online • Financial Assistant')}`;
            }
            if (inputEl) inputEl.placeholder = this.t('minibuddy.placeholder', 'Ask Mini Buddy about budgeting, saving...');
            if (newChatBtn) newChatBtn.title = this.t('minibuddy.new_chat', 'New Chat');

            // If there is only the greeting message in the chat, update its text to the newly selected language
            const messagesArea = document.getElementById('mbMessagesArea');
            if (messagesArea && messagesArea.children.length === 1 && !this.conversationId) {
                const bubble = messagesArea.querySelector('.mini-buddy-bubble');
                if (bubble) {
                    bubble.innerHTML = this.formatContent(this.t('minibuddy.greeting'));
                }
            }
        }
    }

    // Auto-instantiate Mini Buddy when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.miniBuddy = new MiniBuddy();
        });
    } else {
        window.miniBuddy = new MiniBuddy();
    }
})();
