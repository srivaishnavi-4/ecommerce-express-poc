const express = require("express");
const Product = require("../models/Product");
const { getRedisClient } = require("../config/redis");

const router = express.Router();


// GET ALL PRODUCTS
router.get("/", async (req, res, next) => {

    try {

        const redis = getRedisClient();

        // 1. Check Redis
        if (redis) {

            const cachedProducts = await redis.get("products");

            if (cachedProducts) {

                console.log("CACHE HIT");

                return res.json({
                    source: "redis",
                    data: JSON.parse(cachedProducts)
                });
            }
        }

        console.log("CACHE MISS");

        // 2. Heavy database query
        const products = await Product.find()
            .sort({ createdAt: -1 })
            .lean();

        // 3. Store result in Redis
        if (redis) {

            await redis.set(
                "products",
                JSON.stringify(products),
                {
                    EX: 60
                }
            );
        }

        res.json({
            source: "mongodb",
            data: products
        });

    } catch (error) {

        next(error);
    }
});


// GET SINGLE PRODUCT
router.get("/:id", async (req, res, next) => {

    try {

        const redis = getRedisClient();

        const cacheKey = `product:${req.params.id}`;

        if (redis) {

            const cachedProduct = await redis.get(cacheKey);

            if (cachedProduct) {

                console.log("CACHE HIT");

                return res.json({
                    source: "redis",
                    data: JSON.parse(cachedProduct)
                });
            }
        }

        console.log("CACHE MISS");

        const product = await Product.findById(
            req.params.id
        ).lean();

        if (!product) {

            return res.status(404).json({
                message: "Product not found"
            });
        }

        if (redis) {

            await redis.set(
                cacheKey,
                JSON.stringify(product),
                {
                    EX: 60
                }
            );
        }

        res.json({
            source: "mongodb",
            data: product
        });

    } catch (error) {

        next(error);
    }
});


// CREATE PRODUCT
router.post("/", async (req, res, next) => {

    try {

        const product = await Product.create(req.body);

        // Invalidate product list cache
        const redis = getRedisClient();

        if (redis) {
            await redis.del("products");
        }

        res.status(201).json({
            message: "Product created",
            data: product
        });

    } catch (error) {

        next(error);
    }
});


// UPDATE PRODUCT
router.put("/:id", async (req, res, next) => {

    try {

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {

            return res.status(404).json({
                message: "Product not found"
            });
        }

        const redis = getRedisClient();

        if (redis) {

            await redis.del("products");

            await redis.del(
                `product:${req.params.id}`
            );
        }

        res.json({
            message: "Product updated",
            data: product
        });

    } catch (error) {

        next(error);
    }
});


// DELETE PRODUCT
router.delete("/:id", async (req, res, next) => {

    try {

        const product = await Product.findByIdAndDelete(
            req.params.id
        );

        if (!product) {

            return res.status(404).json({
                message: "Product not found"
            });
        }

        const redis = getRedisClient();

        if (redis) {

            await redis.del("products");

            await redis.del(
                `product:${req.params.id}`
            );
        }

        res.json({
            message: "Product deleted"
        });

    } catch (error) {

        next(error);
    }
});


module.exports = router;