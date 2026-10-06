const Product = require("../models/Product");

const {
    redisClient
} = require("../config/redis");


// GET ALL PRODUCTS
async function getProducts(req, res, next) {

    try {

        const cacheKey = "products:all";

        // 1. Check Redis
        const cachedProducts =
            await redisClient.get(cacheKey);

        if (cachedProducts) {

            console.log(
                "Product Cache HIT"
            );

            return res.status(200).json({
                success: true,
                source: "redis",
                products: JSON.parse(cachedProducts)
            });

        }

        console.log(
            "Product Cache MISS"
        );

        // 2. Query MongoDB
        const products =
            await Product.find()
                .sort({ createdAt: -1 });

        // 3. Store result in Redis
        await redisClient.setEx(
            cacheKey,
            Number(process.env.CACHE_TTL),
            JSON.stringify(products)
        );

        // 4. Return response
        res.status(200).json({
            success: true,
            source: "mongodb",
            products
        });

    } catch (error) {

        next(error);

    }

}


// GET PRODUCT BY ID
async function getProductById(req, res, next) {

    try {

        const productId =
            req.params.id;

        const cacheKey =
            `product:${productId}`;

        // Check Redis
        const cachedProduct =
            await redisClient.get(cacheKey);

        if (cachedProduct) {

            console.log(
                "Product Cache HIT"
            );

            return res.status(200).json({
                success: true,
                source: "redis",
                product: JSON.parse(cachedProduct)
            });

        }

        console.log(
            "Product Cache MISS"
        );

        // MongoDB query
        const product =
            await Product.findById(productId);

        if (!product) {

            const error = new Error(
                "Product not found"
            );

            error.statusCode = 404;

            return next(error);

        }

        // Cache product
        await redisClient.setEx(
            cacheKey,
            Number(process.env.CACHE_TTL),
            JSON.stringify(product)
        );

        res.status(200).json({
            success: true,
            source: "mongodb",
            product
        });

    } catch (error) {

        next(error);

    }

}


// CREATE PRODUCT
async function createProduct(req, res, next) {

    try {

        const {
            name,
            category,
            price,
            stock
        } = req.body;

        if (
            !name ||
            !category ||
            price === undefined ||
            stock === undefined
        ) {

            const error = new Error(
                "name, category, price and stock are required"
            );

            error.statusCode = 400;

            return next(error);

        }

        const product =
            await Product.create({
                name,
                category,
                price,
                stock
            });

        // Important:
        // Product list cache is now outdated.
        await redisClient.del(
            "products:all"
        );

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            product
        });

    } catch (error) {

        next(error);

    }

}


// UPDATE PRODUCT
async function updateProduct(req, res, next) {

    try {

        const product =
            await Product.findByIdAndUpdate(
                req.params.id,
                req.body,
                {
                    new: true,
                    runValidators: true
                }
            );

        if (!product) {

            const error = new Error(
                "Product not found"
            );

            error.statusCode = 404;

            return next(error);

        }

        // Invalidate caches
        await redisClient.del(
            "products:all"
        );

        await redisClient.del(
            `product:${req.params.id}`
        );

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product
        });

    } catch (error) {

        next(error);

    }

}


// DELETE PRODUCT
async function deleteProduct(req, res, next) {

    try {

        const product =
            await Product.findByIdAndDelete(
                req.params.id
            );

        if (!product) {

            const error = new Error(
                "Product not found"
            );

            error.statusCode = 404;

            return next(error);

        }

        // Invalidate cache
        await redisClient.del(
            "products:all"
        );

        await redisClient.del(
            `product:${req.params.id}`
        );

        res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        });

    } catch (error) {

        next(error);

    }

}


module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};