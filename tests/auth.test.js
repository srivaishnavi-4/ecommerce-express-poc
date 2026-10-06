require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../src/app");
const {
    connectDatabase,
    disconnectDatabase
} = require("../src/db");
const { User } = require("../src/models");

const testUser = {
    name: "Vaishu Test",
    email: `vaishu_${Date.now()}@example.com`,
    password: "Password@123"
};

let authToken;
let createdUserId;

test.before(async () => {
    await connectDatabase();

    await User.deleteMany({
        email: /@example\.com$/
    });
});

test.after(async () => {
    if (createdUserId) {
        await User.deleteOne({
            _id: createdUserId
        });
    }

    await disconnectDatabase();
});

test("GET /health should return healthy status", async () => {
    const response = await request(app).get("/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.message, "Server is healthy");
});

test("POST /api/auth/register should register a user", async () => {
    const response = await request(app)
        .post("/api/auth/register")
        .send(testUser);

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.user.email, testUser.email);
    assert.equal(response.body.user.role, "user");
    assert.ok(response.body.user.id);

    createdUserId = response.body.user.id;
});

test("registered user should actually exist in MongoDB", async () => {
    const user = await User.findById(createdUserId).select("+password");

    assert.ok(user);
    assert.equal(user.email, testUser.email);
    assert.equal(user.name, testUser.name);
    assert.equal(user.role, "user");
});

test("password should be stored as a bcrypt hash", async () => {
    const user = await User.findById(createdUserId).select("+password");

    assert.ok(user.password);
    assert.notEqual(user.password, testUser.password);

    const passwordMatches = await bcrypt.compare(
        testUser.password,
        user.password
    );

    assert.equal(passwordMatches, true);
});

test("POST /api/auth/login should authenticate user", async () => {
    const response = await request(app)
        .post("/api/auth/login")
        .send({
            email: testUser.email,
            password: testUser.password
        });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.message, "Login successful");
    assert.ok(response.body.token);
    assert.equal(response.body.user.email, testUser.email);

    authToken = response.body.token;
});

test("login should reject incorrect password", async () => {
    const response = await request(app)
        .post("/api/auth/login")
        .send({
            email: testUser.email,
            password: "WrongPassword@999"
        });

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test("login should reject unknown email", async () => {
    const response = await request(app)
        .post("/api/auth/login")
        .send({
            email: "doesnotexist@example.com",
            password: "Password@123"
        });

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test("profile should reject unauthenticated request", async () => {
    const response = await request(app)
        .get("/api/auth/profile");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test("profile should return authenticated user", async () => {
    const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.user.email, testUser.email);
    assert.equal(response.body.user.name, testUser.name);
});

test("profile should reject invalid JWT", async () => {
    const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid.jwt.token");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test("registration should reject invalid email", async () => {
    const response = await request(app)
        .post("/api/auth/register")
        .send({
            name: "Test User",
            email: "invalid-email",
            password: "Password@123"
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.ok(Array.isArray(response.body.errors));
});

test("registration should reject short password", async () => {
    const response = await request(app)
        .post("/api/auth/register")
        .send({
            name: "Test User",
            email: "shortpassword@example.com",
            password: "123"
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
});

test("registration should reject duplicate email", async () => {
    const response = await request(app)
        .post("/api/auth/register")
        .send(testUser);

    assert.equal(response.status, 409);
    assert.equal(response.body.success, false);
});

test("unknown route should return 404", async () => {
    const response = await request(app)
        .get("/api/does-not-exist");

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
});

test("security headers should be present", async () => {
    const response = await request(app).get("/health");

    assert.ok(response.headers["x-content-type-options"]);
    assert.ok(response.headers["x-frame-options"]);
});
