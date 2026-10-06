const mongoose = require("mongoose");

async function connectDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

async function disconnectDatabase() {
    await mongoose.connection.close();
}

module.exports = {
    connectDatabase,
    disconnectDatabase
};