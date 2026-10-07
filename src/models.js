const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: ["user", "admin"], default: "user" }
    },
    { timestamps: true }
);

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
        description: { type: String, required: true, trim: true, maxlength: 500 },
        price: { type: Number, required: true, min: 0 },
        category: { type: String, required: true, trim: true },
        stock: { type: Number, required: true, min: 0 },
        image: { type: String, default: "" }
    },
    { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports = { User, Product };
