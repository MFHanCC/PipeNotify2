# Frontend Guideline Document

Welcome to the Frontend Guideline Document for the Pipedrive → Google Chat Integration project. This guide explains how we build and organize our frontend so anyone—technical or not—can understand the setup using Vercel hosting.

## 1. Frontend Architecture

**Frameworks &amp; Libraries**
- **React**: Our core UI library for building interactive components.
- **Tailwind CSS**: Utility-first CSS framework for rapid styling.
- **CSS Modules**: Scoped CSS for custom component styles where needed.
- **React Router (v6)**: Manages navigation between views.

**How It Supports Our Goals**
- **Scalability**: Component-based structure lets us add features without rewriting existing code. Tailwind's utility classes and CSS Modules prevent style conflicts.
- **Maintainability**: Clear folder structure (see "Component Structure") and shared UI components speed up development and onboarding.
- **Performance**: React's virtual DOM and Tailwind's built-in purge process keep bundle sizes small. We also implement code splitting and lazy loading (see Performance Optimization). Vercel's global CDN ensures fast loading worldwide.

## 2. Design Principles

We follow three core principles to ensure a polished user experience:

1. **Usability**
   - Simple, self-explanatory UI patterns (e.g., clear form labels, concise buttons).
   - Feedback on actions (loading spinners, success/error toasts).
2. **Accessibility**
   - Semantic HTML (proper use of `<button>`, `<nav>`, `<header>`).
   - Keyboard navigable components and ARIA attributes on custom elements.
   - Sufficient color contrast following WCAG guidelines.
3. **Responsiveness**
   - Mobile-first design with Tailwind breakpoints (`sm`, `md`, `lg`, `xl`).
   - Flexible layouts—grids and flexbox—to adapt to varying screen sizes.

These principles guide every screen, from the connect-account flow to the rules management dashboard.

## 3. Styling and Theming

### Approach &amp; Methodology
- **Tailwind CSS** for most styling. Utility classes define spacing, typography, colors, and layout.
- **CSS Modules** for one-off styles (animations, complex overrides).

### Theming
- No runtime theming toggle in MVP. We ship a single, consistent theme matching the Pipedrive/Google Chat neutral brand.
- Future phases may introduce light/dark modes using Tailwind's configuration.

### Visual Style
- **Style**: Modern flat design—clean surfaces, minimal shadows, crisp edges.

### Color Palette
- Primary Blue: `#3B82F6` (blue-500)
- Dark Blue: `#1E40AF` (blue-900)
- Light Gray: `#F3F4F6` (gray-100)
- Medium Gray: `#9CA3AF` (gray-400)
- White: `#FFFFFF`
- Error Red: `#EF4444` (red-500)
- Success Green: `#10B981` (green-500)

### Typography
- **Font Family**: Inter for headings, Roboto for body text.
- **Sizing**: Tailwind's scale (`text-sm`, `text-base`, `text-lg`, etc.) ensures consistency.

## 4. Component Structure

We organize code in a feature-first layout:

- `/src`
  - `/components` – Reusable UI elements (buttons, form inputs, modals).
  - `/features` – Feature modules (ConnectAccount, RulesManager, Logs).
    - Each feature has its own folder with `components`, `hooks`, `services`, and `styles`.
  - `/layouts` – App-level wrappers (DashboardLayout, AuthLayout).
  - `/routes` – Route definitions and lazy imports.
  - `/utils` – Shared helpers (API calls, validation, date formatting).

**Key Benefits**
- **Reusability**: Centralized components avoid duplication (e.g., a single <Button> for all screens).
- **Clarity**: Developers know where to find or place new code.
- **Maintainability**: Isolated features reduce risk of unintended side effects.

## 5. State Management

We use React's built-in tools:
- **Context API + useReducer** for global state (user info, connection status, feature flags).
- **Local State (useState)** within individual components for UI states (modals open/close, form inputs).

**Why This Approach?**
- Lightweight, no extra dependencies.
- Easy to reason about and debug.
- Scales for the MVP scope; we can migrate to Redux Toolkit if state logic becomes more complex.

## 6. Routing and Navigation

**Library**: React Router v6

**Structure**:
- `/login` – Connect account flow.
- `/dashboard` – Main area for rules, logs, and settings.
- `/dashboard/rules` – List and edit rules.
- `/dashboard/logs` – Recent deliveries and status.
- `/settings` – Billing and admin settings.

**Navigation Patterns**:
- Sidebar on desktop, bottom nav on mobile.
- Breadcrumbs at top of dashboard pages for context.
- Protected routes redirect unauthorized users to `/login`.

## 7. Performance Optimization

We prioritize fast load times and snappy interactions:

- **Code Splitting**: Load each major route on demand with `React.lazy` + `Suspense`.
- **Lazy Loading**: Defer non-critical UI (e.g., charts in analytics) until needed.
- **Tailwind Purge**: Removes unused CSS in production builds.
- **Image Optimization**: Serve optimized SVGs or compressed PNG/JPG.
- **Bundle Analysis**: Periodic checks with tools like `webpack-bundle-analyzer`.
- **Vercel Edge CDN**: Automatic global content distribution for optimal loading speeds.

These steps keep the initial download small and speed up first paint globally.

## 8. Testing and Quality Assurance

**Unit &amp; Integration**
- **Jest**: Test runner for functions, reducers, and utility modules.
- **React Testing Library**: Tests components by simulating user interactions.

**End-to-End (E2E)**
- **Cypress**: Simulate full workflows (connect account, create rule, view logs).

**Linting &amp; Formatting**
- **ESLint** with Airbnb rules + project overrides ensures code consistency.
- **Prettier** formats code on save or pre-commit.

**Continuous Integration**
- Tests run on every pull request in GitHub Actions. Build must pass before merge.
- Vercel automatically runs build checks on every deployment.

## 9. Environment Management and API Integration

### Environment Variables
We use React's built-in environment variable system with Vercel integration:

```javascript
// .env.development
REACT_APP_API_URL=http://localhost:3001

// .env.production (configured in Vercel dashboard)
REACT_APP_API_URL=https://your-backend.railway.app
```

### API Service Configuration
```javascript
// src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const apiService = {
  getRules: () => fetch(`${API_BASE_URL}/api/v1/rules`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  }),
  // ... other API methods
};

export default apiService;
```

## 10. Deployment on Vercel

### Initial Setup
1. **Connect Repository**: Link GitHub repository to Vercel project
2. **Configure Build Settings**: 
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`

### Environment Variables in Vercel
Configure in Vercel dashboard under Project Settings > Environment Variables:
- `REACT_APP_API_URL`: Backend API URL (Railway deployment URL)
- `REACT_APP_SENTRY_DSN`: Sentry DSN for frontend error tracking (if using)

### Custom Domain Setup
1. Add domain in Vercel dashboard under Project Settings > Domains
2. Configure DNS records as instructed by Vercel
3. Automatic SSL certificate provisioning

### Deployment Configuration
```json
// vercel.json (optional, for advanced configuration)
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

### Automatic Deployments
- **Production**: Every push to `main` branch triggers automatic deployment
- **Preview**: Every pull request creates a preview deployment with unique URL
- **Rollbacks**: Easy rollback to previous deployments via Vercel dashboard

### Performance Monitoring
Vercel provides built-in analytics:
- **Core Web Vitals**: LCP, FID, CLS metrics
- **Real User Monitoring**: Performance data from actual users
- **Edge Network Analytics**: Global performance insights

## 11. Security Considerations for Vercel Deployment

### Content Security Policy
Configure CSP headers via `vercel.json` or `next.config.js`:
```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://your-backend.railway.app;"
}
```

### Environment Variable Security
- Never expose sensitive data in frontend environment variables
- Use `REACT_APP_` prefix for client-side variables only
- Backend secrets remain on Railway, never in Vercel configuration

### CORS Integration
Frontend automatically works with Railway backend CORS configuration:
```javascript
// Backend allows Vercel origins
const allowedOrigins = [
  'http://localhost:3000', // Development
  'https://your-app.vercel.app', // Production
  'https://your-custom-domain.com' // Custom domain
];
```

## 12. Conclusion and Overall Frontend Summary

This guide lays out a clear, maintainable, and scalable frontend for our Pipedrive → Google Chat integration, optimized for Vercel hosting:

- **Architecture**: React + Tailwind + React Router deployed on Vercel's global CDN.
- **Principles**: Usability, accessibility, responsiveness with worldwide performance.
- **Styling**: Modern flat design with a neutral color palette and Inter/Roboto fonts.
- **Structure**: Feature-driven file organization and reusable components.
- **State**: Context API for global, local state for component scope.
- **Performance**: Lazy loading, code splitting, CSS purging, plus Vercel's edge optimization.
- **Deployment**: Automatic deployments, preview environments, and global CDN distribution.
- **Integration**: Seamless connection to Railway backend with proper CORS and environment management.
- **QA**: Jest, React Testing Library, Cypress, ESLint, Prettier, plus Vercel's build-time checks.

Together, these practices ensure a reliable, performant, and user-friendly application that meets our project goals and delights our users with fast loading times globally through Vercel's edge network, while maintaining secure and efficient communication with our Railway-hosted backend.