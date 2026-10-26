# CourseCompass

CourseCompass helps university students search and compare courses, save courses, record completed study, build semester plans, submit reviews, and receive AI-assisted recommendations. Moderators manage reviews and reports; administrators manage courses, subjects, and users.

## Technology

| Area | Implementation |
| --- | --- |
| Frontend | Vue 3, Vue Router, Pinia, Element Plus, Axios, Vite |
| Backend | Node.js, Express, CommonJS |
| Database | PostgreSQL with pgvector, Prisma ORM |
| Semantic search | SiliconFlow BAAI/bge-m3 embeddings |
| AI explanations | Zhipu AI |

Chart.js is not used in the current implementation. References to Chart.js in the proposal describe a planned dependency rather than an implemented feature.

## Project structure

```text
backend/
  prisma/
    migrations/
    schema.prisma
  scripts/
  src/
    controllers/
    lib/
    middlewares/
    routes/
    services/
    utils/
  test/
    integration/
  .env.example
  app.js
  package.json
frontend/
  public/
  src/
    api/
    components/
    images/
    router/
    stores/
    utils/
    views/
  test/
  .env.example
  package.json
  vite.config.js
.github/workflows/ci.yml
README.md
```

The frontend and backend manage dependencies separately. Run npm commands in the relevant directory; there is no root npm package. Prisma CLI commands run from backend, discover prisma/schema.prisma, and load backend/.env without a separate Prisma configuration file.

## Requirements

- Node.js 22.12 or later and npm. CI uses Node.js 22.
- PostgreSQL with pgvector support, such as a configured Supabase database.
- SiliconFlow and Zhipu API credentials for AI features.
- SMTP credentials for password-reset emails.

## Backend setup

From the repository root:

```bash
cd backend
npm ci
npx prisma generate
```

Copy backend/.env.example to backend/.env and replace the placeholders:

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | Secret used to sign authentication tokens |
| PORT | API port; defaults to 3000 |
| CORS_ORIGIN | Optional comma-separated allowed frontend origins |
| SILICONFLOW_API_KEY | Embedding provider credential |
| SILICONFLOW_EMBEDDING_MODEL | Embedding model; BAAI/bge-m3 |
| SILICONFLOW_EMBEDDING_URL | Embedding endpoint |
| AI_SIMILARITY_THRESHOLD | Semantic-search similarity threshold |
| ZHIPU_API_KEY | AI explanation provider credential |
| ZHIPU_API_URL | Chat completion endpoint |
| SMTP_HOST, SMTP_PORT | Mail server connection settings |
| SMTP_USER, SMTP_PASS | Mail server credentials |

For Gmail SMTP, enable two-step verification and use an app password as SMTP_PASS.

With the database and API credentials configured, run:

```bash
npm run setup
npm run dev
```

The setup command validates the schema, generates Prisma Client, applies database migrations, prepares course embeddings, and checks migration status. It changes the configured database and calls the embedding provider. Use npm start to run the API without the development watcher.

The API is available at http://localhost:3000/api.

## Frontend setup

In a separate terminal, from the repository root:

```bash
cd frontend
npm ci
```

Copy frontend/.env.example to frontend/.env and set VITE_API_BASE_URL to your API URL. The local default is http://localhost:3000/api.

```bash
npm run dev
```

Open http://localhost:5173. To build and preview the production frontend:

```bash
npm run build
npm run preview
```

## Tests and maintenance

Run frontend tests from frontend:

```bash
npm test
```

Run backend unit and regression tests from backend:

```bash
node --test --test-concurrency=1 test/*.test.js
```

Running npm test in backend also runs integration tests. These require a configured database and create temporary fixtures; use a dedicated test database.

| Backend command | Purpose |
| --- | --- |
| npx prisma validate | Validate the database schema |
| npx prisma generate | Regenerate Prisma Client |
| npx prisma migrate status | Inspect database migration status |
| npm run embeddings:generate | Generate missing course embeddings |
| npm run embeddings:rebuild | Regenerate all course embeddings |

Keep existing migration SQL files unchanged after deployment so their checksums continue to match the database migration history.

CI builds the frontend, validates Prisma, checks backend syntax, and verifies database and API connectivity. Configure the DATABASE_URL and JWT_SECRET repository secrets; AI provider credentials are also read from repository secrets.
