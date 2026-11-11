const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const chatRoutes = require("./routes/chat");
const conversationRoutes = require("./routes/conversations");
const adminRoutes = require("./routes/admin");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend assets from root and frontend folder
app.use(express.static(path.join(__dirname, "..")));
app.use(express.static(path.join(__dirname, "../frontend")));

// Health / test route
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "SmartSpend Mini Buddy Backend", timestamp: new Date() });
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
