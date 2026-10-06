const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const routes = require("./routes");

const app = express();

const helmetEnabled = process.env.HELMET_ENABLED === "true";
const corsEnabled = process.env.CORS_ENABLED === "true";
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED === "true";

if (helmetEnabled) {
    app.use(helmet());
}

if (corsEnabled) {
    const allowedOrigin = process.env.CLIENT_URL;

    app.use(
        cors({
            origin: allowedOrigin || false,
            credentials: true
        })
    );
}

app.use(
    express.json({
        limit: "10kb"
    })
);

if (rateLimitEnabled) {
    const limiter = rateLimit({
        windowMs:
            Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        limit:
            Number(process.env.RATE_LIMIT_MAX) || 100,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
            success: false,
            message: "Too many requests. Try again later."
        }
    });

    app.use(limiter);
}

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
        environment: process.env.NODE_ENV
    });
});

app.use("/api/auth", routes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

app.use((error, req, res, next) => {
    console.error(error);

    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            message: "Duplicate value already exists"
        });
    }

    res.status(500).json({
        success: false,
        message:
            process.env.NODE_ENV === "production"
                ? "Internal server error"
                : error.message
    });
});

module.exports = app;
