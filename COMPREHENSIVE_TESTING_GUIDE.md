# Pipenotify2 Comprehensive Testing Guide

## 🎯 Overview
This guide provides systematic testing procedures for all Pipenotify2 functionality. Each test has a reference number (TEST-XXX) for easy issue reporting and troubleshooting.

**Testing Environment**: https://pipenotify-frontend.vercel.app/

## 📋 Test Categories

### Phase 1: Initial Access & Authentication (TEST-001 to TEST-010)
### Phase 2: Onboarding Flow (TEST-011 to TEST-030)  
### Phase 3: Dashboard Operations (TEST-031 to TEST-060)
### Phase 4: Advanced Features (TEST-061 to TEST-080)
### Phase 5: Error Handling & Edge Cases (TEST-081 to TEST-100)

---

## 🔐 Phase 1: Initial Access & Authentication

### TEST-001: Frontend Accessibility
**Objective**: Verify frontend loads correctly
**Steps**:
1. Navigate to https://pipenotify-frontend.vercel.app/
2. Verify page loads within 3 seconds
3. Check for console errors in DevTools

**Expected Result**: Clean page load with no console errors
**Error Reporting**: If fails, report "TEST-001: Frontend load issue - [describe symptoms]"

---

### TEST-002: Backend Health Check
**Objective**: Verify backend is responding
**Steps**:
1. Open browser DevTools → Network tab
2. Navigate to the frontend
3. Look for successful API calls to Railway backend
4. Check for 200 status codes

**Expected Result**: Backend API calls return 200 status
**Error Reporting**: If fails, report "TEST-002: Backend connectivity - [status code/error]"

---

### TEST-003: OAuth Authentication Flow
**Objective**: Test Pipedrive OAuth integration
**Steps**:
1. Click "Connect Pipedrive Account" button
2. Verify redirect to Pipedrive OAuth page
3. Complete OAuth authorization
4. Verify redirect back to application
5. Check for successful authentication

**Expected Result**: Successful OAuth flow with user authenticated
**Error Reporting**: If fails, report "TEST-003: OAuth failure at step [X] - [error details]"

---

### TEST-004: Token Storage Validation
**Objective**: Verify tokens are stored correctly
**Steps**:
1. After successful OAuth (TEST-003)
2. Open DevTools → Application → Local Storage
3. Verify 'auth_token' exists and has valid JWT format
4. Refresh page and verify user remains authenticated

**Expected Result**: Token persisted across page refreshes
**Error Reporting**: If fails, report "TEST-004: Token persistence issue - [details]"

---

### TEST-005: Protected Route Access
**Objective**: Test authentication-required pages
**Steps**:
1. Clear localStorage and sessionStorage
2. Navigate directly to /dashboard
3. Verify redirect to onboarding/login
4. Complete authentication
5. Verify access to dashboard

**Expected Result**: Proper authentication flow enforcement
**Error Reporting**: If fails, report "TEST-005: Route protection bypass - [route accessed]"

---

## 🚀 Phase 2: Onboarding Flow

### TEST-011: Onboarding Wizard Launch
**Objective**: Test onboarding wizard initialization
**Steps**:
1. Start onboarding flow
2. Verify Step 1 (Welcome) displays correctly
3. Check progress indicator shows "Step 1 of 6"
4. Verify no vertical scrolling needed

**Expected Result**: Clean welcome screen within viewport
**Error Reporting**: If fails, report "TEST-011: Onboarding display issue - [step/element]"

---

### TEST-012: Welcome Step Navigation
**Objective**: Test first step functionality
**Steps**:
1. Review welcome content
2. Verify all feature cards display
3. Test "Next" button
4. Test "Skip Setup" button

**Expected Result**: Smooth navigation to next step
**Error Reporting**: If fails, report "TEST-012: Welcome navigation - [button/action]"

---

### TEST-013: Pipedrive Connection Step
**Objective**: Test OAuth connection UI
**Steps**:
1. Navigate to Pipedrive connection step
2. If not connected, verify "Connect Pipedrive Account" button
3. If connected, verify success status display
4. Test connection status accuracy

**Expected Result**: Accurate connection status and functional buttons
**Error Reporting**: If fails, report "TEST-013: Connection status - [actual vs expected]"

---

### TEST-014: Webhook Configuration Step
**Objective**: Test Google Chat webhook setup
**Steps**:
1. Navigate to webhook configuration step
2. Read instructions for obtaining webhook URL
3. Test webhook form validation
4. Enter valid webhook URL: `https://chat.googleapis.com/v1/spaces/XXXXXXX/messages?key=XXXXXXX`
5. Test webhook creation

**Expected Result**: Webhook created successfully with validation
**Error Reporting**: If fails, report "TEST-014: Webhook creation - [validation/submission issue]"

---

### TEST-015: Rule Creation Step
**Objective**: Test notification rule setup
**Steps**:
1. Navigate to rule creation step
2. Verify default rule name populated
3. Test event type dropdown (Deal Won, Deal Added, etc.)
4. Test webhook selection dropdown
5. Test template mode selection (Simple/Detailed)
6. Verify rule preview updates correctly

**Expected Result**: Dynamic rule preview with all options functional
**Error Reporting**: If fails, report "TEST-015: Rule creation - [specific field/preview issue]"

---

### TEST-016: Test Notification Step
**Objective**: Test notification delivery
**Steps**:
1. Navigate to test notification step
2. Click "Send Test Notification" button
3. Check Google Chat for test message
4. Verify success/error status display
5. Test retry if needed

**Expected Result**: Test notification received in Google Chat
**Error Reporting**: If fails, report "TEST-016: Test notification - [delivery status/error]"

---

### TEST-017: Success & Completion Step
**Objective**: Test onboarding completion
**Steps**:
1. Navigate to success step
2. Review completion message and next steps
3. Click "Go to Dashboard" button
4. Verify redirect to dashboard
5. Check that onboarding doesn't restart

**Expected Result**: Successful transition to main dashboard
**Error Reporting**: If fails, report "TEST-017: Onboarding completion - [redirect/persistence issue]"

---

### TEST-018: Onboarding Skip Functionality
**Objective**: Test skip onboarding option
**Steps**:
1. Start fresh onboarding flow
2. Click "Skip Setup" button
3. Verify confirmation dialog (if any)
4. Verify redirect to dashboard
5. Check limited functionality warnings

**Expected Result**: Graceful skip with appropriate limitations
**Error Reporting**: If fails, report "TEST-018: Skip functionality - [behavior/redirect issue]"

---

### TEST-019: Mobile Onboarding Experience
**Objective**: Test onboarding on mobile devices
**Steps**:
1. Open DevTools → Toggle device toolbar
2. Select mobile device (iPhone/Android)
3. Complete onboarding flow
4. Verify responsive design
5. Test touch interactions

**Expected Result**: Fully functional mobile onboarding
**Error Reporting**: If fails, report "TEST-019: Mobile onboarding - [device/interaction issue]"

---

### TEST-020: Onboarding Error Recovery
**Objective**: Test error handling during onboarding
**Steps**:
1. Start onboarding with network disabled
2. Try to proceed through steps
3. Re-enable network
4. Test recovery and continuation
5. Verify no data loss

**Expected Result**: Graceful error handling and recovery
**Error Reporting**: If fails, report "TEST-020: Error recovery - [step/data loss]"

---

## 📊 Phase 3: Dashboard Operations

### TEST-031: Dashboard Initial Load
**Objective**: Test dashboard loading and data display
**Steps**:
1. Navigate to dashboard after authentication
2. Verify stats cards load correctly
3. Check rules list population
4. Verify logs display
5. Test loading states

**Expected Result**: Dashboard loads with all data sections populated
**Error Reporting**: If fails, report "TEST-031: Dashboard load - [specific section/data]"

---

### TEST-032: Stats Overview Cards
**Objective**: Test dashboard statistics display
**Steps**:
1. Review "Total Notifications" card
2. Check "Success Rate" percentage
3. Verify "Active Rules" count
4. Test "Avg Delivery Time" display
5. Test card expansion (if available)

**Expected Result**: Accurate statistics with proper formatting
**Error Reporting**: If fails, report "TEST-032: Stats display - [card/metric issue]"

---

### TEST-033: Rules Management
**Objective**: Test notification rules CRUD operations
**Steps**:
1. View existing rules list
2. Test rule toggle (Enable/Disable)
3. Test rule editing functionality
4. Test rule deletion with confirmation
5. Verify rule status updates

**Expected Result**: Full CRUD functionality for rules
**Error Reporting**: If fails, report "TEST-033: Rules CRUD - [operation/UI issue]"

---

### TEST-034: Create New Rule
**Objective**: Test new rule creation from dashboard
**Steps**:
1. Click "Create New Rule" button
2. Fill in rule details:
   - Name: "Test Dashboard Rule"
   - Event: "Deal Added"
   - Webhook: Select existing webhook
   - Template: "Detailed"
3. Test form validation
4. Submit rule
5. Verify rule appears in list

**Expected Result**: New rule created and visible in dashboard
**Error Reporting**: If fails, report "TEST-034: New rule creation - [field/submission issue]"

---

### TEST-035: Rule Testing Functionality
**Objective**: Test individual rule testing
**Steps**:
1. Find a rule in the rules list
2. Click "Test" button for that rule
3. Verify test notification sent
4. Check Google Chat for test message
5. Verify test result display in dashboard

**Expected Result**: Test notification delivered and confirmed
**Error Reporting**: If fails, report "TEST-035: Rule testing - [rule ID/delivery status]"

---

### TEST-036: Logs and Monitoring
**Objective**: Test notification logs display
**Steps**:
1. Navigate to logs section
2. Verify log entries display correctly
3. Test log filtering (status, rule, date)
4. Test log pagination
5. Verify log details accuracy

**Expected Result**: Comprehensive logs with working filters
**Error Reporting**: If fails, report "TEST-036: Logs display - [filter/pagination issue]"

---

### TEST-037: Webhook Management
**Objective**: Test webhook CRUD operations
**Steps**:
1. Navigate to webhooks section
2. View existing webhooks
3. Test webhook editing
4. Test webhook deletion
5. Test adding new webhook

**Expected Result**: Full webhook management functionality
**Error Reporting**: If fails, report "TEST-037: Webhook management - [operation/error]"

---

### TEST-038: Analytics and Reports
**Objective**: Test analytics dashboard
**Steps**:
1. Navigate to analytics section
2. Verify chart/graph displays
3. Test date range selection
4. Test data filtering options
5. Verify metric calculations

**Expected Result**: Accurate analytics with interactive controls
**Error Reporting**: If fails, report "TEST-038: Analytics - [chart/metric issue]"

---

### TEST-039: Settings and Configuration
**Objective**: Test application settings
**Steps**:
1. Navigate to settings section
2. Test account information display
3. Test subscription status
4. Test notification preferences
5. Test data export options

**Expected Result**: Complete settings management
**Error Reporting**: If fails, report "TEST-039: Settings - [section/option issue]"

---

### TEST-040: Dashboard Real-time Updates
**Objective**: Test live data updates
**Steps**:
1. Keep dashboard open
2. Trigger notification from Pipedrive (if possible)
3. Verify real-time log updates
4. Test stat counter updates
5. Check notification status changes

**Expected Result**: Real-time dashboard updates
**Error Reporting**: If fails, report "TEST-040: Real-time updates - [delay/missing update]"

---

## 🔧 Phase 4: Advanced Features

### TEST-061: Bulk Rule Operations
**Objective**: Test bulk rule management
**Steps**:
1. Select multiple rules using checkboxes
2. Test bulk enable/disable
3. Test bulk deletion
4. Test bulk export
5. Verify operation confirmations

**Expected Result**: Efficient bulk operations
**Error Reporting**: If fails, report "TEST-061: Bulk operations - [operation/selection issue]"

---

### TEST-062: Template Customization
**Objective**: Test message template editing
**Steps**:
1. Navigate to template editor
2. Edit default templates
3. Test variable insertion
4. Test template preview
5. Save custom template

**Expected Result**: Functional template customization
**Error Reporting**: If fails, report "TEST-062: Template editor - [edit/preview issue]"

---

### TEST-063: Channel Routing
**Objective**: Test advanced routing features
**Steps**:
1. Access channel routing settings
2. Configure routing rules
3. Test priority routing
4. Test conditional routing
5. Verify routing logic

**Expected Result**: Sophisticated routing capabilities
**Error Reporting**: If fails, report "TEST-063: Channel routing - [rule/logic issue]"

---

### TEST-064: Quiet Hours Configuration
**Objective**: Test notification scheduling
**Steps**:
1. Navigate to quiet hours settings
2. Configure quiet periods
3. Set timezone preferences
4. Test schedule enforcement
5. Verify override options

**Expected Result**: Accurate quiet hours implementation
**Error Reporting**: If fails, report "TEST-064: Quiet hours - [schedule/timezone issue]"

---

### TEST-065: Stalled Deal Monitoring
**Objective**: Test stalled deal detection
**Steps**:
1. Access stalled deal monitor
2. Configure stall criteria
3. Review detected deals
4. Test alert functionality
5. Verify monitoring accuracy

**Expected Result**: Effective stalled deal monitoring
**Error Reporting**: If fails, report "TEST-065: Stalled deals - [detection/alert issue]"

---

## ⚠️ Phase 5: Error Handling & Edge Cases

### TEST-081: Network Connectivity Issues
**Objective**: Test offline/poor connectivity handling
**Steps**:
1. Disable network connection
2. Try various dashboard operations
3. Re-enable network
4. Verify automatic recovery
5. Test retry mechanisms

**Expected Result**: Graceful offline handling with recovery
**Error Reporting**: If fails, report "TEST-081: Network handling - [operation/recovery issue]"

---

### TEST-082: Invalid Data Handling
**Objective**: Test malformed data processing
**Steps**:
1. Submit forms with invalid data
2. Test API with malformed requests
3. Verify validation messages
4. Test data sanitization
5. Check error boundaries

**Expected Result**: Robust validation and error messages
**Error Reporting**: If fails, report "TEST-082: Data validation - [field/message issue]"

---

### TEST-083: Authentication Token Expiry
**Objective**: Test token refresh and expiry handling
**Steps**:
1. Wait for token to expire (or simulate)
2. Try dashboard operations
3. Verify automatic refresh attempt
4. Test re-authentication flow
5. Check session persistence

**Expected Result**: Seamless token refresh or re-auth
**Error Reporting**: If fails, report "TEST-083: Token expiry - [refresh/auth issue]"

---

### TEST-084: Rate Limiting and Throttling
**Objective**: Test API rate limit handling
**Steps**:
1. Rapidly submit multiple requests
2. Trigger rate limiting
3. Verify rate limit messages
4. Test automatic retry with backoff
5. Check service degradation

**Expected Result**: Proper rate limit handling
**Error Reporting**: If fails, report "TEST-084: Rate limiting - [message/retry issue]"

---

### TEST-085: Browser Compatibility
**Objective**: Test cross-browser functionality
**Steps**:
1. Test in Chrome (latest)
2. Test in Firefox (latest)
3. Test in Safari (if available)
4. Test in Edge (latest)
5. Compare functionality across browsers

**Expected Result**: Consistent functionality across browsers
**Error Reporting**: If fails, report "TEST-085: Browser compatibility - [browser/feature]"

---

## 🎯 Performance Testing

### TEST-091: Page Load Performance
**Objective**: Measure application performance
**Steps**:
1. Use Chrome DevTools → Lighthouse
2. Run performance audit
3. Check Core Web Vitals
4. Measure bundle size
5. Test lazy loading

**Expected Result**: Performance score > 90
**Error Reporting**: If fails, report "TEST-091: Performance - [metric below threshold]"

---

### TEST-092: Large Dataset Handling
**Objective**: Test with high data volumes
**Steps**:
1. Create 50+ rules
2. Generate 1000+ log entries
3. Test dashboard responsiveness
4. Test pagination performance
5. Check memory usage

**Expected Result**: Smooth performance with large datasets
**Error Reporting**: If fails, report "TEST-092: Large data - [performance degradation]"

---

## 🔒 Security Testing

### TEST-096: XSS Prevention
**Objective**: Test Cross-Site Scripting protection
**Steps**:
1. Try injecting `<script>` tags in form fields
2. Test with malicious webhook URLs
3. Verify input sanitization
4. Check CSP headers
5. Test output encoding

**Expected Result**: No script execution, proper sanitization
**Error Reporting**: If fails, report "TEST-096: XSS vulnerability - [location/payload]"

---

### TEST-097: CSRF Protection
**Objective**: Test Cross-Site Request Forgery protection
**Steps**:
1. Check for CSRF tokens
2. Test form submissions from external sites
3. Verify SameSite cookie attributes
4. Test API endpoint protection
5. Check referrer validation

**Expected Result**: CSRF attacks blocked
**Error Reporting**: If fails, report "TEST-097: CSRF vulnerability - [endpoint/method]"

---

## 📱 Accessibility Testing

### TEST-098: Keyboard Navigation
**Objective**: Test keyboard-only navigation
**Steps**:
1. Navigate using only Tab/Shift+Tab
2. Test Enter/Space key interactions
3. Verify focus indicators
4. Test skip links
5. Check modal/dropdown accessibility

**Expected Result**: Full keyboard accessibility
**Error Reporting**: If fails, report "TEST-098: Keyboard nav - [element/interaction]"

---

### TEST-099: Screen Reader Compatibility
**Objective**: Test with assistive technologies
**Steps**:
1. Use screen reader (NVDA/JAWS)
2. Navigate through application
3. Test form field announcements
4. Verify semantic markup
5. Check ARIA labels

**Expected Result**: Proper screen reader support
**Error Reporting**: If fails, report "TEST-099: Screen reader - [element/announcement]"

---

### TEST-100: Color Contrast and Visual Accessibility
**Objective**: Test visual accessibility standards
**Steps**:
1. Use color contrast analyzer
2. Test with high contrast mode
3. Verify color-blind accessibility
4. Test text scaling (200%)
5. Check focus indicators

**Expected Result**: WCAG 2.1 AA compliance
**Error Reporting**: If fails, report "TEST-100: Visual accessibility - [element/standard]"

---

## 🎉 Testing Summary

### Quick Reference for Issue Reporting

**Format**: TEST-XXX: [Category] - [Specific Issue] - [Browser/Device]

**Examples**:
- TEST-001: Frontend load issue - 404 error on main page - Chrome 118
- TEST-035: Rule testing - No test notification received - Firefox 119
- TEST-082: Data validation - Empty webhook URL accepted - Safari 17

### Priority Levels
- **P0 (Critical)**: Authentication failures, data loss, security vulnerabilities
- **P1 (High)**: Core functionality broken, major UX issues
- **P2 (Medium)**: Minor functionality issues, cosmetic problems
- **P3 (Low)**: Enhancement opportunities, edge case issues

### Test Environment Requirements
- **Network**: Stable internet connection
- **Accounts**: Valid Pipedrive account with API access
- **Google Chat**: Access to Google Chat with webhook creation permissions
- **Browser**: Latest versions of Chrome, Firefox, Safari, Edge
- **Tools**: Developer tools enabled for debugging

### Support Information
- **Logs**: Check browser console for JavaScript errors
- **Network**: Monitor DevTools Network tab for API failures
- **Storage**: Verify localStorage/sessionStorage for token issues
- **Performance**: Use Lighthouse for performance diagnostics

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Total Tests**: 100 comprehensive test scenarios