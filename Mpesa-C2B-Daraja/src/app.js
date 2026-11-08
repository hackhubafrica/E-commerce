require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const logger = require("./utils/logger");
const routes = require("./routes");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

// Log HTTP requests
app.use(morgan("combined", {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Parse JSON bodies (Safaricom sends JSON callbacks)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;