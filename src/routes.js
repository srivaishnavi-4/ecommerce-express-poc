const express = require("express");
const { User, Product } = require("./models");
const { hashPassword, comparePassword, createToken, authenticate, authorizeAdmin } = require("./auth");
const { getCache, setCache, deleteCache, isRedisAvailable } = require("./cache");

const router = express.Router();
const PRODUCT_CACHE_KEY = "products:all";
const CACHE_TTL = Number(process.env.REDIS_CACHE_TTL) || 60;

function validateProduct(body) {
    const errors = [];
    if (!body.name || body.name.trim().length < 2) errors.push("Product name must contain at least 2 characters");
    if (!body.description || !body.description.trim()) errors.push("Description is required");
    if (body.price === undefined || Number(body.price) < 0) errors.push("Valid non-negative price is required");
    if (!body.category || !body.category.trim()) errors.push("Category is required");
    if (body.stock === undefined || Number(body.stock) < 0) errors.push("Valid non-negative stock is required");
    return errors;
}

// AUTH
router.post("/auth/register", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const errors = [];
        if (!name || name.trim().length < 2) errors.push("Name must contain at least 2 characters");
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Valid email is required");
        if (!password || password.length < 8) errors.push("Password must contain at least 8 characters");
        if (errors.length) return res.status(400).json({ success: false, errors });

        const normalizedEmail = email.toLowerCase().trim();
        if (await User.findOne({ email: normalizedEmail })) {
            return res.status(409).json({ success: false, message: "Email already registered" });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: await hashPassword(password),
            role: "user"
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        next(error);
    }
});

router.post("/auth/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
        if (!user || !(await comparePassword(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        res.json({
            success: true,
            message: "Login successful",
            token: createToken(user),
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        next(error);
    }
});

router.get("/auth/profile", authenticate, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        next(error);
    }
});

// PRODUCTS
router.get("/products", async (req, res, next) => {
    try {
        const cached = await getCache(PRODUCT_CACHE_KEY);
        if (cached) {
            return res.json({ ...JSON.parse(cached), source: "redis-cache" });
        }

        const products = await Product.find().sort({ createdAt: -1 }).lean();
        const response = { success: true, count: products.length, products };
        await setCache(PRODUCT_CACHE_KEY, JSON.stringify(response), CACHE_TTL);

        res.json({ ...response, source: isRedisAvailable() ? "mongodb-and-redis-cache" : "mongodb" });
    } catch (error) {
        next(error);
    }
});

router.get("/products/:id", async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        res.json({ success: true, product });
    } catch (error) {
        next(error);
    }
});

router.post("/products", authenticate, authorizeAdmin, async (req, res, next) => {
    try {
        const errors = validateProduct(req.body);
        if (errors.length) return res.status(400).json({ success: false, errors });

        const product = await Product.create({
            name: req.body.name,
            description: req.body.description,
            price: Number(req.body.price),
            category: req.body.category,
            stock: Number(req.body.stock),
            image: req.body.image || ""
        });

        await deleteCache(PRODUCT_CACHE_KEY);
        res.status(201).json({ success: true, message: "Product created successfully", product });
    } catch (error) {
        next(error);
    }
});

router.put("/products/:id", authenticate, authorizeAdmin, async (req, res, next) => {
    try {
        const errors = validateProduct(req.body);
        if (errors.length) return res.status(400).json({ success: false, errors });

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                description: req.body.description,
                price: Number(req.body.price),
                category: req.body.category,
                stock: Number(req.body.stock),
                image: req.body.image || ""
            },
            { new: true, runValidators: true }
        );

        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        await deleteCache(PRODUCT_CACHE_KEY);
        res.json({ success: true, message: "Product updated successfully", product });
    } catch (error) {
        next(error);
    }
});

router.delete("/products/:id", authenticate, authorizeAdmin, async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        if (product.stock !== 0) {
            return res.status(409).json({ success: false, message: "Only out-of-stock products can be deleted" });
        }

        await product.deleteOne();
        await deleteCache(PRODUCT_CACHE_KEY);
        res.json({ success: true, message: "Product deleted successfully", product });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
