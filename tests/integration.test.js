require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/db");
const { User, Product } = require("../src/models");

const email = `test_${Date.now()}@example.com`;
const password = "Password@123";
let token;
let productId;

 test.before(async () => {
    await connectDatabase();
    await User.deleteMany({ email: /@example\.com$/ });
    await Product.deleteMany({ name: /Integration Product/ });
});

test.after(async () => {
    await User.deleteMany({ email });
    if (productId) await Product.findByIdAndDelete(productId);
    await disconnectDatabase();
});

test("GET /health returns 200", async () => {
    const response = await request(app).get("/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
});

test("register creates a bcrypt-hashed user", async () => {
    const response = await request(app).post("/api/auth/register").send({
        name: "Vaishu Test",
        email,
        password
    });

    assert.equal(response.status, 201);
    const user = await User.findOne({ email }).select("+password");
    assert.ok(user);
    assert.notEqual(user.password, password);
    assert.equal(await bcrypt.compare(password, user.password), true);
    assert.equal(user.role, "user");
});

test("login returns JWT", async () => {
    const response = await request(app).post("/api/auth/login").send({ email, password });
    assert.equal(response.status, 200);
    assert.ok(response.body.token);
    token = response.body.token;
});

test("GET /api/products returns product list", async () => {
    const response = await request(app).get("/api/products");
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.products));
});

test("POST /api/products rejects unauthenticated request", async () => {
    const response = await request(app).post("/api/products").send({
        name: "Integration Product",
        description: "Test product",
        price: 100,
        category: "Testing",
        stock: 5
    });
    assert.equal(response.status, 401);
});

test("product mutations reject non-admin users", async () => {
    const response = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Integration Product",
            description: "Test product",
            price: 100,
            category: "Testing",
            stock: 5
        });

    assert.equal(response.status, 403);
    assert.equal(response.body.message, "Admin access required");

    const updateResponse = await request(app)
        .put("/api/products/507f1f77bcf86cd799439011")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Integration Product",
            description: "Test product",
            price: 100,
            category: "Testing",
            stock: 5
        });

    assert.equal(updateResponse.status, 403);
    assert.equal(updateResponse.body.message, "Admin access required");
});

test("admin role can manage products", async () => {
    await User.updateOne({ email }, { role: "admin" });
    const response = await request(app).post("/api/auth/login").send({ email, password });

    assert.equal(response.status, 200);
    assert.equal(response.body.user.role, "admin");
    token = response.body.token;
});

test("POST /api/products creates product with JWT", async () => {
    const response = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Integration Product",
            description: "Test product",
            price: 100,
            category: "Testing",
            stock: 5
        });

    assert.equal(response.status, 201);
    assert.ok(response.body.product._id);
    productId = response.body.product._id;
});

test("GET /api/products/:id returns created product", async () => {
    const response = await request(app).get(`/api/products/${productId}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.product.name, "Integration Product");
});

test("PUT /api/products/:id updates product", async () => {
    const response = await request(app)
        .put(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
            name: "Integration Product Updated",
            description: "Updated product",
            price: 150,
            category: "Testing",
            stock: 8
        });

    assert.equal(response.status, 200);
    assert.equal(response.body.product.price, 150);
});

test("DELETE /api/products/:id deletes product", async () => {
    const rejected = await request(app)
        .delete(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`);

    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.message, "Only out-of-stock products can be deleted");

    await Product.findByIdAndUpdate(productId, { stock: 0 });
    const response = await request(app)
        .delete(`/api/products/${productId}`)
        .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    productId = null;
});

test("unknown route returns 404", async () => {
    const response = await request(app).get("/api/not-found");
    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
});

test("security headers are present", async () => {
    const response = await request(app).get("/health");
    assert.ok(response.headers["x-content-type-options"]);
});
