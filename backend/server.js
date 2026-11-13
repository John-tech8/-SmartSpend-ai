const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const chatRoutes = require("./routes/chat");
const conversationRoutes = require("./routes/conversations");
const adminRoutes = require("./routes/admin");
const analyticsRoutes = require("./routes/analytics");
const scoreRoutes = require("./routes/score");

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

// Root route
app.get("/", (req, res) => {
    // If index.html exists, serve it, otherwise status message
    res.sendFile(path.join(__dirname, "../index.html"), (err) => {
        if (err) {
            res.send("SmartSpend AI Backend is running 🚀");
        }
    });
});

// Mini Buddy Chat & Conversations routes
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/admin", adminRoutes);

// Intelligent Expense Analysis & Financial Health Score routes
app.use("/api/analytics", analyticsRoutes);
app.use("/api/financial-health", scoreRoutes);

// Config endpoint for frontend Supabase initialization
app.get("/api/config", (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || "",
        supabaseKey: process.env.SUPABASE_ANON_KEY || ""
    });
});

// 404 handler for unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found" });
});

// Port
const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`SmartSpend server running on port ${PORT}`);
    });
}

module.exports = app;
