require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Main Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable. Add it to backend/.env" });
        }

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const systemPrompt = "You are SmartSpend AI, a financial advisor helping users with budgeting, savings, and spending advice.\n\nUser: " + message;

        const payload = {
            contents: [{
                parts: [{ text: systemPrompt }]
            }]
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return res.status(response.status).json({ error: data.error?.message || "Failed to communicate with Gemini AI" });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) {
            return res.status(500).json({ error: "Received empty response from AI" });
        }

        res.json({ reply });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`SmartSpend AI server running on port ${PORT}`);
});
