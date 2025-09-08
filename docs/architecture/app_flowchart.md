# Marketplace-Compliant App Flowchart Document

This comprehensive **App Flowchart Document** provides detailed visual workflows for the Pipedrive → Google Chat Integration, specifically designed for **Pipedrive Marketplace approval** and **enterprise customer success** using **Railway backend + Vercel frontend architecture**. Every flow prioritizes **OAuth 2.0 compliance**, **Custom UI Extensions**, and **enterprise-grade user experience**.

## 1. Overview: Enterprise App Flow Architecture

Our app flow architecture is designed for **marketplace success** with **OAuth-first authentication**, **native Pipedrive integration**, and **enterprise scalability**. The complete user journey spans from marketplace installation through active usage with comprehensive error handling and security compliance using our optimized **Railway + Vercel deployment strategy**.

### Core Flow Principles

- **OAuth-First Security**: Every interaction begins with proper OAuth 2.0 authentication and authorization
- **Native Integration**: Custom UI Extensions provide seamless Pipedrive experience throughout all flows  
- **Progressive Disclosure**: Complex enterprise features revealed progressively to maintain simple initial experience
- **Error Resilience**: Comprehensive error handling with clear recovery paths at every decision point
- **Marketplace Compliance**: All flows meet Pipedrive Marketplace standards for approval and ongoing compliance
- **Split Architecture**: Railway backend handles secure API operations while Vercel frontend delivers global performance

## 2. Primary User Flow: Complete Journey Map

```mermaid
flowchart TD
    A[User discovers app in Pipedrive Marketplace] --> B[User clicks 'Install App']
    B --> C{Marketplace Authentication}
    C -->|Success| D[OAuth 2.0 Authorization Flow Initiated]
    C -->|Failed| E[Display marketplace login required]
    E --> C
    
    D --> F[Pipedrive OAuth Consent Screen]
    F --> G{User grants permissions?}
    G -->|Yes| H[OAuth callback with authorization code]
    G -->|No| I[Permission denied - show required scopes]
    I --> F
    
    H --> J[Railway Backend: Exchange code for access/refresh tokens]
    J --> K[Railway Backend: Create tenant record with encrypted tokens]
    K --> L[Vercel Frontend: Launch Custom Modal Onboarding Wizard]
    
    L --> M[Step 1: Welcome & Scope Confirmation]
    M --> N[Step 2: Google Chat Webhook Configuration]
    N --> O[Step 3: Notification Template Selection]
    O --> P[Step 4: Rule Configuration & Filtering]
    P --> Q[Step 5: Test Notifications]
    Q --> R[Step 6: Activation & Webhook Registration]
    
    R --> S[Redirect to Main Dashboard]
    S --> T[Active Integration - Processing Events]
    
    T --> U{Ongoing Usage Flows}
    U --> V[Rule Management]
    U --> W[Log Monitoring]
    U --> X[Settings & Billing]
    U --> Y[Enterprise Features]
```

## 3. OAuth 2.0 Authentication Flow (Railway Backend Processing)

```mermaid
flowchart TD
    A[User installs from Marketplace] --> B[Vercel Frontend: App initiates OAuth 2.0 flow]
    B --> C[Vercel Frontend: Generate PKCE code challenge & state]
    C --> D[Redirect to Pipedrive authorization server]
    
    D --> E[Pipedrive displays consent screen]
    E --> F{User consents?}
    F -->|Yes| G[Pipedrive redirects to Railway callback URL]
    F -->|No| H[User cancels - show error on Vercel]
    H --> I[Vercel Frontend: Provide retry option]
    I --> D
    
    G --> J[Railway Backend: Validate state parameter for CSRF protection]
    J --> K{State valid?}
    K -->|No| L[Railway Backend: Security error - abort flow]
    K -->|Yes| M[Railway Backend: Exchange authorization code for tokens]
    
    M --> N[Railway Backend: Store encrypted access/refresh tokens]
    N --> O[Railway Backend: Create authenticated session]
    O --> P[Vercel Frontend: Launch Custom Modal Onboarding]
    
    L --> Q[Railway Backend: Security incident logging]
    Q --> R[Vercel Frontend: Display security error to user]
    R --> S[Vercel Frontend: Provide secure retry option]
```

## 4. Custom UI Extensions Integration Flow (Vercel-hosted UI)

### 4.1 Custom Modal Onboarding Flow

```mermaid
flowchart TD
    A[OAuth authentication complete] --> B[Vercel Frontend: Launch Custom Modal in Pipedrive]
    B --> C[Load onboarding wizard in secure iframe from Vercel]
    C --> D[Establish secure parent-child communication]
    
    D --> E[Step 1: Welcome Screen]
    E --> F[Display integration benefits & overview]
    F --> G[Confirm user understands scope]
    G --> H[Continue to configuration]
    
    H --> I[Step 2: Google Chat Setup]
    I --> J[Webhook URL input with Railway API validation]
    J --> K{Railway Backend: Webhook validation}
    K -->|Valid| L[Green checkmark - webhook saved to Railway DB]
    K -->|Invalid| M[Red error - show debugging help]
    M --> N[Provide webhook troubleshooting guide]
    N --> J
    
    L --> O[Step 3: Template Selection]
    O --> P[Show template examples with live preview]
    P --> Q[User selects compact/detailed modes]
    Q --> R[Step 4: Rule Configuration]
    
    R --> S[Filter setup with real-time preview via Railway API]
    S --> T[Step 5: Test Notifications]
    T --> U[Railway Backend: Send test messages to verify configuration]
    U --> V{All tests pass?}
    V -->|Yes| W[Step 6: Activation]
    V -->|No| X[Show detailed error messages]
    X --> Y[Provide fix suggestions]
    Y --> S
    
    W --> Z[Railway Backend: Register Pipedrive webhooks]
    Z --> AA[Close Custom Modal]
    AA --> BB[Redirect to Vercel dashboard]
```

### 4.2 App Panel Contextual Integration

```mermaid
flowchart TD
    A[User opens deal/contact in Pipedrive] --> B[Pipedrive loads App Panel from Vercel]
    B --> C[Vercel Frontend: App Panel requests context data from Railway]
    C --> D[Railway Backend: Validate user authentication]
    D --> E{Valid session?}
    E -->|No| F[Redirect to OAuth login]
    E -->|Yes| G[Railway Backend: Load contextual notifications]
    
    G --> H[Railway Backend: Query relevant notification history]
    H --> I[Vercel Frontend: Display recent notifications for this record]
    I --> J[Show quick action buttons]
    
    J --> K{User interaction}
    K --> L[Send test notification via Railway]
    K --> M[Configure rule for this record]
    K --> N[View detailed logs]
    
    L --> O[Railway Backend: Immediate test message sent]
    M --> P[Vercel Frontend: Open rule configuration modal]
    N --> Q[Vercel Frontend: Open logs with record filter]
```

## 5. Onboarding Wizard Detailed Flow (Vercel UI + Railway Processing)

```mermaid
flowchart TD
    A[Custom Modal launches from Vercel] --> B[Initialize wizard state]
    B --> C[Step 1: Welcome & Validation]
    
    C --> D[Display integration overview]
    D --> E[Railway Backend: Confirm OAuth permissions are sufficient]
    E --> F{Permissions valid?}
    F -->|No| G[Show permission upgrade required]
    F -->|Yes| H[Continue to Step 2]
    
    G --> I[Redirect to OAuth with additional scopes]
    I --> J[Return to wizard after permission grant]
    J --> H
    
    H --> K[Step 2: Google Chat Configuration]
    K --> L[Webhook URL input field]
    L --> M[Railway Backend: Real-time webhook validation]
    M --> N{Webhook test successful?}
    N -->|Yes| O[Railway Backend: Save webhook with encryption]
    N -->|No| P[Display specific error message]
    
    P --> Q{Error type}
    Q --> R[URL unreachable - network error]
    Q --> S[Invalid response - format error]  
    Q --> T[Permission denied - auth error]
    
    R --> U[Show network troubleshooting]
    S --> V[Show webhook format guide]
    T --> W[Show Google Chat permission guide]
    
    U --> L
    V --> L  
    W --> L
    
    O --> X[Step 3: Template Selection]
    X --> Y[Show event types with examples]
    Y --> Z[Railway Backend: Live preview with sample data]
    Z --> AA[User selects templates & modes]
    AA --> BB[Step 4: Rule Configuration]
    
    BB --> CC[For each selected template]
    CC --> DD[Configure filters: pipeline, stage, owner, value]
    DD --> EE[Railway Backend: Real-time preview update]
    EE --> FF[Assign target Chat space]
    FF --> GG[Rule validation & preview]
    
    GG --> HH[Step 5: Test Notifications]
    HH --> II[Railway Backend: Send test for each configured rule]
    II --> JJ{All tests successful?}
    JJ -->|Yes| KK[Step 6: Final Activation]
    JJ -->|No| LL[Show failed test details]
    
    LL --> MM[Offer retry or edit options]
    MM --> NN{User choice}
    NN --> OO[Retry failed tests]
    NN --> PP[Edit rule configuration]
    
    OO --> II
    PP --> DD
    
    KK --> QQ[Railway Backend: Register all Pipedrive webhooks]
    QQ --> RR[Railway Backend: Enable all notification rules]
    RR --> SS[Complete onboarding wizard]
    SS --> TT[Redirect to Vercel dashboard]
```

## 6. Main Dashboard Navigation Flow (Vercel Frontend + Railway API)

```mermaid
flowchart TD
    A[User accesses Vercel dashboard] --> B[Load dashboard with authentication check]
    B --> C{Valid session?}
    C -->|No| D[Redirect to OAuth login]
    C -->|Yes| E[Railway Backend: Load tenant configuration]
    
    E --> F[Vercel Frontend: Display main navigation]
    F --> G{Navigation selection}
    
    G --> H[Rules Management]
    G --> I[Delivery Logs]
    G --> J[Settings & Billing]
    G --> K[Analytics Dashboard]
    
    H --> L[Rules List View]
    L --> M{Rule actions}
    M --> N[Toggle rule on/off]
    M --> O[Edit rule configuration]
    M --> P[Delete rule]
    M --> Q[Create new rule]
    
    N --> R[Railway Backend: Update rule status in database]
    O --> S[Vercel Frontend: Open rule editor modal]
    P --> T[Vercel Frontend: Confirm deletion dialog]
    Q --> U[Vercel Frontend: Launch rule creation wizard]
    
    I --> V[Logs List View with filters]
    V --> W[Railway Backend: Pagination & search]
    W --> X[Log detail expansion]
    X --> Y[Error details & retry options]
    
    J --> Z[Settings tabs]
    Z --> AA[Subscription management]
    Z --> BB[Data retention settings]
    Z --> CC[Integration settings]
    Z --> DD[Support & documentation]
    
    K --> EE[Railway Backend: Analytics & performance metrics]
    EE --> FF[Notification success rates]
    EE --> GG[Usage trends & insights]
```

## 7. Rule Management Flow (Vercel UI + Railway Processing)

```mermaid
flowchart TD
    A[User opens Rules section in Vercel] --> B[Railway Backend: Load existing rules]
    B --> C[Vercel Frontend: Display rules list with status indicators]
    C --> D{User action}
    
    D --> E[Create New Rule]
    D --> F[Edit Existing Rule]
    D --> G[Toggle Rule Status]
    D --> H[Delete Rule]
    D --> I[Test Rule]
    
    E --> J[Vercel Frontend: Rule Creation Wizard]
    J --> K[Select event type]
    K --> L[Configure filters]
    L --> M[Select template mode]
    M --> N[Choose target Chat space]
    N --> O[Railway Backend: Preview configuration]
    O --> P[Railway Backend: Test new rule]
    P --> Q{Test successful?}
    Q -->|Yes| R[Railway Backend: Save new rule]
    Q -->|No| S[Show error & retry]
    S --> L
    
    F --> T[Railway Backend: Load rule for editing]
    T --> U[Vercel Frontend: Pre-populate current settings]
    U --> V[Allow modifications]
    V --> W[Railway Backend: Preview changes]
    W --> X[Railway Backend: Test modified rule]
    X --> Y{Test successful?}
    Y -->|Yes| Z[Railway Backend: Update rule]
    Y -->|No| AA[Show error & retry]
    AA --> V
    
    G --> BB[Railway Backend: Toggle rule enabled/disabled state]
    BB --> CC[Railway Backend: Update database]
    CC --> DD[Vercel Frontend: Update UI indicator]
    
    H --> EE[Vercel Frontend: Confirm deletion dialog]
    EE --> FF{Confirm deletion?}
    FF -->|Yes| GG[Railway Backend: Soft delete rule]
    FF -->|No| HH[Cancel deletion]
    
    I --> II[Railway Backend: Send test notification]
    II --> JJ[Vercel Frontend: Show test result]
    JJ --> KK[Display success/error message]
```

## 8. Error Handling & Recovery Flows (Cross-Platform)

```mermaid
flowchart TD
    A[Error occurs in app] --> B{Error location}
    
    B --> C[Vercel Frontend Error]
    B --> D[Railway Backend Error]
    B --> E[Network Communication Error]
    
    C --> F{Frontend error type}
    F --> G[UI Component Error]
    F --> H[Authentication Error]
    F --> I[API Communication Error]
    
    G --> J[Error Boundary catches error]
    J --> K[Display user-friendly message]
    K --> L[Log error to Sentry]
    
    H --> M[Token expired/invalid]
    M --> N[Attempt automatic token refresh via Railway]
    N --> O{Refresh successful?}
    O -->|Yes| P[Retry original operation]
    O -->|No| Q[Redirect to OAuth login]
    
    I --> R[Network timeout/failure]
    R --> S[Display offline indicator]
    S --> T[Queue failed requests]
    T --> U[Retry when connection restored]
    
    D --> V{Backend error type}
    V --> W[Database Connection Error]
    V --> X[External API Error]
    V --> Y[Authentication Error]
    V --> Z[System Error]
    
    W --> AA[Log to Sentry]
    AA --> BB[Return 503 Service Unavailable]
    BB --> CC[Vercel Frontend: Show maintenance message]
    
    X --> DD[Log external service outage]
    DD --> EE[Implement circuit breaker]
    EE --> FF[Return cached data if available]
    
    Y --> GG[Return 401 Unauthorized]
    GG --> HH[Vercel Frontend: Redirect to OAuth]
    
    Z --> II[Log system error to Sentry]
    II --> JJ[Return 500 Internal Server Error]
    JJ --> KK[Vercel Frontend: Display generic error]
    
    E --> LL[CORS Error]
    E --> MM[DNS Resolution Error]
    E --> NN[SSL/TLS Error]
    
    LL --> OO[Check Railway CORS configuration]
    MM --> PP[Check domain configuration]
    NN --> QQ[Check certificate validity]
```

## 9. Subscription & Billing Flow (Vercel UI + Marketplace Integration)

```mermaid
flowchart TD
    A[User accesses subscription settings in Vercel] --> B[Railway Backend: Load current subscription status]
    B --> C[Vercel Frontend: Display plan details & usage]
    C --> D{Current plan}
    
    D --> E[Trial (7 days remaining)]
    D --> F[Professional Plan]
    D --> G[Enterprise Plan]
    
    E --> H[Show trial status with countdown]
    H --> I[Display upgrade options]
    I --> J[Professional upgrade button]
    I --> K[Enterprise upgrade button]
    
    J --> L[Redirect to Pipedrive Marketplace billing]
    K --> L
    
    L --> M[Pipedrive Marketplace billing flow]
    M --> N[User completes payment]
    N --> O[Railway Backend: Billing webhook received]
    O --> P[Railway Backend: Update subscription in database]
    P --> Q[Railway Backend: Unlock plan features]
    Q --> R[Vercel Frontend: Confirm upgrade success]
    
    F --> S[Show Professional plan benefits]
    S --> T[Option to upgrade to Enterprise]
    T --> U[Enterprise upgrade flow]
    
    G --> V[Show Enterprise features]
    V --> W[Usage analytics & insights]
    W --> X[Advanced configuration options]
    
    % Billing failure paths
    N --> Y{Payment failed?}
    Y -->|Yes| Z[Show payment error]
    Z --> AA[Retry payment option]
    AA --> M
    Y -->|No| O
```

## 10. Enterprise Features Flow (Vercel UI + Railway Processing)

```mermaid
flowchart TD
    A[Enterprise customer accesses features] --> B{Feature access}
    
    B --> C[Multi-Space Management]
    B --> D[Team Management]
    B --> E[Advanced Analytics]
    B --> F[AI ChatBot Features]
    
    C --> G[Vercel Frontend: Bulk webhook configuration]
    G --> H[Railway Backend: Space-specific rules]
    H --> I[Vercel Frontend: Centralized space monitoring]
    
    D --> J[Vercel Frontend: Invite team members]
    J --> K[Railway Backend: Assign roles & permissions]
    K --> L[Railway Backend: Space-level access control]
    L --> M[Railway Backend: Activity audit logging]
    
    E --> N[Vercel Frontend: Advanced metrics dashboard]
    N --> O[Railway Backend: SLA monitoring & alerts]
    O --> P[Vercel Frontend: Custom reporting]
    P --> Q[Railway Backend: Data export capabilities]
    
    F --> R[Vercel Frontend: AI summary configuration]
    R --> S[Railway Backend: Conversational commands]
    S --> T[Railway Backend: Intelligent notifications]
    T --> U[Vercel Frontend: ChatBot testing interface]
```

## 11. Security & Compliance Flows (Railway-Enforced Security)

```mermaid
flowchart TD
    A[Security-sensitive operation initiated] --> B[Railway Backend: Validate user authentication]
    B --> C{Valid OAuth session?}
    C -->|No| D[Redirect to OAuth login]
    C -->|Yes| E[Railway Backend: Check authorization for operation]
    
    E --> F{User authorized?}
    F -->|No| G[Return 403 Forbidden to Vercel]
    F -->|Yes| H[Railway Backend: Validate input data]
    
    H --> I[Railway Backend: Sanitize and validate all inputs]
    I --> J[Railway Backend: Apply rate limiting]
    J --> K{Rate limit exceeded?}
    K -->|Yes| L[Return 429 Too Many Requests]
    K -->|No| M[Railway Backend: Execute operation]
    
    M --> N[Railway Backend: Log security event]
    N --> O[Railway Backend: Audit trail recording]
    O --> P[Operation complete]
    
    G --> Q[Vercel Frontend: Display insufficient permissions]
    L --> R[Vercel Frontend: Show rate limit error with reset time]
    
    % Data handling compliance
    A --> S{Sensitive data involved?}
    S -->|Yes| T[Railway Backend: Apply encryption]
    T --> U[Railway Backend: PII masking in logs]
    U --> V[Railway Backend: GDPR compliance check]
    V --> W[Railway Backend: Data retention policies]
```

## 12. Monitoring & Health Check Flows (Cross-Platform Monitoring)

```mermaid
flowchart TD
    A[System monitoring initiated] --> B[Health check endpoints]
    B --> C{Service health}
    
    C --> D[Railway Backend: Database connectivity]
    C --> E[Railway Backend: Redis queue health]
    C --> F[Railway Backend: External API availability]
    C --> G[Railway Backend: Authentication service status]
    C --> H[Vercel Frontend: CDN performance]
    C --> I[Vercel Frontend: Build status]
    
    D --> J{DB responsive?}
    J -->|No| K[Railway: Alert operations team]
    J -->|Yes| L[Record healthy status]
    
    E --> M{Queue processing?}
    M -->|No| N[Railway: Restart queue workers]
    M -->|Yes| O[Monitor queue depth]
    
    F --> P{APIs accessible?}
    P -->|No| Q[Log external service outage]
    P -->|Yes| R[Continue normal operation]
    
    G --> S{OAuth service available?}
    S -->|No| T[Enable maintenance mode]
    S -->|Yes| U[Normal authentication flow]
    
    H --> V{CDN performance optimal?}
    V -->|No| W[Vercel: Alert on CDN issues]
    V -->|Yes| X[Normal frontend delivery]
    
    I --> Y{Build deployment successful?}
    Y -->|No| Z[Vercel: Rollback to previous version]
    Y -->|Yes| AA[Latest version active]
    
    % Cross-platform performance monitoring
    A --> BB[Performance metrics collection]
    BB --> CC[Railway: API response time tracking]
    CC --> DD[Vercel: Frontend loading time tracking]
    DD --> EE[End-to-end user experience monitoring]
    EE --> FF[Automated alerting for both platforms]
```

## 13. Data Retention & Compliance Flow (Railway-Managed Data)

```mermaid
flowchart TD
    A[Railway Backend: Data retention job scheduled] --> B[Identify records for cleanup]
    B --> C{Record age > 90 days?}
    C -->|Yes| D[Check for deletion requests]
    C -->|No| E[Skip record]
    
    D --> F{Manual deletion requested?}
    F -->|Yes| G[Prioritize for immediate deletion]
    F -->|No| H[Standard 90-day cleanup]
    
    G --> I[Railway Backend: Verify deletion authorization]
    I --> J{Authorized?}
    J -->|Yes| K[Railway Backend: Secure data deletion]
    J -->|No| L[Railway Backend: Log unauthorized deletion attempt]
    
    H --> M[Railway Backend: Automated retention cleanup]
    M --> N[Railway Backend: Secure data deletion]
    
    K --> O[Railway Backend: Record deletion audit log]
    N --> O
    O --> P[Railway Backend: Verify data completely removed]
    P --> Q[Railway Backend: Update compliance records]
    
    % GDPR compliance
    A --> R[Vercel Frontend: "Right to be forgotten" request]
    R --> S[Railway Backend: Validate user identity]
    S --> T[Railway Backend: Identify all user data]
    T --> U[Railway Backend: Secure complete data deletion]
    U --> V[Railway Backend: Generate compliance certificate]
    V --> W[Vercel Frontend: Display confirmation to user]
```

## 14. Deployment & Infrastructure Flow (Railway + Vercel)

```mermaid
flowchart TD
    A[Developer commits to main branch] --> B[GitHub Actions triggered]
    B --> C{Deploy target}
    
    C --> D[Backend changes detected]
    C --> E[Frontend changes detected]
    C --> F[Both changed]
    
    D --> G[Railway Deployment Pipeline]
    G --> H[Railway: Build Docker image]
    H --> I[Railway: Run backend tests]
    I --> J{Tests pass?}
    J -->|No| K[Railway: Deployment failed]
    J -->|Yes| L[Railway: Deploy to production]
    L --> M[Railway: Health checks]
    M --> N[Railway: Update environment]
    
    E --> O[Vercel Deployment Pipeline]
    O --> P[Vercel: Build React application]
    P --> Q[Vercel: Run frontend tests]
    Q --> R{Tests pass?}
    R -->|No| S[Vercel: Build failed]
    R -->|Yes| T[Vercel: Deploy to global CDN]
    T --> U[Vercel: Update DNS records]
    U --> V[Vercel: Edge cache invalidation]
    
    F --> W[Parallel deployment]
    W --> G
    W --> O
    
    % Environment synchronization
    N --> X[Update CORS configuration for new Vercel domain]
    V --> Y[Update API endpoints for new Railway URL]
    
    % Success paths
    N --> Z[Backend deployment complete]
    V --> AA[Frontend deployment complete]
    Z --> BB[Integration health check]
    AA --> BB
    BB --> CC[Full system operational]
    
    % Failure handling
    K --> DD[Rollback Railway deployment]
    S --> EE[Rollback Vercel deployment]
    DD --> FF[Alert development team]
    EE --> FF
```

## 15. Conclusion: Railway + Vercel Flow Excellence

This **marketplace-compliant app flowchart** ensures **Pipedrive Marketplace approval** and **enterprise customer success** through our optimized **Railway backend + Vercel frontend architecture**:

### Railway Backend Excellence
- **Secure OAuth processing** with encrypted token storage
- **High-performance API endpoints** with proper rate limiting and security
- **Reliable webhook processing** with BullMQ job queuing
- **Enterprise-grade database operations** with proper tenant isolation
- **Comprehensive logging and monitoring** for operational excellence

### Vercel Frontend Excellence  
- **Global CDN performance** ensuring fast loading worldwide
- **Responsive UI components** optimized for all devices
- **Real-time user feedback** with proper error handling
- **Custom Modal integration** providing native Pipedrive experience
- **Automatic deployment** with rollback capabilities

### Architecture Benefits
- **Cost Optimization**: Railway backend (~$5-10/month) + Vercel frontend (Free tier)
- **Performance Optimization**: Railway APIs + Vercel global CDN
- **Scalability**: Independent scaling for frontend and backend components  
- **Security**: Railway handles sensitive operations, Vercel serves static assets
- **Reliability**: Separate failure domains with appropriate redundancy

### Marketplace Compliance Features
- **OAuth 2.0 security flows** meeting enterprise authentication standards
- **Custom UI Extensions integration** providing native Pipedrive experience  
- **Comprehensive error handling** ensuring reliable operation at scale
- **Security-first design** with proper validation and audit trails
- **Cross-platform monitoring** ensuring reliable service delivery

**Enterprise-grade distributed architecture** - These comprehensive flowcharts provide the blueprint for building user experiences that enterprise customers expect while leveraging the optimal Railway + Vercel hosting strategy for guaranteed marketplace approval and long-term scalability success.