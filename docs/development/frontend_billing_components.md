# Frontend Billing Components Documentation

This document describes the frontend components for pricing and billing management in the Pipenotify application.

## Overview

The billing frontend consists of three main components:
1. **PricingPage** - Public pricing page with plan comparison
2. **BillingDashboard** - Authenticated billing management interface  
3. **UsageWidget** - Reusable usage display component

## Components

### PricingPage.tsx

**Purpose**: Display pricing plans and handle plan selection

**Key Features**:
- Responsive grid layout for pricing plans
- Current usage display for authenticated users
- Plan comparison with feature highlights
- Stripe checkout integration
- FAQ section and contact information
- Real-time plan status (current, upgrade, downgrade)

**Props**:
```typescript
interface PricingPageProps {
  onPlanSelect?: (planTier: string) => void;
  currentSubscription?: Subscription | null;
  showHeader?: boolean;
}
```

**API Integration**:
- `getPlans()` - Fetch available pricing plans
- `getCurrentSubscription()` - Get current subscription status
- `createCheckoutSession()` - Initiate Stripe checkout
- `cancelSubscription()` - Handle downgrades to free plan

**Visual Elements**:
- Color-coded plan cards (Free: gray, Starter: green, Pro: blue, Team: orange)
- "Most Popular" badge for Pro plan
- Usage bars with color indicators (green: safe, yellow: warning, red: critical)
- Responsive design for mobile and desktop

### BillingDashboard.tsx

**Purpose**: Comprehensive billing management for authenticated users

**Key Features**:
- Current subscription overview with status
- Real-time usage monitoring with progress bars
- Usage history charts (6-month trend)
- Feature access matrix
- Stripe Customer Portal integration
- Subscription cancellation workflow
- Support section with contact options

**Props**:
```typescript
interface BillingDashboardProps {
  onNavigateToPricing?: () => void;
}
```

**API Integration**:
- `getCurrentSubscription()` - Subscription and usage data
- `getUsageHistory()` - Historical usage data
- `getFeatureAccess()` - Feature availability matrix
- `createPortalSession()` - Stripe Customer Portal access
- `cancelSubscription()` - Subscription cancellation

**Dashboard Sections**:
1. **Plan Overview** - Current plan, status, billing cycle
2. **Usage Metrics** - Real-time usage with warnings
3. **Usage History** - 6-month usage trend chart
4. **Feature Access** - Plan-based feature availability
5. **Support** - Help and contact options

### UsageWidget.tsx

**Purpose**: Reusable usage display component

**Key Features**:
- Compact and full display modes
- Real-time usage data
- Upgrade prompts for high usage
- Color-coded progress indicators
- Plan badge display

**Props**:
```typescript
interface UsageWidgetProps {
  compact?: boolean;
  showUpgrade?: boolean;
  onUpgradeClick?: () => void;
}
```

**Display Modes**:
- **Compact**: Single progress bar with key metrics
- **Full**: Detailed breakdown of all resource usage

## Styling Architecture

### CSS Design System

**Color Palette**:
- Primary: `#667eea` (Pipenotify blue)
- Success: `#10b981` (green)
- Warning: `#f59e0b` (amber)
- Danger: `#dc2626` (red)
- Neutral: `#6b7280` (gray)

**Component Patterns**:
- Consistent border radius: 8px (small), 12px (large)
- Shadow levels: `0 2px 4px rgba(0,0,0,0.05)` (subtle), `0 8px 20px rgba(102,126,234,0.4)` (elevated)
- Gradient buttons: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

**Responsive Breakpoints**:
- Mobile: `max-width: 768px`
- Desktop: `min-width: 769px`

### Animation System

**Transitions**:
- Hover effects: `transform: translateY(-2px)` with `0.2s ease`
- Progress bars: `width` transitions with `0.3s ease`
- Loading spinners: `1s linear infinite` rotation

**Loading States**:
- Skeleton loading with shimmer effects
- Spinners for async operations
- Progressive enhancement for slow connections

## API Integration

### Service Layer (`api.ts`)

**Billing Endpoints**:
```typescript
// Plan management
getPlans(): Promise<PlanDetails[]>
getCurrentSubscription(): Promise<{ subscription: Subscription | null; usage: UsageStats }>

// Stripe integration
createCheckoutSession(planTier: string): Promise<{ checkout_url: string; session_id: string }>
createPortalSession(): Promise<{ portal_url: string }>
cancelSubscription(): Promise<{ success: boolean; message: string }>

// Usage tracking
getUsageHistory(months: number): Promise<UsageHistoryItem[]>
getFeatureAccess(): Promise<FeatureAccessMap>
```

**Error Handling**:
- Network error detection
- Authentication error handling
- User-friendly error messages
- Retry mechanisms for failed requests

### State Management

**Local State**:
- Component-level state for UI interactions
- Loading states for async operations
- Error states with user feedback

**Data Flow**:
1. Component mounts → API call
2. Loading state → User feedback
3. Data received → State update → UI render
4. Error handling → User notification

## User Experience

### Loading States

**Progressive Loading**:
- Skeleton screens for initial loads
- Inline spinners for actions
- Progress indicators for multi-step processes

**Error Recovery**:
- Retry buttons for failed operations
- Clear error messages with context
- Graceful degradation for partial failures

### Responsive Design

**Mobile Optimizations**:
- Stacked layout for pricing cards
- Touch-friendly button sizes (minimum 44px)
- Simplified navigation patterns
- Condensed information display

**Desktop Enhancements**:
- Multi-column layouts
- Hover states and tooltips
- Keyboard navigation support
- Enhanced visual hierarchy

## Accessibility

### WCAG Compliance

**Color Contrast**:
- All text meets AA contrast requirements
- Color is not the only indicator for status
- High contrast mode support

**Keyboard Navigation**:
- Tab order follows logical flow
- Focus indicators visible
- All interactive elements accessible

**Screen Reader Support**:
- Semantic HTML structure
- ARIA labels for complex components
- Status announcements for dynamic content

## Performance

### Optimization Strategies

**Code Splitting**:
- Lazy loading for billing components
- Dynamic imports for large dependencies
- Route-based code splitting

**Asset Optimization**:
- Optimized images and icons
- CSS minification and compression
- Font subsetting for web fonts

**Runtime Performance**:
- Debounced API calls
- Memoized expensive calculations
- Efficient re-rendering patterns

## Testing Strategy

### Component Testing

**Unit Tests**:
- Component rendering
- Props handling
- Event handling
- State management

**Integration Tests**:
- API service integration
- User interaction flows
- Error boundary testing

**Visual Testing**:
- Screenshot regression tests
- Cross-browser compatibility
- Responsive design validation

## Deployment

### Build Process

**Development**:
```bash
npm start  # Start development server
npm test   # Run test suite
```

**Production**:
```bash
npm run build  # Create production build
npm run deploy # Deploy to Vercel
```

**Environment Variables**:
```env
REACT_APP_API_URL=https://pipenotify.up.railway.app
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Security Considerations

### Data Protection

**Sensitive Information**:
- API keys stored securely
- No credentials in client code
- Secure token handling

**Payment Security**:
- PCI compliance through Stripe
- No card data stored locally
- Secure redirect flows

## Future Enhancements

### Planned Features

**Advanced Analytics**:
- Usage predictions
- Cost optimization recommendations
- Usage trend analysis

**Enhanced UX**:
- Dark mode support
- Internationalization (i18n)
- Advanced filtering and search

**Integration Improvements**:
- Real-time updates via WebSockets
- Offline mode support
- Progressive Web App features

## Troubleshooting

### Common Issues

**API Connection Problems**:
1. Check network connectivity
2. Verify API endpoint configuration
3. Review authentication headers
4. Check CORS settings

**Stripe Integration Issues**:
1. Verify publishable key configuration
2. Check webhook endpoint setup
3. Review payment method setup
4. Validate redirect URLs

**Performance Issues**:
1. Monitor bundle size
2. Profile component re-renders
3. Check for memory leaks
4. Optimize API call patterns

### Debug Tools

**Development**:
- React Developer Tools
- Network tab for API calls
- Console logging for state changes
- Performance profiler

**Production**:
- Error tracking with Sentry
- Performance monitoring
- User feedback collection
- A/B testing framework