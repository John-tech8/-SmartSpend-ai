const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Test route
app.get("/", (req, res) => {
    res.send("SmartSpend AI Backend is running 🚀");
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
    try {
        const userMessage = req.body.message;
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ reply: "Missing GROQ_API_KEY environment variable. Add it to .env" });
        }

        const groq = new Groq({ apiKey });

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful financial advisor AI for a budgeting web app called SmartSpend."
                },
                {
                    role: "user",
                    content: userMessage
                }
            ]
        });

        const reply = response.choices?.[0]?.message?.content || "AI could not respond.";

        res.json({ reply });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ reply: "Something went wrong with the AI." });
    }
});

// Port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});