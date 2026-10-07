const mongoose = require("mongoose");


async function connectDatabase() {

    if (mongoose.connection.readyState === 1) {
        return;
    }

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    });

    console.log("MongoDB connected");
}


async function disconnectDatabase() {

    if (mongoose.connection.readyState !== 0) {

        await mongoose.disconnect();

        console.log("MongoDB disconnected");
    }
}


module.exports = {
    connectDatabase,
    disconnectDatabase
};