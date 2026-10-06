require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert");

const request = require("supertest");

const mongoose = require("mongoose");

const app = require("../src/app");

const {
    connectDatabase,
    disconnectDatabase
} = require("../src/config/database");

const Product = require("../src/models/Product");


test.before(async () => {

    await connectDatabase();

    await Product.deleteMany({
        name: "Test Laptop"
    });

});


test.after(async () => {

    await Product.deleteMany({
        name: "Test Laptop"
    });

    await disconnectDatabase();

});


test("POST /api/products should create product", async () => {

    const response = await request(app)
        .post("/api/products")
        .send({
            name: "Test Laptop",
            category: "Electronics",
            price: 50000,
            stock: 10
        })
        .expect(201);

    assert.strictEqual(
        response.body.message,
        "Product created"
    );

    assert.strictEqual(
        response.body.data.name,
        "Test Laptop"
    );
});


test("GET /api/products should return products", async () => {

    const response = await request(app)
        .get("/api/products")
        .expect(200);

    assert.ok(
        Array.isArray(response.body.data)
    );
});


test("GET invalid product should return 404", async () => {

    const fakeId = new mongoose.Types.ObjectId();

    const response = await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

    assert.strictEqual(
        response.body.message,
        "Product not found"
    );
});


test("GET unknown route should return 404", async () => {

    const response = await request(app)
        .get("/api/unknown")
        .expect(404);

    assert.strictEqual(
        response.body.message,
        "Route not found"
    );
});