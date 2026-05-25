# Three-Tier CRUD Application

A **production-grade** three-tier CRUD application built with **React**, **Express.js**, and **MongoDB**, fully containerized with Docker and equipped with CI/CD pipelines.

---

## 🏗️ Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │ ───▶ │   Backend    │ ───▶ │   MongoDB    │
│  React/Vite  │      │  Express.js  │      │   Database   │
│  nginx:8080  │      │   :5000      │      │   :27017     │
└──────────────┘      └──────────────┘      └──────────────┘
     Tier 1               Tier 2                Tier 3
  Presentation          Application              Data
```

- **Frontend (Tier 1):** React SPA built with Vite, served via nginx with security headers.
- **Backend (Tier 2):** Express.js REST API with input validation, Prometheus metrics, and health checks.
- **Database (Tier 3):** MongoDB with Mongoose ODM and persistent Docker volumes.

---

## 📁 Folder Structure

```
three-tier-crud-app/
├── backend/
│   ├── src/
│   │   └── server.js              # Express app, routes, schema, middleware
│   ├── tests/
│   │   └── items.test.js          # Jest + Supertest + mongodb-memory-server
│   ├── Dockerfile                 # Multi-stage Node.js build
│   ├── .dockerignore
│   ├── package.json
│   └── sonar-project.properties   # SonarQube config
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main CRUD UI
│   │   ├── components/
│   │   │   ├── ItemForm.jsx       # Create / Update form
│   │   │   ├── ItemCard.jsx       # Item display card
│   │   │   └── FilterBar.jsx      # Search & filter bar
│   │   ├── services/
│   │   │   └── api.js             # Axios API client
│   │   ├── tests/
│   │   │   └── components.test.jsx
│   │   └── main.jsx
│   ├── Dockerfile                 # Multi-stage Vite + nginx build
│   ├── nginx.conf                 # SPA-ready nginx config
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml             # Full stack orchestration
├── jenkins/
│   ├── Jenkinsfile-backend        # Backend CI/CD pipeline
│   └── Jenkinsfile-frontend       # Frontend CI/CD pipeline
└── README.md
```

---

## ✅ Prerequisites

| Tool            | Version  |
|-----------------|----------|
| Node.js         | ≥ 20.x   |
| npm             | ≥ 10.x   |
| Docker          | ≥ 24.x   |
| Docker Compose  | ≥ 2.x    |
| MongoDB         | ≥ 7.x (if running locally without Docker) |

---

## 🚀 Local Setup (Without Docker)

### 1. Start MongoDB

```bash
# If MongoDB is installed locally
mongod --dbpath /data/db
```

### 2. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The API server starts on `http://localhost:5000`.

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts on `http://localhost:3000` with API proxy to `:5000`.

---

## 🐳 Local Setup (With Docker Compose)

```bash
# Build and start all services
docker compose up --build

# Or run in background
docker compose up --build -d
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:8080         |
| Backend   | http://localhost:5000         |
| MongoDB   | Internal only (port 27017)   |

```bash
# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## 📡 API Endpoints

### Items CRUD

| Method   | Endpoint           | Description             |
|----------|--------------------|-------------------------|
| `GET`    | `/api/items`       | List all items          |
| `GET`    | `/api/items/:id`   | Get single item         |
| `POST`   | `/api/items`       | Create new item         |
| `PUT`    | `/api/items/:id`   | Update existing item    |
| `DELETE` | `/api/items/:id`   | Delete item             |

**Query Parameters for `GET /api/items`:**
- `search` – search in name and description (case-insensitive)
- `status` – filter by `pending`, `in-progress`, or `completed`

### System

| Method | Endpoint    | Description                         |
|--------|-------------|-------------------------------------|
| `GET`  | `/health`   | API status + MongoDB connectivity   |
| `GET`  | `/metrics`  | Prometheus metrics                  |

### Item Schema

```json
{
  "name": "string (required, 1–200 chars)",
  "description": "string (optional, max 2000 chars)",
  "status": "pending | in-progress | completed",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

---

## 🔧 Environment Variables

### Backend

| Variable      | Default                                    | Description             |
|---------------|--------------------------------------------|-------------------------|
| `PORT`        | `5000`                                     | Server port             |
| `MONGO_URI`   | `mongodb://localhost:27017/three-tier-crud` | MongoDB connection URI  |
| `NODE_ENV`    | `development`                              | Environment mode        |
| `CORS_ORIGIN` | `*`                                        | Allowed CORS origin     |

### Frontend

| Variable              | Default | Description           |
|-----------------------|---------|-----------------------|
| `VITE_API_BASE_URL`   | (empty) | Backend API base URL  |

---

## 🧪 Running Tests

### Backend Tests (Jest + Supertest + mongodb-memory-server)

```bash
cd backend
npm install
npm test                # Run tests
npm run test:coverage   # Run tests with coverage
```

### Frontend Tests (Vitest + React Testing Library)

```bash
cd frontend
npm install
npm test
```

---

## 🏗️ Building Docker Images

### Backend

```bash
cd backend
docker build -t crud-backend .
docker run -p 5000:5000 -e MONGO_URI=mongodb://host.docker.internal:27017/crud crud-backend
```

### Frontend

```bash
cd frontend
docker build --build-arg VITE_API_BASE_URL=http://localhost:5000 -t crud-frontend .
docker run -p 8080:8080 crud-frontend
```

---

## 🔄 curl Examples

### Health Check

```bash
curl http://localhost:5000/health
```

### Create Item

```bash
curl -X POST http://localhost:5000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name": "My Task", "description": "Something to do", "status": "pending"}'
```

### List Items

```bash
curl http://localhost:5000/api/items
```

### Search Items

```bash
curl "http://localhost:5000/api/items?search=task&status=pending"
```

### Update Item

```bash
curl -X PUT http://localhost:5000/api/items/<ITEM_ID> \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Task", "status": "in-progress"}'
```

### Delete Item

```bash
curl -X DELETE http://localhost:5000/api/items/<ITEM_ID>
```

---

## 🔁 Running Jenkins Pipelines

### Prerequisites

1. **Jenkins** with Pipeline, Docker Pipeline, and SonarQube Scanner plugins.
2. **Credentials** configured in Jenkins:
   - `docker-hub-credentials` – Docker registry username/password.
3. **SonarQube** server configured in Jenkins global settings as `SonarQubeServer`.
4. **Trivy** installed on Jenkins agents.

### Pipeline Configuration

| Pipeline               | Jenkinsfile                     |
|------------------------|---------------------------------|
| Backend CI/CD          | `jenkins/Jenkinsfile-backend`   |
| Frontend CI/CD         | `jenkins/Jenkinsfile-frontend`  |

Each pipeline:
1. Checks out the repository.
2. Installs dependencies (`npm ci`).
3. Runs lint (if configured).
4. Runs tests and archives reports.
5. Performs SonarQube analysis with quality gate.
6. Builds Docker image (tagged with commit SHA).
7. Scans image with Trivy (fails on CRITICAL vulnerabilities).
8. Pushes image to Docker registry.
9. Cleans up workspace and images.

---

## 📊 SonarQube Setup Notes

- Backend uses `backend/sonar-project.properties` for configuration.
- Frontend SonarQube analysis is configured inline in its Jenkinsfile.
- Ensure `sonar-scanner` is available on Jenkins agents.
- Configure the SonarQube server URL and token in Jenkins → Manage Jenkins → Configure System.

---

## 🛡️ Trivy Scan Notes

- Trivy scans Docker images for known vulnerabilities.
- Pipelines fail on **CRITICAL** severity findings (`--exit-code 1 --severity CRITICAL`).
- Install Trivy: `sudo apt-get install trivy` or use the official container.
- For local scans:
  ```bash
  trivy image crud-backend:latest
  trivy image crud-frontend:latest
  ```

---

## 🔒 Security Best Practices Used

| Practice                          | Where                      |
|-----------------------------------|----------------------------|
| Helmet.js security headers        | Backend middleware          |
| CORS restriction                  | Backend `CORS_ORIGIN` env  |
| Input validation & sanitization   | Backend route handlers     |
| Non-root Docker containers        | Both Dockerfiles           |
| `.dockerignore`                   | Backend                    |
| Multi-stage Docker builds         | Both Dockerfiles           |
| Nginx security headers            | `frontend/nginx.conf`      |
| No hardcoded secrets              | Jenkins credentials store  |
| ObjectId validation               | Backend route handlers     |
| Graceful shutdown                 | Backend SIGTERM/SIGINT     |
| Stack trace suppression           | Production error handler   |
| Small Alpine-based images         | Both Dockerfiles           |
| Health checks                     | Docker Compose + backend   |

---

## 🐛 Troubleshooting

### MongoDB connection refused
```bash
# Ensure MongoDB is running
docker compose ps
# Or start MongoDB locally
mongod --dbpath /data/db
```

### Port already in use
```bash
# Find and kill the process using the port
lsof -i :5000
kill -9 <PID>
```

### Docker build fails
```bash
# Clean Docker cache and rebuild
docker compose build --no-cache
```

### Frontend can't reach backend
- Ensure `VITE_API_BASE_URL` is set correctly.
- In Docker Compose, the frontend calls `http://localhost:5000` (host network).
- Check CORS settings match the frontend origin.

### Tests fail with timeout
```bash
# Increase Jest timeout
cd backend
npx jest --testTimeout=30000
```

### Health check failing in Docker
```bash
# Check container logs
docker compose logs backend
docker compose logs mongodb
```

---

## 📄 License

MIT
