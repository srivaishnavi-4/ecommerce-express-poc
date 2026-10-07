const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("./models");

async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function createToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    return jwt.sign(
        { userId: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );
}

function authenticate(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            success: false,
            message: "Authentication token required"
        });
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization format"
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

async function authorizeAdmin(req, res, next) {
    try {
        const user = await User.findById(req.user.userId);

        if (!user || user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required"
            });
        }

        next();
    } catch (error) {
        next(error);
    }
}

module.exports = {
    hashPassword,
    comparePassword,
    createToken,
    authenticate,
    authorizeAdmin
};
