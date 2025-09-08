# Tech Stack Document

This document outlines the technology choices for the Pipedrive → Google Chat Integration (Dealbot-style Notifications) project. It explains each component in everyday language, so that non-technical readers can understand how everything fits together and why these tools were selected.

## 1. Frontend Technologies

We built a simple, clean web interface (the dashboard and onboarding wizard) that lives inside the Pipedrive Marketplace and in a standalone web app. Key technologies:

- **React**  
  A popular JavaScript library for building interactive user interfaces. React lets us create components (like forms, lists, and previews) that update instantly when users change settings or run tests.

- **React Router**  
  Manages navigation within the app—so when you click on "Rules," "Logs," or "Settings," the page updates without a full reload, giving a smooth, app-like feel.

- **CSS Modules &amp; Utility Classes**  
  We scope styles to individual components so there's no risk of global style conflicts. Lightweight utility classes help us build a consistent, responsive layout that adapts to different screen sizes.

- **Inter / Roboto Fonts**  
  Clean, readable fonts that fit well into most SaaS dashboards and match the neutral, professional look we want.

- **Sentry (Browser SDK)**  
  Captures frontend errors in real time, so we can diagnose issues users encounter while navigating the dashboard or running tests.

## 2. Backend Technologies

The backend handles webhook subscriptions, event processing, rule management, and delivery of notifications to Google Chat.

- **Node.js**  
  A fast, event-driven JavaScript runtime—ideal for handling incoming webhooks and making outgoing HTTP requests (to Google Chat and Pipedrive).

- **Express.js**  
  A minimal web framework for Node.js that lets us define RESTful endpoints (e.g., `/webhook/pipedrive`, `/rules`, `/test`, `/logs`) in a clear, maintainable way.

- **PostgreSQL**  
  A reliable relational database to store user configuration, webhook subscriptions, notification rules, and delivery logs. Chosen for its robustness and proven scaling ability.

- **BullMQ**  
  A job-queue library that runs retryable background tasks. When we post to a Chat webhook and it fails temporarily, BullMQ handles exponential backoff and retry logic without blocking the main server.

- **Pipedrive API (Token + OAuth)**  
  Initially we use a Pipedrive API token for authentication. In Phase 2, we'll add full OAuth support for more granular permissions and multi-admin workflows.

- **Google Chat Incoming Webhooks**  
  The integration points for delivering notifications into Chat spaces. We store and validate each webhook URL, then send JSON payloads (text or cards) via simple HTTP POST.

- **Sentry (Server SDK)**  
  Captures backend errors and performance metrics, so we can monitor uptime, latency, and failure rates.

## 3. Infrastructure and Deployment

To keep operations simple and reliable, we leverage managed platforms optimized for their specific purposes:

- **Railway (Backend Hosting)**  
  Our backend hosting platform. Railway provisions the Node.js service, PostgreSQL database, Redis, and environment variables. It offers built-in HTTPS, easy scaling, and GitHub integration for backend services.

- **Vercel (Frontend Hosting)**  
  Our frontend hosting platform. Vercel provides global CDN distribution, automatic deployments from GitHub, and optimized React application hosting. It excels at serving static React builds with minimal configuration.

- **GitHub &amp; CI/CD**  
  We store all code in GitHub. Every push to `main` triggers CI/CD pipelines that run tests and deploy automatically—backend to Railway, frontend to Vercel.

- **Environment Management**  
  Backend secrets (Pipedrive tokens, Sentry DSN, database URL) live in Railway's environment settings. Frontend environment variables (API URLs) are configured in Vercel's dashboard.

- **Developer Tool: Claude Code**  
  An AI-powered coding assistant integrated into our terminal to help navigate the codebase, speed up routine tasks, and ensure consistency across services.

## 4. Third-Party Integrations

Our integration relies on several external services to deliver a polished experience:

- **Pipedrive Marketplace Billing**  
  Manages subscription tiers (Professional vs. Enterprise), trials, payments, and currency/country support. If Marketplace billing falls short, we'll add Stripe as a fallback.

- **Google Chat Incoming Webhooks**  
  Sends notifications into specific Chat spaces. Users paste the webhook URL into our dashboard, and we handle formatting and delivery.

- **Pipedrive API**  
  Creates and manages webhook subscriptions for deals, activities, leads, and more. We fetch record details as needed to enrich notifications.

- **Sentry**  
  Monitors both frontend and backend for errors, performance bottlenecks, and alerting.

## 5. Security and Performance Considerations

We've built in multiple layers of protection and tuning to ensure reliability and data safety:

- **Authentication &amp; Authorization**  
  - Phase 1: Single-admin API token per company  
  - Phase 2: Full OAuth support and role-based access for multiple admins

- **Webhook Validation**  
  We sign incoming Pipedrive events with a secret token and verify it before processing, preventing unauthorized calls.

- **Data Encryption &amp; Retention**  
  All secrets and sensitive fields are encrypted at rest. Configuration and logs are stored for 90 days, then automatically purged.

- **Rate Limiting &amp; Backoff**  
  - Outgoing Chat posts use exponential backoff on failure  
  - Per-tenant processing limits prevent noisy tenants from impacting others

- **CORS Configuration**  
  Backend configured to allow specific Vercel domains (development and production) while blocking unauthorized origins.

- **Performance Targets**  
  - 99.9% uptime for webhook endpoints  
  - 5–10 second end-to-end delivery under normal load  
  - Queue-based processing ensures bursts don't overwhelm the service
  - Global CDN ensures fast frontend loading worldwide

## 6. Conclusion and Overall Tech Stack Summary

Our chosen technologies work together to deliver a seamless, Pipedrive-native notification experience for Google Chat users:

- A **React** frontend hosted on **Vercel** and **Node.js/Express** backend hosted on **Railway** provide a familiar, maintainable, and optimally-hosted architecture.
- **PostgreSQL** and **BullMQ** on **Railway** ensure reliable data storage and background processing.
- **Vercel's global CDN** ensures fast frontend delivery worldwide while **Railway's managed services** handle backend reliability.
- **GitHub CI/CD** integration with both platforms keeps deployments simple and automatic.
- Integrations with **Pipedrive APIs**, **Google Chat webhooks**, and **Sentry** deliver robust functionality and observability.
- Security measures (token validation, encryption, rate limiting, CORS) and performance optimizations (queues, retries, CDN) guarantee a dependable user experience.

Together, these choices align perfectly with our goals: fast time-to-value, opinionated defaults, noise control, and easy setup for non-technical teams. The result is a scalable, secure, and user-friendly Dealbot-style app that brings Pipedrive events into Google Chat with minimal fuss and optimal performance characteristics.