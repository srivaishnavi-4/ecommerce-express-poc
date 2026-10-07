require("dotenv").config();

const app = require("./app");
const { connectDatabase, disconnectDatabase } = require("./db");
const { connectRedis, disconnectRedis } = require("./cache");

const PORT = process.env.PORT || 5000;
let server;
let isShuttingDown = false;

async function startServer() {
    try {
        await connectDatabase();
        await connectRedis();

        server = app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
        });
    } catch (error) {
        console.error("Startup failed:", error.message);
        process.exit(1);
    }
}

async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }

    const results = await Promise.allSettled([disconnectRedis(), disconnectDatabase()]);
    if (results.some((result) => result.status === "rejected")) {
        console.error("Shutdown completed with connection cleanup errors");
        process.exitCode = 1;
    }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
