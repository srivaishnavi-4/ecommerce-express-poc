# Ecommerce Express POC

This is the upgraded version of the original ecommerce POC. It keeps the original authentication/security/deployment structure and adds the requested ecommerce and scalability concepts.

## Requirements covered

1. Express + MongoDB/Mongoose ecommerce API
2. JWT authentication and bcrypt password hashing
3. Product CRUD
4. Automated endpoint assertion/integration testing with Node test runner + Supertest
5. Redis caching for the product-list query
6. Cache invalidation after product create/update/delete
7. PM2 cluster mode and process management
8. Production configuration and Render/Cloud Run deployment
9. Health check for Render
10. Frontend for login, product listing and product creation
11. Helmet, CORS, rate limiting and centralized 404/500 handling

## Structure

```text
ecommerce-express-poc/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── db.js
│   ├── models.js
│   ├── auth.js
│   ├── cache.js
│   └── routes.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── tests/
│   └── integration.test.js
├── ecosystem.config.js
├── render.yaml
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Local setup

```cmd
npm install
copy .env.example .env
npm start
```

Open:

```text
http://localhost:5000
```

Health:

```text
http://localhost:5000/health
```

## MongoDB

For local MongoDB:

```env
MONGO_URI=mongodb://127.0.0.1:27017/ecommerce_poc
```

For Atlas, put the Atlas connection string in `MONGO_URI`.

## Redis

Redis is optional at startup so the application does not crash when local Redis is unavailable. To enable caching:

```env
REDIS_URL=redis://127.0.0.1:6379
REDIS_CACHE_TTL=60
```

For Render, use a hosted Redis provider and put its connection URL in the Render `REDIS_URL` environment variable.

Product list flow:

```text
GET /api/products
       ↓
Check Redis
       ↓
Cache hit ─────────→ return cached products
       │
       ↓ miss
MongoDB query
       ↓
Store result in Redis
       ↓
Return products
```

Create/update/delete invalidates `products:all` so stale product data is not retained.

## Authentication

Register:

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Vaishu",
  "email": "vaishu@example.com",
  "password": "Password@123"
}
```

Login:

```http
POST /api/auth/login
```

Use the returned JWT for protected product mutations:

```http
Authorization: Bearer <token>
```

## Product API

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

POST/PUT/DELETE require an admin account. DELETE is allowed only when product stock is zero.

## Admin product management

There is no preconfigured admin email or password. Use the email and password chosen when registering; the password is stored as a hash and cannot be read back from MongoDB. Public registration always creates a regular user. To grant admin access, register the account first, then connect to the same MongoDB database and promote that account as an operator:

```javascript
db.users.updateOne(
       { email: "owner@example.com" },
       { $set: { role: "admin" } }
)
```

Sign in again after promotion so the profile reflects the new role. Admins can add products and update inventory. The catalog shows delete controls only for products with zero stock, and the API enforces that rule even if a request bypasses the UI. Regular users can browse products but cannot mutate them.

## Automated integration tests

Tests use the real Express app, MongoDB and Supertest.

```cmd
npm test
```

The suite checks:

- health endpoint
- registration
- bcrypt hashing
- login/JWT
- product list
- admin-only product mutations
- product creation
- product retrieval
- product update
- deletion blocked while stock remains
- out-of-stock product deletion
- 404 handling
- security headers

## PM2

PM2 is for process management when running Node yourself, such as a VM/server. It is not necessary for a Render web service because Render manages the service process.

Start cluster mode:

```cmd
npm run pm2:start
```

Check:

```cmd
npm run pm2:status
```

Logs:

```cmd
npm run pm2:logs
```

Stop:

```cmd
npm run pm2:stop
```

The PM2 configuration uses:

```text
instances: max
exec_mode: cluster
```

This allows multiple Node worker processes to use available CPU cores.

## Render deployment

Render uses:

```text
Build: npm install
Start: npm start
Health: /health
```

Required environment variables:

```text
NODE_ENV=production
MONGO_URI=<MongoDB Atlas URI>
JWT_SECRET=<strong secret>
REDIS_URL=<hosted Redis URL>
REDIS_CACHE_TTL=60
CLIENT_URL=<your Render URL>
HELMET_ENABLED=true
CORS_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

Do not commit `.env`.

The application listens using:

```js
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", ...);
```

This allows Render to provide the production port.

## Google Cloud Run deployment

Cloud Run can build this Node.js app from source; a Dockerfile is not required. You need a Google Cloud project with billing enabled and the Google Cloud CLI installed and authenticated.

1. Select your project and enable the required services:

```powershell
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

2. In Secret Manager, create secrets named `MONGO_URI` and `JWT_SECRET`. Set `MONGO_URI` to a production MongoDB Atlas connection string and `JWT_SECRET` to a long, random value. `REDIS_URL` is optional; without it, the app runs with caching disabled. If using hosted Redis, also create a `REDIS_URL` secret.

3. Ensure the Cloud Run runtime service account has the Secret Manager Secret Accessor role for those secrets. In Atlas, configure network access so Cloud Run can reach the cluster. For production, prefer Cloud NAT with a static egress IP and allowlist that IP instead of allowing all addresses.

4. From this project directory, deploy the public web app and API:

```powershell
gcloud run deploy ecommerce-express-poc --source . --region us-central1 --allow-unauthenticated --set-env-vars="NODE_ENV=production,REDIS_CACHE_TTL=60,HELMET_ENABLED=true,CORS_ENABLED=true,RATE_LIMIT_ENABLED=true,RATE_LIMIT_WINDOW_MS=900000,RATE_LIMIT_MAX=100" --set-secrets="MONGO_URI=MONGO_URI:latest,JWT_SECRET=JWT_SECRET:latest"
```

The app serves the storefront and health check on the same Cloud Run service. Unauthenticated access is required for customers to browse it; product mutations still require an admin JWT. After deployment, Cloud Run prints the service URL. Open that URL to register/sign in. Then promote the registered account to `admin` in MongoDB as described above. Keep `.env` out of source control and never put production secrets in deployment command arguments or source files.

If you created the optional Redis secret, add `,REDIS_URL=REDIS_URL:latest` to the `--set-secrets` value in the deploy command.
