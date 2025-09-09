# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Pipedrive → Google Chat Integration

Railway backend + Vercel frontend marketplace app with OAuth 2.0 compliance for Pipedrive Marketplace.

## Project Architecture

**Frontend (Vercel):**
- React with Tailwind CSS and React Router v6
- Feature-driven component structure in `/frontend/src/`
- API communication with Railway backend via environment variables

**Backend (Railway):**
- Node.js + Express.js stateless web service  
- PostgreSQL for tenant data, rules, webhooks, and logs
- BullMQ + Redis for background job processing and retries
- Modular structure: routes, services, data access layer

**Key Integrations:**
- Pipedrive API for webhook subscriptions and event processing
- Google Chat incoming webhooks for notification delivery
- Sentry for error tracking on both frontend and backend

## Development Commands

**Environment Setup (per Implementation Plan):**
```bash
# Phase 1: Initialize project structure
mkdir -p backend frontend
cd backend && npm init -y
cd ../frontend && npx create-react-app .

# Install core dependencies
cd backend && npm install express dotenv bullmq pg axios @sentry/node cors helmet
cd ../frontend && npm install react-router-dom@6
```

**Database Management:**
```bash
# Local development database setup
docker run --name pd-db -e POSTGRES_PASSWORD=pass -d -p 5432:5432 postgres:15.3
psql -h localhost -U postgres -f backend/db/schema.sql

# Production migration (Railway)
./backend/db/migrate.sh
```

**Development Servers:**
```bash
# Backend (port 3001)
cd backend && npm start

# Frontend (port 3000) 
cd frontend && npm start
```

**Testing:**
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E testing
cd frontend && npx cypress open
```

## Database Schema

Multi-tenant PostgreSQL schema with the following core tables:
- **tenants**: Customer accounts (company_name, created_at)
- **pipedrive_connections**: API tokens per tenant (encrypted)
- **chat_webhooks**: Google Chat webhook URLs per tenant (encrypted)
- **rules**: Event filtering and routing logic (JSONB filters, target_webhook_id)
- **logs**: Notification delivery attempts and status (90-day retention)
- **subscriptions**: Billing tier management (Professional/Enterprise)

All tables include tenant_id for multi-tenant isolation.

## API Design

RESTful endpoints with tenant authentication:
- `POST /connect/pipedrive` - Store Pipedrive API token
- `POST /webhook/pipedrive` - Receive Pipedrive webhooks (HMAC verified)
- `GET /rules`, `POST /rules`, `PUT /rules/:id`, `DELETE /rules/:id` - Rule CRUD
- `POST /test` - Test notification delivery
- `GET /logs` - Recent delivery logs
- `GET /health` - Service health check

## CORS Configuration

Backend configured for Vercel frontend domains:
```javascript
const allowedOrigins = [
  'http://localhost:3000', // Development
  'https://your-app.vercel.app', // Production
  process.env.FRONTEND_URL // Dynamic production URL
];
```

## Deployment Strategy

**Backend (Railway):**
- Managed PostgreSQL and Redis services
- Environment variables for secrets (DATABASE_URL, REDIS_URL, PIPEDRIVE_API_TOKEN)
- Automatic deployments from GitHub main branch

**Frontend (Vercel):**
- Global CDN with automatic deployments
- Environment: REACT_APP_API_URL pointing to Railway backend
- Preview deployments for pull requests

**CI/CD:**
- GitHub Actions for testing and deployment coordination
- Tests must pass before deployment
- Automated Railway and Vercel deployments on main branch push

## Documentation Structure

- `docs/project_requirements_document.md` - Complete PRD and scope
- `docs/development/implementation_plan.md` - Phase-by-phase development plan
- `docs/architecture/` - Technical architecture documents
  - `tech_stack_document.md` - Technology choices and rationale
  - `backend_structure_document.md` - API design and database schema
  - `frontend_guidelines_document.md` - React component structure and Vercel deployment
  - `app_flowchart.md` - User flow diagrams

## Current Phase

Development phase focusing on OAuth 2.0 implementation for Pipedrive Marketplace approval. Priority is achieving marketplace approval on first submission.

## Security Requirements

- TLS encryption for all traffic
- HMAC webhook signature validation
- Encrypted storage for API tokens and webhook URLs
- 90-day log retention with auto-purge
- Tenant isolation in all database queries
- Rate limiting and exponential backoff for external API calls