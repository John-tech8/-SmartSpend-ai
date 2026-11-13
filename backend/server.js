const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Block access to sensitive files
app.use((req, res, next) => {
    const blocked = [/\.env/, /\.git/, /package\.json/, /package-lock\.json/, /node_modules/];
    if (blocked.some(rx => rx.test(req.path))) {
        return res.status(403).send("Access Denied");
    }
    next();
});

// Serve frontend static files from project root
app.use(express.static(path.join(__dirname, ".."), {
    dotfiles: "ignore",
    index: "index.html"
}));

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        aiConfigured: !!process.env.GROQ_API_KEY
    });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
    try {
        const userMessage = req.body.message;
        const lang = req.body.language || 'en';
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ reply: "Missing GROQ_API_KEY environment variable. Add it to .env" });
        }

        const groq = new Groq({ apiKey });

        // Define language instruction
        let langInstruction = "Please reply in English.";
        if (lang === 'hi') langInstruction = "Please reply strictly in Hindi (हिंदी).";
        if (lang === 'ta') langInstruction = "Please reply strictly in Tamil (தமிழ்).";

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful financial advisor AI for a budgeting web app called SmartSpend. ${langInstruction}`
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

// Config endpoint for frontend Supabase initialization
app.get("/api/config", (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_ANON_KEY
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
});