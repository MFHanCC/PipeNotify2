# Implementation Plan

## Plan &amp; Review

### Before starting work

*   Always in plan mode to make a plan
*   After get the plan, make sure you Write the plan to claude/tasks/TASK_NAME.md.
*   The plan should be a detailed implementation plan and the reasoning behind them, as well as tasks broken down.
*   If the task require external knowledge or certain package, also research to get latest knowledge (Use Task tool for research)
*   Don't over plan it, always think MVP.
*   Once you write the plan, firstly ask me to review it. Do not continue until I approve the plan.

### While implementing

*   You should update the plan as you work.
*   After you complete tasks in the plan, you should update and append detailed descriptions of the changes you made, so following tasks can be easily hand over to other engineers.

## Phase 1: Environment Setup

1.  **Prevalidation**: Check if the project root contains a `.git` directory or `package.json`; if found, skip initialization and proceed (Prevalidation).
2.  **Install Node.js**: Install Node.js v20.2.1 globally if not already installed (Tech Stack: Core Tools).
3.  **Validation**: Run `node -v` and confirm the output is `v20.2.1` (Tech Stack: Core Tools).
4.  **Initialize Git**: If `.git` does not exist, run `git init` in the project root (Tech Stack: CI/CD).
5.  **Create directories**: Create `/backend` and `/frontend` directories in the project root (User Flow: Installation).
6.  **Backend init**: In `/backend`, run `npm init -y` to generate a `package.json` (Tech Stack: Backend).
7.  **Environment file**: Create `/backend/.env` with placeholder variables:

```
DATABASE_URL=
REDIS_URL=
PIPEDRIVE_API_TOKEN=
SENTRY_DSN=
```
(Key Requirements: Security)

8.  **Frontend init**: In the project root, run `npx create-react-app frontend` to scaffold the React app in `/frontend` (Tech Stack: Frontend).
9.  **Router install**: In `/frontend`, run `npm install react-router-dom@6` (User Flow: Onboarding Wizard).
10. **Gitignore**: Add `/backend/node_modules`, `/frontend/node_modules`, and `/.env` to the project's `.gitignore` (Tech Stack: CI/CD).

## Phase 2: Frontend Development

1.  **OnboardingWizard component**: Create `/frontend/src/components/OnboardingWizard.js` with form fields for:
    *   Pipedrive API token
    *   Google Chat webhook URLs
    *   Template selection
    *   Filter/routing rules (User Flow Steps 2a–2d)

2.  **Dashboard component**: Create `/frontend/src/components/Dashboard.js` with UI placeholders for rules list and logs table (User Flow Step 3).

3.  **Routing**: Update `/frontend/src/App.js` to route `/onboarding` → `<OnboardingWizard>` and `/dashboard` → `<Dashboard>` (User Flow).

4.  **API service**: Create `/frontend/src/services/api.js` defining functions `getRules()`, `createRule()`, `listLogs()`, and `testNotification()` using `fetch` (App Flow).

5.  **Environment setup**: Create `/frontend/.env.development` and `/frontend/.env.production` with:
```
REACT_APP_API_URL=http://localhost:3001
```

6.  **Validation**: In `/frontend`, run `npm start` and verify that <http://localhost:3000/onboarding> loads the OnboardingWizard form (Tech Stack: Frontend).

## Phase 3: Backend Development

1.  **Express server**: Create `/backend/server.js` and scaffold an Express app listening on port 3001, configured with `helmet` and `cors` (Tech Stack: Backend).
2.  **Dependencies**: In `/backend`, run:
```bash
npm install express dotenv bullmq pg axios @sentry/node cors helmet
```
(Tech Stack: Backend & Error Tracking)

3.  **CORS Configuration**: In `/backend/server.js`, configure CORS to allow both development and production origins:
```javascript
const allowedOrigins = [
  'http://localhost:3000', // Development
  'https://your-app.vercel.app', // Production Vercel
  process.env.FRONTEND_URL // Dynamic production URL
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
```

4.  **Webhook route**: Create `/backend/routes/webhook.js` with a `POST /api/v1/webhook/pipedrive` endpoint to accept Pipedrive webhooks (Project Description: Webhook subscriptions).
5.  **Admin routes**: Create `/backend/routes/admin.js` with CRUD endpoints under `/api/v1/admin/rules` and `/api/v1/admin/logs` (User Flow: Dashboard).
6.  **Mount routes**: In `server.js`, import and mount `routes/webhook.js` and `routes/admin.js` under `/api/v1` (Project Description).
7.  **Job processor**: Create `/backend/jobs/processor.js` defining a BullMQ worker to process `notification` jobs (Key Features: Delivery to Chat).
8.  **Job queue**: Create `/backend/jobs/queue.js` exporting a BullMQ `Queue` connected to `process.env.REDIS_URL` (Tech Stack: Job Queue).
9.  **Database schema**: Create `/backend/db/schema.sql` with tables and relations:
    * tenants(id serial PRIMARY KEY, company_name text NOT NULL, created_at timestamptz)
    * pipedrive_connections(id serial PRIMARY KEY, tenant_id int REFERENCES tenants(id), api_token text NOT NULL, connected_at timestamptz)
    * chat_webhooks(id serial PRIMARY KEY, tenant_id int REFERENCES tenants(id), name text NOT NULL, webhook_url text NOT NULL, created_at timestamptz)
    * rules(id serial PRIMARY KEY, tenant_id int REFERENCES tenants(id), name text NOT NULL, event_type text NOT NULL, filters jsonb NOT NULL, target_webhook_id int REFERENCES chat_webhooks(id), template_mode text, enabled boolean DEFAULT true, created_at timestamptz, updated_at timestamptz)
    * logs(id serial PRIMARY KEY, tenant_id int REFERENCES tenants(id), rule_id int REFERENCES rules(id), payload jsonb NOT NULL, status text, error_message text, created_at timestamptz)
    (Tech Stack: Database)

10. **Validation**: Run:
```bash
docker run --name pd-db -e POSTGRES_PASSWORD=pass -d -p 5432:5432 postgres:15.3
psql -h localhost -U postgres -f backend/db/schema.sql
```
Confirm tables exist (Tech Stack: Database).

11. **Migration script**: Create `/backend/db/migrate.sh` with:
```bash
#!/usr/bin/env bash
psql "$DATABASE_URL" < db/schema.sql
```
(Tech Stack: Database)

12. **Sentry init**: In `/backend/server.js`, initialize Sentry with `SENTRY_DSN` from `process.env` (Key Requirements: Error Tracking).
13. **Pipedrive client**: Create `/backend/services/pipedriveClient.js` with functions to call the Pipedrive API using `process.env.PIPEDRIVE_API_TOKEN` (Project Description: Pipedrive Integration).
14. **Chat client**: Create `/backend/services/chatClient.js` exporting `sendToChat(webhookUrl, message)` that posts JSON via `axios.post` (Project Description: Google Chat Integration).
15. **Backend tests**: Install `jest` and `supertest`, add tests in `/backend/tests/webhook.test.js`, then run `npm test` in `/backend` to confirm all tests pass (Tech Stack: Backend).

## Phase 4: Integration

1.  **Enqueue events**: In `/backend/routes/webhook.js`, enqueue each incoming webhook payload to the BullMQ `notification` queue (Project Description).
2.  **Process jobs**: In `/backend/jobs/processor.js`, query Postgres for matching rules and call `sendToChat` for each corresponding webhook URL (Key Features: Filtering & Routing).
3.  **Frontend integration**: In `/frontend/src/services/api.js`, wire `getRules()` and `listLogs()` into the `<Dashboard>` component (App Flow).
4.  **Environment variables**: Update frontend API service to use `process.env.REACT_APP_API_URL` for backend communication.
5.  **Validation**: Use Postman to `POST` a sample Pipedrive event to `http://localhost:3001/api/v1/webhook/pipedrive` and verify a message posts to a test Google Chat webhook (Project Description).

## Phase 5: Deployment

### 5.1 Backend Deployment (Railway)
1.  **Railway setup**: Create Railway project and connect GitHub repository for backend deployment.
2.  **Railway config**: Create `railway.toml` in `/backend` directory:
```toml
[build]
builder = "nixpacks"
buildCommand = "npm install"

[deploy]
startCommand = "npm start"
restartPolicyType = "never"
```

3.  **Environment variables**: In Railway dashboard, set:
    - `DATABASE_URL` (auto-generated by Railway PostgreSQL)
    - `REDIS_URL` (auto-generated by Railway Redis)
    - `PIPEDRIVE_API_TOKEN`
    - `SENTRY_DSN`
    - `NODE_ENV=production`
    - `FRONTEND_URL` (will be set after Vercel deployment)

4.  **Database setup**: Add Railway PostgreSQL and Redis services to project.
5.  **Migration**: Run database migration script via Railway console.

### 5.2 Frontend Deployment (Vercel)
1.  **Vercel setup**: Install Vercel CLI: `npm install -g vercel`
2.  **Deploy frontend**: In `/frontend` directory, run `vercel --prod`
3.  **Environment variables**: In Vercel dashboard, set:
    - `REACT_APP_API_URL` to Railway backend URL (e.g., `https://your-backend.railway.app`)
4.  **Custom domain**: Configure custom domain in Vercel dashboard if desired.
5.  **Update CORS**: Update Railway backend's `FRONTEND_URL` environment variable with Vercel deployment URL.

### 5.3 CI/CD Setup
1.  **GitHub Actions**: Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install backend dependencies
        run: cd backend && npm install
      - name: Run backend tests
        run: cd backend && npm test
      - name: Deploy to Railway
        run: |
          cd backend
          railway deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install frontend dependencies
        run: cd frontend && npm install
      - name: Build frontend
        run: cd frontend && npm run build
      - name: Deploy to Vercel
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

2.  **Secrets setup**: Add `RAILWAY_TOKEN` and `VERCEL_TOKEN` to GitHub Actions secrets.
3.  **Sentry releases**: Add Sentry CLI commands to track releases (Key Requirements: Error Tracking).

### 5.4 Validation
1.  **Production testing**: Verify Railway backend responds at production URL.
2.  **Frontend testing**: Verify Vercel frontend loads and can communicate with Railway backend.
3.  **End-to-end testing**: Create test rule and verify webhook flow works end-to-end in production environment.
4.  **Monitoring setup**: Confirm Sentry is capturing errors from both frontend and backend in production.