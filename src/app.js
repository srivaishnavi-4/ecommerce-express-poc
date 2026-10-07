const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const router = require("./routes");

const app = express();


// SECURITY
if (process.env.HELMET_ENABLED !== "false") {
    app.use(helmet());
}


// CORS
if (process.env.CORS_ENABLED !== "false") {
    app.use(cors());
}


// BODY PARSER
app.use(express.json({ limit: "10kb" }));


// RATE LIMIT
if (process.env.RATE_LIMIT_ENABLED !== "false") {

    const limiter = rateLimit({
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: Number(process.env.RATE_LIMIT_MAX) || 100
    });

    app.use(limiter);
}


// FRONTEND
app.use(express.static(path.join(__dirname, "../public")));


// HEALTH CHECK
app.get("/health", (req, res) => {

    res.status(200).json({
        success: true,
        environment: process.env.NODE_ENV || "development"
    });

});


// API
app.use("/api", router);


// FRONTEND
app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "../public/index.html")
    );

});


// 404 HANDLER
app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route not found"
    });

});


// CENTRAL ERROR HANDLER
app.use((error, req, res, next) => {

    console.error("SERVER ERROR:", error);

    if (error.code === 11000) {

        return res.status(409).json({
            success: false,
            message: "Duplicate value already exists"
        });

    }

    if (error.name === "ValidationError") {

        return res.status(400).json({
            success: false,
            errors: Object.values(error.errors).map(
                err => err.message
            )
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