import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import OnboardingWizard from './components/OnboardingWizard';
import Dashboard from './components/Dashboard';
import PricingPage from './components/PricingPage';
import AdaptiveBillingDashboard from './components/AdaptiveBillingDashboard';
import { getAuthToken } from './utils/auth';
import './App.css';

function OnboardingRoute() {
  const navigate = useNavigate();
  
  const handleSkip = () => {
    const token = getAuthToken();
    
    if (!token) {
      alert('⚠️ Please connect to Pipedrive first before skipping setup. Click "Connect to Pipedrive" to authenticate.');
      return;
    }
    
    // If authenticated, allow access to dashboard with limited functionality
    navigate('/dashboard');
  };
  
  return (
    <OnboardingWizard 
      onComplete={() => navigate('/dashboard')} 
      onSkip={handleSkip} 
    />
  );
}

function BillingRoute() {
  return (
    <AdaptiveBillingDashboard />
  );
}

// Static page components for legal pages
function TermsPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ color: '#2563eb', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>Terms of Service</h1>
      
      <div style={{ background: '#f3f4f6', padding: '10px', borderRadius: '5px', marginBottom: '30px' }}>
        <strong>Last Updated:</strong> January 23, 2025<br/>
        <strong>Effective Date:</strong> January 1, 2025<br/>
        <strong>Version:</strong> 2.1
      </div>

      <h2>1. Acceptance of Terms</h2>
      <p>By accessing and using PipeNotify ("the Service," "we," "us," or "our"), operated by Prime Dev Labs, you ("User," "you," or "your") accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by the above, please do not use this service. These terms apply to all visitors, users, and others who access or use the service.</p>

      <h2>2. Description of Service</h2>
      <p>PipeNotify is a premium notification integration service that connects your Pipedrive CRM with Google Chat, enabling:</p>
      <ul>
        <li><strong>Real-time Notifications:</strong> Instant alerts for deal updates, stage changes, and won/lost deals</li>
        <li><strong>Advanced Filtering:</strong> Sophisticated rule-based notification system with value, stage, owner, and probability filtering</li>
        <li><strong>Multi-Channel Support:</strong> Route notifications to different Google Chat channels based on criteria</li>
        <li><strong>Custom Templates:</strong> Personalized notification formats with rich card layouts</li>
        <li><strong>Usage Analytics:</strong> Comprehensive tracking and reporting of notification delivery</li>
        <li><strong>Enterprise Features:</strong> Team collaboration, quiet hours, and priority support</li>
      </ul>

      <h2>3. User Accounts and Registration</h2>
      <p>To use PipeNotify, you must:</p>
      <ul>
        <li>Have a valid Pipedrive account with administrator or appropriate permissions</li>
        <li>Have access to Google Chat channels where notifications will be delivered</li>
        <li>Provide accurate, complete, and up-to-date information during the setup process</li>
        <li>Maintain the security and confidentiality of your integration credentials</li>
        <li>Be responsible for all activities that occur under your account</li>
        <li>Notify us immediately of any unauthorized use of your account</li>
      </ul>

      <h2>4. Subscription Plans and Billing</h2>
      <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '5px', margin: '15px 0' }}>
        <h3>Plan Tiers:</h3>
        <ul>
          <li><strong>Free Plan:</strong> Up to 100 notifications/month, 1 webhook, 3 rules</li>
          <li><strong>Starter Plan ($19/month):</strong> Up to 1,000 notifications/month, 3 webhooks, 10 rules</li>
          <li><strong>Pro Plan ($49/month):</strong> Up to 5,000 notifications/month, 10 webhooks, 50 rules</li>
          <li><strong>Team Plan ($99/month):</strong> Unlimited notifications, webhooks, and rules</li>
        </ul>
      </div>
      <p>Billing occurs monthly in advance. You may upgrade, downgrade, or cancel your subscription at any time. Refunds are not provided for partial months, but you retain access until the end of your billing cycle.</p>

      <h2>5. Acceptable Use Policy</h2>
      <p>You agree not to use PipeNotify to:</p>
      <ul>
        <li>Send spam, unsolicited, or bulk messages</li>
        <li>Transmit any illegal, harmful, threatening, abusive, or offensive content</li>
        <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
        <li>Reverse engineer, decompile, or attempt to extract the source code</li>
        <li>Use the service to compete with us or develop competing products</li>
        <li>Violate any applicable laws, regulations, or third-party rights</li>
        <li>Exceed rate limits or attempt to circumvent usage restrictions</li>
      </ul>

      <h2>6. Data Processing and Privacy</h2>
      <p>We process your data in accordance with our Privacy Policy, which is incorporated by reference. Key points:</p>
      <ul>
        <li>We only process Pipedrive data necessary for notification delivery</li>
        <li>All authentication tokens are encrypted and stored securely</li>
        <li>We comply with GDPR, CCPA, and other applicable data protection laws</li>
        <li>You retain full ownership of your business data</li>
        <li>We implement industry-standard security measures</li>
      </ul>

      <h2>7. Service Availability and Support</h2>
      <p>We strive to maintain 99.9% uptime but cannot guarantee uninterrupted service. We provide:</p>
      <ul>
        <li><strong>24/7 System Monitoring:</strong> Automated health checks and alerts</li>
        <li><strong>Email Support:</strong> Response within 24 hours (business days)</li>
        <li><strong>Priority Support:</strong> For Pro and Team plan subscribers</li>
        <li><strong>Status Page:</strong> Real-time service status and incident updates</li>
        <li><strong>Scheduled Maintenance:</strong> Advance notification for planned downtime</li>
      </ul>

      <h2>8. Limitation of Liability</h2>
      <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong> PipeNotify is provided "AS IS" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:</p>
      <ul>
        <li>Business interruption or loss of profits</li>
        <li>Data loss or corruption</li>
        <li>Third-party service outages (Pipedrive or Google Chat)</li>
        <li>Missed notifications due to technical issues</li>
        <li>Unauthorized access to your data</li>
      </ul>
      <p>Our total liability shall not exceed the amount paid by you for the service in the 12 months preceding the claim.</p>

      <h2>9. Intellectual Property</h2>
      <p>PipeNotify, including its source code, design, functionality, and content, is owned by Prime Dev Labs and protected by intellectual property laws. You may not:</p>
      <ul>
        <li>Copy, modify, or create derivative works of our service</li>
        <li>Remove or alter any proprietary notices</li>
        <li>Use our trademarks or branding without written permission</li>
        <li>Claim ownership of any part of the service</li>
      </ul>

      <h2>10. Termination</h2>
      <p>Either party may terminate this agreement at any time:</p>
      <ul>
        <li><strong>By You:</strong> Cancel your subscription or disconnect the integration</li>
        <li><strong>By Us:</strong> For violations of these terms, non-payment, or at our discretion</li>
        <li><strong>Effect of Termination:</strong> Access ends immediately, data may be retained for 30 days</li>
        <li><strong>Survival:</strong> Privacy, liability, and intellectual property provisions survive termination</li>
      </ul>

      <h2>11. Changes to Terms</h2>
      <p>We reserve the right to update these terms at any time. Material changes will be communicated via:</p>
      <ul>
        <li>Email notification to your registered address</li>
        <li>In-app notifications within the dashboard</li>
        <li>Updates to this page with revision date</li>
      </ul>
      <p>Continued use after changes constitutes acceptance of the revised terms.</p>

      <h2>12. Governing Law and Disputes</h2>
      <p>These Terms shall be governed by the laws of the jurisdiction where Prime Dev Labs operates, without regard to conflict of law provisions. Any disputes shall be resolved through binding arbitration, except for claims involving intellectual property rights.</p>

      <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', marginTop: '30px' }}>
        <h2>13. Contact Information</h2>
        <p><strong>Prime Dev Labs</strong><br/>
        Email: support@primedevlabs.com<br/>
        Response Time: 24 hours (business days)<br/>
        Legal Inquiries: legal@primedevlabs.com</p>
        
        <p><strong>Emergency Support:</strong> For critical service outages affecting enterprise customers, contact support with "URGENT" in the subject line.</p>
      </div>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ color: '#2563eb', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>Privacy Policy</h1>
      
      <div style={{ background: '#f3f4f6', padding: '10px', borderRadius: '5px', marginBottom: '30px' }}>
        <strong>Last Updated:</strong> January 23, 2025<br/>
        <strong>Effective Date:</strong> January 1, 2025<br/>
        <strong>Version:</strong> 3.0<br/>
        <strong>Data Controller:</strong> Prime Dev Labs
      </div>

      <div style={{ background: '#dcfce7', borderLeft: '4px solid #22c55e', padding: '15px', margin: '20px 0' }}>
        <strong>🔒 GDPR Compliance Notice:</strong> This policy complies with the General Data Protection Regulation (GDPR), California Consumer Privacy Act (CCPA), and other applicable data protection laws. We are committed to transparency, data minimization, and your privacy rights.
      </div>

      <h2>1. Introduction</h2>
      <p>Prime Dev Labs ("we," "us," or "our") operates PipeNotify, a notification integration service. This Privacy Policy explains how we collect, use, process, and disclose information when you use our service, and your choices regarding that data.</p>
      
      <p><strong>Data Controller:</strong> Prime Dev Labs acts as the data controller for personal data processed through PipeNotify. For business data synchronized from Pipedrive, you remain the data controller and we act as a data processor.</p>

      <h2>2. Information We Collect</h2>
      
      <h3>2.1 Information You Provide Directly</h3>
      <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Account Information:</strong> Email address, company name, user preferences
        </li>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Authentication Credentials:</strong> Pipedrive OAuth tokens (encrypted), API keys
        </li>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Configuration Data:</strong> Google Chat webhook URLs, notification rules, filters, templates
        </li>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Support Communications:</strong> Messages, attachments, and metadata from support interactions
        </li>
      </ul>

      <h3>2.2 Information We Collect Automatically</h3>
      <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Usage Data:</strong> Features accessed, time stamps, notification delivery logs
        </li>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Technical Data:</strong> IP addresses, browser type, device information, operating system
        </li>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Performance Data:</strong> Response times, error rates, system health metrics
        </li>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Analytics Data:</strong> User interactions, feature usage patterns (anonymized)
        </li>
      </ul>

      <h3>2.3 Information from Third-Party Services</h3>
      <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Pipedrive Data:</strong> Deal information, contact details, pipeline data as configured in your notification rules
        </li>
        <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0', color: '#2563eb', fontWeight: 'bold' }}>•</span>
          <strong>Google Chat Data:</strong> Webhook delivery confirmations, message status
        </li>
      </ul>

      <h2>3. Legal Basis for Processing (GDPR)</h2>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '15px', borderRadius: '5px', margin: '15px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Purpose</th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Legal Basis</th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Data Categories</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Service provision</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Contract performance</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Account, authentication, configuration</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Notification delivery</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Legitimate interest</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Pipedrive data, webhooks</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>System security</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Legitimate interest</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Technical data, logs</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Customer support</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Legitimate interest</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>Support communications</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>Marketing (with consent)</td>
              <td style={{ padding: '8px' }}>Consent</td>
              <td style={{ padding: '8px' }}>Contact information</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>4. How We Use Your Information</h2>
      <p>We use collected information for the following purposes:</p>
      <ul>
        <li><strong>Core Service Delivery:</strong> Processing webhooks, applying filters, delivering notifications</li>
        <li><strong>Account Management:</strong> User authentication, subscription management, billing</li>
        <li><strong>Service Improvement:</strong> Analytics, performance optimization, new feature development</li>
        <li><strong>Security & Compliance:</strong> Fraud prevention, security monitoring, regulatory compliance</li>
        <li><strong>Customer Support:</strong> Troubleshooting, technical assistance, feature guidance</li>
        <li><strong>Communications:</strong> Service updates, security alerts, marketing (with consent)</li>
      </ul>

      <h2>5. Data Sharing and Disclosure</h2>
      <p>We do not sell personal data. We may share information in the following circumstances:</p>
      
      <h3>5.1 Service Providers</h3>
      <ul>
        <li><strong>Infrastructure:</strong> Railway (hosting), Vercel (frontend), PostgreSQL (database)</li>
        <li><strong>Monitoring:</strong> Sentry (error tracking), system health monitoring</li>
        <li><strong>Analytics:</strong> Usage analytics (anonymized data only)</li>
        <li><strong>Payment Processing:</strong> Stripe, PayPal (for subscription billing)</li>
      </ul>

      <h3>5.2 Legal and Compliance</h3>
      <ul>
        <li>Court orders, subpoenas, or legal process</li>
        <li>Law enforcement requests (with proper legal basis)</li>
        <li>Protection of rights, property, or safety</li>
        <li>Regulatory compliance requirements</li>
      </ul>

      <h3>5.3 Business Transfers</h3>
      <p>In the event of a merger, acquisition, or sale of assets, user data may be transferred as part of the transaction. We will notify users and ensure continued protection under this policy.</p>

      <h2>6. Your Privacy Rights</h2>
      
      <h3>6.1 GDPR Rights (EU Residents)</h3>
      <div style={{ background: '#fefce8', border: '1px solid #facc15', padding: '15px', borderRadius: '5px', margin: '15px 0' }}>
        <ul>
          <li><strong>Right of Access:</strong> Request copies of your personal data</li>
          <li><strong>Right to Rectification:</strong> Correct inaccurate personal data</li>
          <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
          <li><strong>Right to Restrict Processing:</strong> Limit how we process your data</li>
          <li><strong>Right to Data Portability:</strong> Receive your data in a machine-readable format</li>
          <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
          <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for marketing or other optional processing</li>
        </ul>
      </div>

      <h3>6.2 CCPA Rights (California Residents)</h3>
      <ul>
        <li><strong>Right to Know:</strong> Categories and sources of personal information collected</li>
        <li><strong>Right to Delete:</strong> Request deletion of personal information</li>
        <li><strong>Right to Opt-Out:</strong> Opt-out of sale of personal information (we don't sell)</li>
        <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy choices</li>
      </ul>

      <h2>7. Data Security</h2>
      <p>We implement comprehensive security measures:</p>
      <ul>
        <li><strong>Encryption:</strong> AES-256 encryption at rest, TLS 1.3 in transit</li>
        <li><strong>Access Controls:</strong> Multi-factor authentication, role-based access</li>
        <li><strong>Network Security:</strong> Firewall protection, intrusion detection</li>
        <li><strong>Regular Audits:</strong> Security assessments, penetration testing</li>
        <li><strong>Employee Training:</strong> Regular privacy and security training</li>
        <li><strong>Incident Response:</strong> 72-hour breach notification procedures</li>
      </ul>

      <h2>8. International Data Transfers</h2>
      <p>Your data may be processed in countries outside your residence. We ensure adequate protection through:</p>
      <ul>
        <li><strong>Standard Contractual Clauses (SCCs):</strong> EU-approved contract terms</li>
        <li><strong>Adequacy Decisions:</strong> Countries with adequate protection levels</li>
        <li><strong>Additional Safeguards:</strong> Technical and organizational measures</li>
        <li><strong>Data Processing Agreements:</strong> With all international service providers</li>
      </ul>

      <h2>9. Data Retention</h2>
      <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '5px', margin: '15px 0' }}>
        <ul>
          <li><strong>Account Data:</strong> Until account deletion + 30 days</li>
          <li><strong>Authentication Tokens:</strong> Until integration disconnection</li>
          <li><strong>Configuration Data:</strong> Until service termination + 30 days</li>
          <li><strong>Usage Logs:</strong> 90 days (operational), 1 year (security)</li>
          <li><strong>Support Data:</strong> 2 years for quality assurance</li>
          <li><strong>Billing Data:</strong> 7 years for tax and compliance purposes</li>
        </ul>
      </div>

      <h2>10. Cookies and Tracking</h2>
      <p>We use cookies and similar technologies for:</p>
      <ul>
        <li><strong>Essential Cookies:</strong> Authentication, security, core functionality</li>
        <li><strong>Analytics Cookies:</strong> Usage statistics (anonymized)</li>
        <li><strong>Preference Cookies:</strong> User settings, language preferences</li>
      </ul>
      <p>You can control cookies through your browser settings. Disabling essential cookies may affect service functionality.</p>

      <h2>11. Children's Privacy</h2>
      <p>Our service is not intended for individuals under 16. We do not knowingly collect personal data from children. If we discover such collection, we will delete the information promptly and notify relevant authorities if required.</p>

      <h2>12. Changes to This Policy</h2>
      <p>We may update this Privacy Policy to reflect service changes or legal requirements. Significant changes will be communicated via:</p>
      <ul>
        <li>Email notification (30 days advance notice)</li>
        <li>In-app notifications</li>
        <li>Prominent notice on this page</li>
      </ul>

      <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', marginTop: '30px' }}>
        <h2>13. Contact Information</h2>
        <p><strong>Data Protection Contacts:</strong></p>
        <p><strong>General Privacy:</strong> privacy@primedevlabs.com<br/>
        <strong>Data Protection Officer:</strong> dpo@primedevlabs.com<br/>
        <strong>GDPR Requests:</strong> gdpr@primedevlabs.com<br/>
        <strong>Security Issues:</strong> security@primedevlabs.com</p>
        
        <p><strong>Response Times:</strong></p>
        <ul>
          <li>General inquiries: 72 hours</li>
          <li>GDPR/Privacy requests: 30 days (1 month)</li>
          <li>Security issues: 24 hours</li>
          <li>Breach notifications: 72 hours (to authorities)</li>
        </ul>

        <p><strong>Supervisory Authority (EU):</strong> You have the right to lodge a complaint with your local data protection authority if you believe we have not complied with data protection laws.</p>
      </div>
    </div>
  );
}

function SupportPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ color: '#2563eb', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', textAlign: 'center' }}>🎧 Support Center</h1>
      
      <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', margin: '30px 0' }}>
        <h2>📞 Contact Support</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
          <div>
            <p><strong>📧 General Support:</strong><br/>support@primedevlabs.com</p>
            <p><strong>🚨 Technical Issues:</strong><br/>tech@primedevlabs.com</p>
            <p><strong>💳 Billing Questions:</strong><br/>billing@primedevlabs.com</p>
          </div>
          <div>
            <p><strong>⏱️ Response Times:</strong></p>
            <ul style={{ margin: '5px 0', paddingLeft: '15px' }}>
              <li>Free Plan: 48 hours</li>
              <li>Paid Plans: 24 hours</li>
              <li>Team Plan: 12 hours</li>
              <li>Critical Issues: 4 hours</li>
            </ul>
          </div>
        </div>
        
        <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '5px', marginTop: '15px' }}>
          <strong>🔥 Priority Support:</strong> Pro and Team plan subscribers receive expedited support with dedicated technical assistance and phone support during business hours.
        </div>
      </div>

      <h2>🔧 Self-Service Tools</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', margin: '20px 0' }}>
        <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <h3 style={{ marginTop: '0', color: '#059669' }}>✅ Connection Tester</h3>
          <p>Use the built-in connection test tool in your dashboard to verify Pipedrive and Google Chat connectivity.</p>
        </div>
        <div style={{ background: '#fefce8', padding: '15px', borderRadius: '8px', border: '1px solid #fef08a' }}>
          <h3 style={{ marginTop: '0', color: '#d97706' }}>📊 Status Dashboard</h3>
          <p>Monitor real-time system status, uptime, and any ongoing incidents at status.pipenotify.com</p>
        </div>
        <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
          <h3 style={{ marginTop: '0', color: '#2563eb' }}>📖 Knowledge Base</h3>
          <p>Browse comprehensive guides, tutorials, and troubleshooting articles in our documentation section.</p>
        </div>
        <div style={{ background: '#fdf4ff', padding: '15px', borderRadius: '8px', border: '1px solid #e879f9' }}>
          <h3 style={{ marginTop: '0', color: '#a21caf' }}>🎥 Video Tutorials</h3>
          <p>Watch step-by-step video guides for setup, configuration, and advanced features.</p>
        </div>
      </div>

      <h2>❓ Frequently Asked Questions</h2>
      
      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', border: '1px solid #e5e7eb' }}>
        <h3 style={{ color: '#374151', marginTop: '0' }}>🚀 How do notifications work?</h3>
        <p>When events happen in Pipedrive (deals created, updated, won/lost), our system receives webhooks, applies your configured rules and filters, then sends formatted notifications to your Google Chat channels. The entire process typically takes under 5 seconds.</p>
      </div>

      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', border: '1px solid #e5e7eb' }}>
        <h3 style={{ color: '#374151', marginTop: '0' }}>⚠️ What if notifications stop working?</h3>
        <p><strong>Quick troubleshooting steps:</strong></p>
        <ol>
          <li>Use the "Test Connection" tool in your dashboard</li>
          <li>Check if your Google Chat webhook URLs are still valid</li>
          <li>Verify your Pipedrive authentication hasn't expired</li>
          <li>Review notification logs for error messages</li>
          <li>Ensure your rules aren't too restrictive (check filters)</li>
        </ol>
      </div>

      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', border: '1px solid #e5e7eb' }}>
        <h3 style={{ color: '#374151', marginTop: '0' }}>💰 How does billing work?</h3>
        <p>Billing is monthly in advance. You can upgrade/downgrade anytime - changes take effect immediately. We prorate billing for upgrades and provide account credit for downgrades. Cancel anytime with no fees.</p>
      </div>

      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', border: '1px solid #e5e7eb' }}>
        <h3 style={{ color: '#374151', marginTop: '0' }}>🔒 How secure is my data?</h3>
        <p>We use enterprise-grade security: AES-256 encryption, TLS 1.3, OAuth 2.0, and SOC 2 Type II compliance. Your Pipedrive data is only processed for notifications - never stored permanently or used for other purposes.</p>
      </div>

      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', border: '1px solid #e5e7eb' }}>
        <h3 style={{ color: '#374151', marginTop: '0' }}>⚡ What are rate limits?</h3>
        <p>Rate limits prevent spam and ensure reliability:</p>
        <ul>
          <li><strong>Free:</strong> 100 notifications/month</li>
          <li><strong>Starter:</strong> 1,000 notifications/month</li>
          <li><strong>Pro:</strong> 5,000 notifications/month</li>
          <li><strong>Team:</strong> Unlimited</li>
        </ul>
        <p>Excess usage is tracked and may require plan upgrade.</p>
      </div>

      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', border: '1px solid #e5e7eb' }}>
        <h3 style={{ color: '#374151', marginTop: '0' }}>🌍 Do you support multiple languages?</h3>
        <p>Currently, PipeNotify supports English, with Spanish, French, and German coming soon. Notification content uses your Pipedrive data language settings.</p>
      </div>

      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', border: '1px solid #e5e7eb' }}>
        <h3 style={{ color: '#374151', marginTop: '0' }}>🔧 Can I customize notification formats?</h3>
        <p>Yes! Pro and Team plans include:</p>
        <ul>
          <li><strong>Template Modes:</strong> Simple, Compact, Detailed, Custom</li>
          <li><strong>Rich Cards:</strong> Professional Google Chat card layouts</li>
          <li><strong>Custom Fields:</strong> Include specific Pipedrive fields</li>
          <li><strong>Conditional Logic:</strong> Dynamic content based on deal data</li>
        </ul>
      </div>

      <h2>🎓 Getting More Help</h2>
      <div style={{ background: '#fefce8', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>📚 Additional Resources</h3>
        <ul>
          <li><strong>📖 Documentation:</strong> Comprehensive setup and configuration guides</li>
          <li><strong>🎥 Video Library:</strong> Step-by-step tutorials and feature demos</li>
          <li><strong>💬 Community Forum:</strong> Connect with other users and share best practices</li>
          <li><strong>🔔 Release Notes:</strong> Stay updated with new features and improvements</li>
          <li><strong>🛠️ API Documentation:</strong> For developers building advanced integrations</li>
        </ul>
      </div>

      <div style={{ background: '#dcfce7', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>🤝 Professional Services</h3>
        <p><strong>Need hands-on help?</strong> Our professional services team offers:</p>
        <ul>
          <li><strong>🎯 Custom Setup:</strong> Personalized configuration for complex workflows</li>
          <li><strong>🏢 Enterprise Onboarding:</strong> Dedicated implementation support</li>
          <li><strong>🔧 Integration Consulting:</strong> Advanced Pipedrive and Google Chat optimization</li>
          <li><strong>📊 Analytics Setup:</strong> Custom reporting and dashboard configuration</li>
        </ul>
        <p><strong>Contact:</strong> services@primedevlabs.com for pricing and availability.</p>
      </div>
    </div>
  );
}

function DocsPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#333' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '40px', borderRadius: '12px' }}>
        <h1 style={{ color: '#2563eb', margin: '0', fontSize: '2.5em' }}>📚 PipeNotify Documentation</h1>
        <p style={{ fontSize: '1.2em', margin: '10px 0 0 0', color: '#6b7280' }}>Complete technical documentation for Pipedrive + Google Chat integration</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <a href="#quick-start" style={{ textDecoration: 'none', color: '#374151', background: 'white', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '20px', transition: 'all 0.2s ease' }}>
          <div style={{ fontSize: '2em', marginBottom: '10px' }}>🚀</div>
          <h3 style={{ color: '#2563eb', margin: '0 0 10px 0' }}>Quick Start</h3>
          <p style={{ margin: '0', fontSize: '0.9em' }}>Get up and running in 5 minutes</p>
        </a>
        <a href="#api-reference" style={{ textDecoration: 'none', color: '#374151', background: 'white', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '20px', transition: 'all 0.2s ease' }}>
          <div style={{ fontSize: '2em', marginBottom: '10px' }}>📖</div>
          <h3 style={{ color: '#2563eb', margin: '0 0 10px 0' }}>API Reference</h3>
          <p style={{ margin: '0', fontSize: '0.9em' }}>Endpoints, webhooks, and authentication</p>
        </a>
        <a href="#troubleshooting" style={{ textDecoration: 'none', color: '#374151', background: 'white', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '20px', transition: 'all 0.2s ease' }}>
          <div style={{ fontSize: '2em', marginBottom: '10px' }}>🔧</div>
          <h3 style={{ color: '#2563eb', margin: '0 0 10px 0' }}>Troubleshooting</h3>
          <p style={{ margin: '0', fontSize: '0.9em' }}>Common issues and solutions</p>
        </a>
        <a href="#examples" style={{ textDecoration: 'none', color: '#374151', background: 'white', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '20px', transition: 'all 0.2s ease' }}>
          <div style={{ fontSize: '2em', marginBottom: '10px' }}>💡</div>
          <h3 style={{ color: '#2563eb', margin: '0 0 10px 0' }}>Examples</h3>
          <p style={{ margin: '0', fontSize: '0.9em' }}>Real-world configuration samples</p>
        </a>
      </div>

      <section id="quick-start">
        <h2 style={{ color: '#374151', fontSize: '2em', marginTop: '50px' }}>🚀 Quick Start Guide</h2>
        
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '20px', margin: '20px 0' }}>
          <h3 style={{ color: '#0369a1', marginTop: '0' }}>📋 Prerequisites</h3>
          <ul>
            <li><strong>Pipedrive Account:</strong> Admin access required for webhook configuration</li>
            <li><strong>Google Chat:</strong> Access to create webhooks in target chat spaces</li>
            <li><strong>Browser:</strong> Chrome, Firefox, Safari, or Edge (latest versions)</li>
          </ul>
        </div>

        <h3>Step 1: Authentication & Setup</h3>
        <div style={{ background: '#1f2937', color: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', fontFamily: 'monospace' }}>
          <strong>1. Navigate to PipeNotify:</strong><br/>
          https://pipenotify-frontend.vercel.app/<br/><br/>
          <strong>2. Click "Connect to Pipedrive":</strong><br/>
          • Authorizes OAuth 2.0 connection<br/>
          • Grants read access to deals, contacts, activities<br/>
          • Creates webhook endpoint automatically
        </div>

        <h3>Step 2: Google Chat Webhook Configuration</h3>
        <ol>
          <li><strong>Open Google Chat</strong> in your browser</li>
          <li><strong>Navigate to target chat space</strong> where you want notifications</li>
          <li><strong>Click the space name</strong> at the top of the chat</li>
          <li><strong>Select "Manage webhooks"</strong> from the dropdown menu</li>
          <li><strong>Click "Add webhook"</strong> and name it "Pipedrive Notifications"</li>
          <li><strong>Copy the generated webhook URL</strong> (starts with https://chat.googleapis.com/)</li>
          <li><strong>Paste URL into PipeNotify</strong> webhook configuration field</li>
        </ol>

        <h3>Step 3: Notification Rule Configuration</h3>
        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', padding: '15px', margin: '15px 0' }}>
          <h4 style={{ marginTop: '0', color: '#ca8a04' }}>⚡ Rule Types Available:</h4>
          <ul>
            <li><strong>Deal Events:</strong> Won, Lost, Created, Updated, Stage Changed</li>
            <li><strong>Contact Events:</strong> Created, Updated, Merged</li>
            <li><strong>Activity Events:</strong> Created, Completed, Overdue</li>
            <li><strong>Pipeline Events:</strong> Deal moved between stages</li>
          </ul>
        </div>

        <h3>Step 4: Advanced Filtering (Pro/Team Plans)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Filter Type</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Description</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Value Range</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Filter by deal value minimum/maximum</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Min: $10,000, Max: $500,000</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Stage Filtering</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Specific pipeline stages only</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Proposal, Negotiation, Closed Won</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Owner Filtering</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Notifications for specific team members</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Sales Manager, Account Executive</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Probability Range</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Filter by deal win probability</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Min: 70%, Max: 100%</td>
            </tr>
          </tbody>
        </table>

        <h3>Step 5: Testing & Validation</h3>
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '15px', margin: '15px 0' }}>
          <h4 style={{ marginTop: '0', color: '#15803d' }}>✅ Built-in Testing Tools:</h4>
          <ul>
            <li><strong>Test Connection:</strong> Validates webhook URLs and authentication</li>
            <li><strong>Send Test Message:</strong> Delivers sample notification to verify formatting</li>
            <li><strong>Rule Simulation:</strong> Test filters without triggering actual events</li>
            <li><strong>Activity Logs:</strong> Monitor real-time notification delivery and errors</li>
          </ul>
        </div>
      </section>

      <section id="api-reference">
        <h2 style={{ color: '#374151', fontSize: '2em', marginTop: '50px' }}>📖 API Reference</h2>
        
        <h3>Webhook Endpoints</h3>
        <div style={{ background: '#1f2937', color: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0', fontFamily: 'monospace', fontSize: '0.9em' }}>
          <strong>Primary Webhook Endpoint:</strong><br/>
          POST https://pipenotify.up.railway.app/api/webhook/:tenant_id<br/><br/>
          <strong>Headers:</strong><br/>
          Content-Type: application/json<br/>
          X-Pipedrive-Event: [event_type]<br/>
          Authorization: Bearer [pipedrive_token]<br/><br/>
          <strong>Supported Events:</strong><br/>
          • deal.added, deal.updated, deal.won, deal.lost<br/>
          • person.added, person.updated, person.merged<br/>
          • activity.added, activity.updated<br/>
          • stage.updated, pipeline.updated
        </div>

        <h3>Authentication Flow</h3>
        <ol>
          <li><strong>OAuth 2.0 Authorization:</strong> User redirected to Pipedrive OAuth endpoint</li>
          <li><strong>Callback Processing:</strong> Authorization code exchanged for access token</li>
          <li><strong>Token Storage:</strong> Encrypted token storage with refresh capability</li>
          <li><strong>Webhook Registration:</strong> Automatic webhook creation in Pipedrive account</li>
        </ol>

        <h3>Rate Limits & Quotas</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Plan Tier</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Monthly Notifications</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Webhook URLs</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Rules</th>
              <th style={{ border: '1px solid #e5e7eb', padding: '12px', textAlign: 'left' }}>Log Retention</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Free</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>100</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>1</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>3</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>7 days</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Starter ($19/mo)</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>1,000</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>3</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>10</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>30 days</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Pro ($49/mo)</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>5,000</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>10</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>50</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>90 days</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}><strong>Team ($99/mo)</strong></td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Unlimited</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Unlimited</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>Unlimited</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '12px' }}>365 days</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="troubleshooting">
        <h2 style={{ color: '#374151', fontSize: '2em', marginTop: '50px' }}>🔧 Troubleshooting Guide</h2>
        
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '15px', margin: '15px 0' }}>
          <h3 style={{ color: '#dc2626', marginTop: '0' }}>🚨 Critical Issues</h3>
          
          <h4>❌ Notifications Not Delivering</h4>
          <ol>
            <li><strong>Verify Authentication:</strong> Check if Pipedrive token is still valid in Settings</li>
            <li><strong>Test Webhook URLs:</strong> Use "Test Connection" to validate Google Chat endpoints</li>
            <li><strong>Check Rule Filters:</strong> Overly restrictive filters may block notifications</li>
            <li><strong>Review Activity Logs:</strong> Look for error messages and delivery failures</li>
            <li><strong>Validate Pipedrive Webhooks:</strong> Ensure webhooks are still active in Pipedrive settings</li>
          </ol>

          <h4>🔒 Authentication Failures</h4>
          <ul>
            <li><strong>Token Expired:</strong> Re-authenticate through Settings → "Reconnect Pipedrive"</li>
            <li><strong>Permissions Changed:</strong> Verify admin access in Pipedrive account</li>
            <li><strong>API Limits:</strong> Check Pipedrive API usage limits in your account</li>
          </ul>
        </div>

        <h3>📞 Support Escalation</h3>
        <div style={{ background: '#eff6ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '20px', margin: '20px 0' }}>
          <h4 style={{ color: '#0369a1', marginTop: '0' }}>When to Contact Support</h4>
          <ul>
            <li><strong>Persistent Authentication Issues:</strong> After multiple re-authentication attempts</li>
            <li><strong>Data Sync Problems:</strong> Missing deals, contacts, or activities</li>
            <li><strong>Performance Issues:</strong> Delays {'>'} 5 minutes for notification delivery</li>
            <li><strong>Billing Discrepancies:</strong> Usage limits or plan restrictions</li>
          </ul>
          
          <p><strong>Contact:</strong> support@primedevlabs.com</p>
          <p><strong>Response Time:</strong> 24 hours for standard support, 4 hours for Pro/Team plans</p>
        </div>
      </section>

      <section id="examples">
        <h2 style={{ color: '#374151', fontSize: '2em', marginTop: '50px' }}>💡 Configuration Examples</h2>
        
        <h3>🎯 Common Use Cases</h3>
        
        <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', margin: '15px 0' }}>
          <h4 style={{ color: '#374151', marginTop: '0' }}>📈 Sales Team Notifications</h4>
          <p><strong>Scenario:</strong> Sales manager wants high-value deal alerts in team channel</p>
          
          <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0' }}>
            <strong>Configuration:</strong><br/>
            • <strong>Events:</strong> Deal Won, Deal Lost, Deal Updated<br/>
            • <strong>Value Filter:</strong> Minimum $10,000<br/>
            • <strong>Owner Filter:</strong> All sales team members<br/>
            • <strong>Channel:</strong> #sales-alerts<br/>
            • <strong>Template:</strong> Detailed with deal info, value, and owner
          </div>
        </div>

        <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', margin: '15px 0' }}>
          <h4 style={{ color: '#374151', marginTop: '0' }}>👔 Executive Dashboard</h4>
          <p><strong>Scenario:</strong> C-level executives want only major deal updates</p>
          
          <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0' }}>
            <strong>Configuration:</strong><br/>
            • <strong>Events:</strong> Deal Won, Deal Lost<br/>
            • <strong>Value Filter:</strong> Minimum $50,000<br/>
            • <strong>Probability Filter:</strong> 90-100% (high-confidence deals)<br/>
            • <strong>Channel:</strong> #executive-updates<br/>
            • <strong>Template:</strong> Compact with key metrics only
          </div>
        </div>
      </section>

      <div style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', padding: '40px', borderRadius: '12px', marginTop: '50px', textAlign: 'center' }}>
        <h2 style={{ color: '#374151', marginTop: '0' }}>🚀 Ready to Get Started?</h2>
        <p style={{ fontSize: '1.1em', marginBottom: '20px' }}>Join thousands of teams already using PipeNotify</p>
        
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/onboarding" style={{ background: '#2563eb', color: 'white', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: '500' }}>
            Start Free Trial
          </a>
          <a href="/support" style={{ background: 'white', color: '#374151', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: '500', border: '1px solid #d1d5db' }}>
            Contact Support
          </a>
          <a href="/pricing" style={{ background: 'transparent', color: '#2563eb', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: '500' }}>
            View Pricing
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/billing" element={<BillingRoute />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
