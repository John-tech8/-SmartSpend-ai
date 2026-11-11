// js/speechService.js

/**
 * Modular Speech Service for SmartSpend Mini Buddy
 * Handles browser-native Text-To-Speech (SpeechSynthesis)
 * and modular Speech-To-Text (SpeechRecognition) with pluggable future architecture.
 */
class SpeechService {
    constructor() {
        this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
        this.recognition = null;
        this.isCurrentlyListening = false;
        this.currentUtterance = null;
        this.activeSpeakingMessageId = null;

        // Initialize SpeechRecognition if available in the browser
        if (typeof window !== 'undefined') {
            const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecClass) {
                this.recognition = new SpeechRecClass();
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
            }
        }
    }

    /**
     * Map application language to speech BCP 47 language tag
     */
    mapLangTag(lang = 'en') {
        switch (lang) {
            case 'hi':
                return 'hi-IN';
            case 'ta':
                return 'ta-IN';
            case 'en':
            default:
                return 'en-US';
        }
    }

    // ==========================================
    // TEXT-TO-SPEECH (TTS)
    // ==========================================

    isTtsSupported() {
        return !!this.synth;
    }

    isSpeaking(messageId = null) {
        if (!this.synth) return false;
        if (messageId !== null) {
            return this.synth.speaking && this.activeSpeakingMessageId === messageId;
        }
        return this.synth.speaking;
    }

    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
            this.activeSpeakingMessageId = null;
        }
    }

    /**
     * Speak given text using native SpeechSynthesis
     */
    speak({ text, lang = 'en', messageId = null, onStart, onEnd, onError }) {
        if (!this.synth) {
            if (onError) onError(new Error('SpeechSynthesis is not supported in this browser.'));
            return;
        }

        // If currently speaking this message, toggle pause/stop
        if (this.isSpeaking(messageId)) {
            this.stopSpeaking();
            if (onEnd) onEnd();
            return;
        }

        // Cancel any existing speech
        this.stopSpeaking();

        // Strip HTML / Markdown tags for clean speech
        const cleanText = text
            .replace(/<[^>]*>/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/[*_#`~]/g, '')
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = this.mapLangTag(lang);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        this.activeSpeakingMessageId = messageId;
        this.currentUtterance = utterance;

        utterance.onstart = () => {
            if (onStart) onStart();
        };

        utterance.onend = () => {
            this.activeSpeakingMessageId = null;
            this.currentUtterance = null;
            if (onEnd) onEnd();
        };

        utterance.onerror = (event) => {
            this.activeSpeakingMessageId = null;
            this.currentUtterance = null;
            if (onError) onError(event);
        };

        this.synth.speak(utterance);
    }

    // ==========================================
    // MODULAR SPEECH-TO-TEXT (STT)
    // ==========================================

    isSttSupported() {
        return !!this.recognition;
    }

    isListening() {
        return this.isCurrentlyListening;
    }

    /**
     * Start speech recognition
     * Modular design: allows seamless swap to external AI transcription provider
     */
    startListening({ lang = 'en', onResult, onError, onEnd, onStart }) {
        if (!this.recognition) {
            if (onError) {
                onError(new Error('Speech recognition is not supported in this browser. You can still type your questions!'));
            }
            return false;
        }

        if (this.isCurrentlyListening) {
            this.stopListening();
            return false;
        }

        this.recognition.lang = this.mapLangTag(lang);

        this.recognition.onstart = () => {
            this.isCurrentlyListening = true;
            if (onStart) onStart();
        };

        this.recognition.onresult = (event) => {
            if (event.results && event.results.length > 0) {
                const transcript = event.results[0][0].transcript;
                if (onResult) onResult(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            this.isCurrentlyListening = false;
            console.warn('SpeechRecognition error:', event.error);
            if (onError) onError(event);
        };

        this.recognition.onend = () => {
            this.isCurrentlyListening = false;
            if (onEnd) onEnd();
        };

        try {
            this.recognition.start();
            return true;
        } catch (e) {
            this.isCurrentlyListening = false;
            if (onError) onError(e);
            return false;
        }
    }

    /**
     * Stop active microphone capture
     */
    stopListening() {
        if (this.recognition && this.isCurrentlyListening) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.isCurrentlyListening = false;
        }
    }
}

// Attach to window object for global frontend availability
if (typeof window !== 'undefined') {
    window.speechService = new SpeechService();
}
