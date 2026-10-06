const express = require("express");
const { User } = require("./models");
const {
    hashPassword,
    comparePassword,
    createToken,
    authenticate
} = require("./auth");

const router = express.Router();

router.post("/register", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const errors = [];

        if (!name || name.trim().length < 2) {
            errors.push("Name must contain at least 2 characters");
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push("Valid email is required");
        }

        if (!password || password.length < 8) {
            errors.push("Password must contain at least 8 characters");
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const hashedPassword = await hashPassword(password);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "user"
        });

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const passwordMatched = await comparePassword(
            password,
            user.password
        );

        if (!passwordMatched) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = createToken(user);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get("/profile", authenticate, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
