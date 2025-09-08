# Project Requirements Document (PRD)

## 1. Project Overview

This project delivers a native Pipedrive Marketplace app that sends real-time, actionable notifications into Google Chat for key CRM events—think "Dealbot, but for Google Chat." Sales, sales-ops, and customer-success teams using Pipedrive and Google Workspace can install the app in minutes, choose curated templates (e.g., Deal Won, Stage Changed, Activity Overdue), configure filters (pipeline, stage, deal value), and route alerts into specific Chat spaces. The goal is parity with existing Slack and Teams integrations, packaged as a simple "install-and-go" solution without no-code workflow builders.

We're building this to meet repeated requests from Pipedrive's 100,000+ customers who rely on Google Chat as their primary collaboration tool. Success means an intuitive onboarding wizard in Pipedrive, sub-10-second delivery of filtered notifications, a 99.9% uptime for webhooks, and strong adoption—measured by installs, active rules, and retention after the 7-day trial. Key objectives are to minimize noise with robust filters, provide clear routing, and maintain a secure, auditable environment.

## 2. In-Scope vs. Out-of-Scope

In-Scope (MVP – Phase 1)

*   Pipedrive webhook subscription management (create/list/pause/delete) for deals, activities, leads, people, organizations.
*   Curated notification templates (compact/detailed) for Deal Won, Stage Changed, Activity Assigned/Overdue, New Person/Lead/Organization.
*   Per-rule filters (pipeline, stage, owner, deal-value thresholds) and routing to Google Chat spaces via incoming webhook URLs.
*   Delivery logic: HTTP POST to Chat webhook, exponential-backoff retries, failure logging.
*   Web app dashboard with onboarding wizard, rule editor, logs (last 50 events), test notifications.
*   Tenant isolation, Pipedrive API-token authentication, secret-token validation for webhooks.
*   Subscription management via Pipedrive Marketplace billing (7-day trial, Professional vs. Enterprise tiers).
*   Data retention: logs and metadata purged after 90 days; manual deletion on request.

Out-of-Scope (Phase 2+)

*   Full Google OAuth flow and Workspace-wide Chat-space discovery.
*   Card-style (rich) messages or interactive Chat actions.
*   Quiet-hours scheduling and deduplication.
*   Multi-admin/role-based access controls in dashboard.
*   Complex templating language or user-defined templates.
*   Bi-directional sync (updating Pipedrive from Chat).

## 3. User Flow

A new user installs the app from the Pipedrive Marketplace and is guided into an embedded onboarding wizard. First, they paste their Pipedrive API token (or grant OAuth in later phases). The system verifies permissions and lets them add one or more Google Chat incoming webhook URLs, confirming each via a quick validation request. Next, the user selects which event templates they want (Deal Won, Stage Changed, etc.), choosing between "compact" or "detailed" modes, and previews each with sample data.

After templates, they build notification rules: pick an event type, set filters (pipeline, stage, owner, minimum value), and assign a Chat space from the previously added webhooks. A live preview shows exactly what each message will look like. Finally, they run a "Test" for each rule; upon success, they click "Activate." From then on, the dashboard's Rules page shows toggles, last-fired timestamps, and target spaces, while the Logs page lists recent deliveries with status and error details. Under Settings, users view their subscription tier, remaining trial days, and can upgrade via Pipedrive billing.

## 4. Core Features

*   **Webhook Subscription Management**\
    Create, list, pause, and delete Pipedrive webhook subscriptions for deals, activities, leads, people, and organizations without leaving the app.
*   **Notification Templates**\
    Predefined messages for Deal Won, Deal Stage Changed, Activity Assigned/Overdue, New Person/Lead/Organization in compact and detailed formats.
*   **Filter &amp; Routing Engine**\
    Per-rule filters by pipeline, stage, owner, and deal-value thresholds; map each rule to a Google Chat space (via webhook URL).
*   **Delivery &amp; Retry Logic**\
    Send JSON payloads to Chat webhooks; implement exponential backoff and log failures for transparency.
*   **Dashboard &amp; Onboarding Wizard**\
    Step-by-step setup: connect Pipedrive, add Chat webhooks, choose templates, configure rules, test notifications; manage rules and view logs.
*   **Subscription &amp; Trial Management**\
    Professional vs. Enterprise tiers handled by Pipedrive Marketplace billing; 7-day free trial; upgrade flow inside dashboard.
*   **Admin &amp; Security Controls**\
    Tenant isolation; API-token auth; secret token validation on webhook events; 90-day log retention with auto-purge.
*   **Basic Analytics Dashboard**\
    Metrics: total notifications sent, delivery success/failure rates, filter usage over time (Phase 1). Enterprise adds multi-space stats, SLA monitoring.

## 5. Tech Stack &amp; Tools

*   **Frontend**: React (create-react-app), Tailwind CSS for utility-first styling
*   **Backend**: Node.js with Express.js
*   **Database**: PostgreSQL (tenant-aware schema or row isolation)
*   **Job Queue**: BullMQ (Node) for retry/backoff handling
*   **Backend Hosting**: Railway for Node.js service, PostgreSQL database, and Redis
*   **Frontend Hosting**: Vercel for React application with global CDN and GitHub integration
*   **Logging &amp; Monitoring**: Sentry for error tracking; custom in-app logs for delivery status
*   **Pipedrive Integration**: Pipedrive REST API (webhooks, record fetch) via API token (OAuth in Phase 2)
*   **Google Chat**: Incoming Webhooks (HTTP POST JSON)
*   **AI Assistant (optional Phase 2)**: Claude Code for codebase navigation; GPT-4 for Enterprise ChatBot features

## 6. Non-Functional Requirements

*   **Reliability**: 99.9% uptime for webhook handling and rule processing
*   **Performance**: Notifications delivered within 5–10 seconds of Pipedrive event arrival under normal load
*   **Scalability**: Multi-tenant isolation; per-tenant rate limits; queue-based horizontal scaling
*   **Security**:\
    • Encrypt secrets at rest\
    • Validate webhook payloads via shared secret\
    • Use minimal API scopes
*   **Usability**:\
    • Onboarding completion in under 5 minutes\
    • Clear inline previews and "Test" buttons
*   **Compliance**:\
    • 90-day log retention by default, auto-deletion afterward\
    • Manual data-deletion requests supported\
    • Documentation on Google Chat webhook security for Workspace admins

## 7. Constraints &amp; Assumptions

*   **Primary Billing** via Pipedrive Marketplace; Stripe fallback if marketplace billing is insufficient.
*   **Single-Admin Workflow** acceptable for MVP; multi-admin/role management in Phase 2.
*   **Google Chat Webhooks** must remain publicly reachable endpoints; assume no interactive cards for MVP.
*   **Pipedrive API Rate Limits**: Plan for 1000 calls/minute; batch record fetches judiciously.
*   **Railway Backend Environment**: supports env vars, persistent volumes; assume standard 512 MB RAM for backend service. Includes managed PostgreSQL and Redis.
*   **Vercel Frontend Environment**: global CDN hosting with GitHub integration for React application deployment.
*   **Data Model**: store only configuration and minimal event metadata—no sensitive notes.

## 8. Known Issues &amp; Potential Pitfalls

*   **API Rate Limits**\
    Pipedrive imposes limits on webhook creation and record fetches; mitigate by caching and exponential backoff.
*   **Google Chat Quotas**\
    Incoming webhooks may throttle at ~5 requests/sec/space; implement per-space queueing.
*   **Pipedrive Marketplace Approval**\
    App must meet Pipedrive's security and UI guidelines; plan buffer time for review.
*   **Secret Exposure**\
    Webhook URLs and Pipedrive tokens are sensitive; ensure encryption-at-rest and limited admin access.
*   **Event Duplication**\
    Pipedrive may retry webhooks on failures; enforce idempotency (track event IDs).
*   **Time Zone Discrepancies**\
    Deal timestamps vs. Chat viewer locale: normalize to user's locale or UTC with explicit label.
*   **Test vs. Production Data**\
    Sample data preview may differ from real payloads; document any schema mismatches.
*   **CORS Configuration**\
    Backend must properly configure CORS to allow Vercel frontend domains; maintain allow-list for development and production.

This PRD provides a clear reference for building the Pipedrive→Google Chat Integration app. Subsequent documents (Tech Stack, Frontend Guidelines, Backend Structure, Security Guidelines, etc.) can draw directly from these specifications without ambiguity.