const mongoose = require("mongoose");

async function connectDatabase() {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured");
    }

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    });

    console.log("MongoDB connected");
}

async function disconnectDatabase() {
    await mongoose.disconnect();
}

module.exports = {
    connectDatabase,
    disconnectDatabase
};
