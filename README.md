# 🔔 PipeNotify

**Real-time Pipedrive notifications for Google Chat**

[![Pipedrive Marketplace](https://img.shields.io/badge/Pipedrive-Marketplace-green.svg)](https://marketplace.pipedrive.com/app/pipenotify)
[![OAuth 2.0](https://img.shields.io/badge/Auth-OAuth%202.0-blue.svg)](https://oauth.net/2/)
[![GDPR Compliant](https://img.shields.io/badge/Privacy-GDPR%20Compliant-success.svg)](https://gdpr.eu/)

Bridge your Pipedrive CRM with Google Chat for instant sales notifications that keep your team synchronized and responsive to every opportunity.

---

## 🎯 **Why PipeNotify?**

**Sales teams lose deals due to delayed communication.** PipeNotify eliminates this gap by delivering instant, contextual notifications to your Google Chat workspace the moment important events happen in your pipeline.

- 🔔 **Real-time notifications** - Never miss a deal update again
- 🎯 **Smart filtering** - Get only the notifications that matter
- 📱 **Multi-channel routing** - Different priorities to appropriate teams
- 📊 **Complete visibility** - Track deals, contacts, and activities
- ⚡ **5-minute setup** - Start receiving notifications immediately

---

## ✨ **Features**

### 🆓 **Free Plan**
- Basic deal notifications (won, lost, created)
- 1 Google Chat webhook
- 3 notification rules
- 100 notifications/month

### 🚀 **Starter Plan ($9/month)**
- Value-based filtering ($1K+ deals get priority)
- Enhanced message formatting
- Stage-based notifications
- Usage analytics dashboard
- Email support

### 🎯 **Professional Plan ($29/month)** ⭐ *Most Popular*
- Smart channel routing
- Stalled deal alerts (3, 7, 14+ days)
- Custom message templates
- Rich Google Chat cards
- Quiet hours scheduling
- Priority support

### 🏆 **Team Plan ($79/month)**
- Multi-channel orchestration
- Daily/weekly pipeline summaries
- Team performance metrics
- API access
- Dedicated support
- Advanced filtering

---

## 🚀 **Quick Start**

### 1. Install from Pipedrive Marketplace
- Search for "PipeNotify" in the Pipedrive Marketplace
- Click "Install" and authorize OAuth connection
- Automatic webhook registration

### 2. Connect Google Chat
- Create a webhook URL in your Google Chat space
- Add the webhook URL in PipeNotify setup wizard
- Test the connection

### 3. Configure Rules
- Set up notification rules for deals, contacts, activities
- Apply filters based on value, stage, owner, etc.
- Choose notification templates

### 4. Start Receiving Notifications
- Real-time notifications appear in Google Chat
- Click notifications to jump directly to Pipedrive
- Monitor delivery in analytics dashboard

---

## 🔒 **Security & Privacy**

### OAuth 2.0 Authentication
- Secure connection to Pipedrive using industry-standard OAuth 2.0
- No API keys or passwords stored
- Automatic token refresh

### Data Protection
- **GDPR Compliant** with comprehensive privacy controls
- **Encrypted storage** for all sensitive data
- **Minimal data retention** - only operational necessities
- **No third-party sharing** without explicit consent

### Required Pipedrive Scopes
- `users:read` - Identify your account and company
- `webhooks:write` - Set up automatic notifications
- `webhooks:read` - Manage notification settings
- `deals:read` - Process deal change notifications
- `persons:read` - Include contact details in notifications
- `activities:read` - Notify about scheduled activities

---

## 📊 **Use Cases**

### **Sales Team Deal Celebrations**
Instant team-wide celebrations when deals are won, building morale and maintaining visibility into collective wins.

### **Pipeline Stage Alerts**
Sales managers receive notifications when high-value deals move to critical stages, enabling proactive support.

### **High-Value Deal Monitoring**
Management teams get filtered notifications for deals above specific thresholds (e.g., $50K+).

### **Stalled Deal Recovery**
Automated alerts for inactive deals help sales teams maintain momentum and reduce pipeline leakage.

### **Cross-Department Coordination**
Customer success teams receive notifications when expansion deals reach certain stages.

---

## 📚 **Documentation**

- 📖 [User Guide](docs/USER_GUIDE.md) - Complete usage instructions
- 🔧 [API Reference](docs/API_REFERENCE.md) - Technical API documentation
- 🏗️ [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) - Architecture and development
- 📋 [Marketplace Submission Guide](docs/MARKETPLACE_SUBMISSION_GUIDE.md) - Pipedrive marketplace preparation
- 🧪 [Testing Guide](docs/COMPREHENSIVE_TESTING_GUIDE.md) - Testing procedures and scripts
- 🔍 [Troubleshooting Guide](docs/TROUBLESHOOTING_GUIDE.md) - Common issues and solutions

---

## 🏗️ **Architecture**

### Technology Stack
- **Frontend**: React 18 + TypeScript, deployed on Vercel
- **Backend**: Node.js + Express.js, deployed on Railway
- **Database**: PostgreSQL with automated migrations
- **Queue**: BullMQ + Redis for background processing
- **Monitoring**: Sentry for error tracking
- **Security**: JWT tokens, OAuth 2.0, encrypted storage

### Key Components
- **OAuth Integration**: Secure Pipedrive authentication
- **Webhook Processing**: Real-time event handling
- **Multi-tenant Architecture**: Isolated tenant data
- **Self-healing System**: Automated error recovery
- **Performance Monitoring**: Comprehensive health tracking

---

## 💼 **For Developers**

### Local Development Setup
```bash
# Clone repository
git clone https://github.com/your-org/pipenotify2.git
cd pipenotify2

# Backend setup
cd backend
npm install
cp .env.example .env
# Configure environment variables
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm start
```

### Environment Variables
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/pipenotify_dev
PIPEDRIVE_CLIENT_ID=your_pipedrive_client_id
PIPEDRIVE_CLIENT_SECRET=your_pipedrive_client_secret
PIPEDRIVE_REDIRECT_URI=http://localhost:3000/onboarding
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:3000

# Frontend (.env.local)
REACT_APP_API_URL=http://localhost:8080
```

### API Endpoints
- `POST /api/v1/oauth/callback` - OAuth authorization
- `GET /api/v1/admin/rules` - Notification rules management
- `POST /api/v1/webhooks/validate` - Webhook validation
- `GET /api/v1/monitoring/dashboard` - Analytics data

---

## 📞 **Support**

### Community Support (Free Plan)
- 📚 Documentation and guides
- 💬 GitHub issues and discussions

### Email Support (Starter+ Plans)
- 📧 **Email**: support@primedevlabs.com
- ⏱️ **Response Time**: 24 hours during business days

### Priority Support (Professional+ Plans)
- 📧 **Email**: support@primedevlabs.com
- ⏱️ **Response Time**: 4 hours during business hours
- 📞 **Escalation**: Available for critical issues

### Dedicated Support (Team Plan)
- 📧 **Email**: support@primedevlabs.com
- ⏱️ **Response Time**: 2 hours during business hours
- 📞 **Direct line**: Available during setup
- 🤝 **Account manager**: Dedicated support contact

---

## 📄 **Legal**

- [Privacy Policy](frontend/public/privacy.html)
- [Terms of Service](frontend/public/terms.html)
- [Security Guidelines](docs/security_guideline_document.md)

---

## 🏆 **Built By**

**Prime Dev Labs** - Specialized in CRM integrations and sales productivity tools

- 🌐 **Website**: [primedevlabs.com](https://primedevlabs.com)
- 📧 **Contact**: hello@primedevlabs.com
- 🐦 **Twitter**: [@PrimeDevLabs](https://twitter.com/primedevlabs)

---

## 📈 **Stats**

- ⚡ **Setup Time**: Under 5 minutes
- 📊 **Delivery Success**: 99.9% uptime
- 🏢 **Enterprise Ready**: Multi-tenant architecture
- 🔒 **Security**: OAuth 2.0 + GDPR compliant
- 📱 **Responsive**: Works on all devices

---

*© 2025 Prime Dev Labs. All rights reserved.*

---

## 🚀 **Ready to Get Started?**

[**Install PipeNotify from Pipedrive Marketplace →**](https://marketplace.pipedrive.com/app/pipenotify)

Transform your sales team's communication with real-time Pipedrive notifications in Google Chat.