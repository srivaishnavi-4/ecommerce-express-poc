module.exports = {
    apps: [
        {
            name: "ecommerce-express-poc",
            script: "./src/server.js",
            instances: "max",
            exec_mode: "cluster",
            autorestart: true,
            watch: false,
            max_memory_restart: "300M",
            env: { NODE_ENV: "development" },
            env_production: { NODE_ENV: "production" }
        }
    ]
};
