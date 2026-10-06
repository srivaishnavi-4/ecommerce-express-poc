require("dotenv").config();

const app = require("./app");
const { connectDatabase } = require("./db");

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

startServer();
