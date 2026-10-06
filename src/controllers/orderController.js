const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");

const {
    redisClient
} = require("../config/redis");


// CREATE ORDER
async function createOrder(req, res, next) {

    const session =
        await mongoose.startSession();

    try {

        const {
            customerName,
            productId,
            quantity
        } = req.body;

        if (
            !customerName ||
            !productId ||
            !quantity
        ) {

            const error = new Error(
                "customerName, productId and quantity are required"
            );

            error.statusCode = 400;

            return next(error);

        }

        session.startTransaction();

        // Find product
        const product =
            await Product.findById(productId)
                .session(session);

        if (!product) {

            const error = new Error(
                "Product not found"
            );

            error.statusCode = 404;

            throw error;

        }

        // Check stock
        if (product.stock < quantity) {

            const error = new Error(
                "Insufficient stock"
            );

            error.statusCode = 400;

            throw error;

        }

        const totalAmount =
            product.price * quantity;

        // Reduce stock
        product.stock -= quantity;

        await product.save({
            session
        });

        // Create order
        const order =
            await Order.create(
                [
                    {
                        customerName,
                        product: product._id,
                        quantity,
                        totalAmount
                    }
                ],
                {
                    session
                }
            );

        await session.commitTransaction();

        // Product data changed.
        // Remove stale Redis cache.
        await redisClient.del(
            "products:all"
        );

        await redisClient.del(
            `product:${productId}`
        );

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            order: order[0]
        });

    } catch (error) {

        await session.abortTransaction();

        next(error);

    } finally {

        await session.endSession();

    }

}


// GET ORDERS
async function getOrders(req, res, next) {

    try {

        const orders =
            await Order.find()
                .populate(
                    "product",
                    "name price category"
                )
                .sort({
                    createdAt: -1
                });

        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {

        next(error);

    }

}


module.exports = {
    createOrder,
    getOrders
};