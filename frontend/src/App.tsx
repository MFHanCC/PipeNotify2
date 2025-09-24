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
        <strong>Last Updated:</strong> January 23, 2025
      </div>

      <h2>1. Acceptance of Terms</h2>
      <p>By accessing and using PipeNotify ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.</p>

      <h2>2. Description of Service</h2>
      <p>PipeNotify is a notification integration service that connects your Pipedrive CRM with Google Chat, enabling real-time notifications for deals, contacts, and pipeline activities.</p>

      <h2>3. User Accounts and Registration</h2>
      <p>To use PipeNotify, you must have a valid Pipedrive account and Google Chat access.</p>

      <h2>4. Privacy and Data Protection</h2>
      <p>We are committed to protecting your privacy. Our Privacy Policy explains how we collect, use, and protect your information.</p>

      <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', marginTop: '30px' }}>
        <h2>Contact Information</h2>
        <p>If you have questions about these Terms of Service:</p>
        <p><strong>Email:</strong> support@primedevlabs.com</p>
      </div>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ color: '#2563eb', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>Privacy Policy</h1>
      
      <div style={{ background: '#f3f4f6', padding: '10px', borderRadius: '5px', marginBottom: '30px' }}>
        <strong>Last Updated:</strong> January 23, 2025
      </div>

      <div style={{ background: '#dcfce7', borderLeft: '4px solid #22c55e', padding: '15px', margin: '20px 0' }}>
        <strong>GDPR Compliance:</strong> This policy complies with the General Data Protection Regulation (GDPR) and other applicable data protection laws.
      </div>

      <h2>1. Introduction</h2>
      <p>PipeNotify is committed to protecting your privacy. This Privacy Policy explains how we collect, use, process, and disclose your information.</p>

      <h2>2. Information We Collect</h2>
      <ul>
        <li><strong>Authentication Data:</strong> Pipedrive OAuth tokens (stored encrypted)</li>
        <li><strong>Configuration Data:</strong> Google Chat webhook URLs, notification rules</li>
        <li><strong>Usage Data:</strong> Logs of notification delivery and system health</li>
      </ul>

      <h2>3. Your Rights (GDPR)</h2>
      <p>If you are located in the EU, you have rights including access, rectification, erasure, and data portability.</p>

      <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', marginTop: '30px' }}>
        <h2>Contact Information</h2>
        <p>For privacy questions or to exercise your rights:</p>
        <p><strong>Email:</strong> support@primedevlabs.com</p>
        <p><strong>Subject Line:</strong> Privacy Policy Inquiry</p>
      </div>
    </div>
  );
}

function SupportPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ color: '#2563eb', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', textAlign: 'center' }}>Support Center</h1>
      
      <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', margin: '30px 0' }}>
        <h2>Contact Support</h2>
        <p><strong>Email:</strong> support@primedevlabs.com</p>
        <p><strong>Response Time:</strong> We aim to respond within 24 hours during business days</p>
      </div>

      <h2>Frequently Asked Questions</h2>
      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0' }}>
        <h3>How do notifications work?</h3>
        <p>When events happen in Pipedrive, our system processes them through your rules and sends formatted messages to Google Chat.</p>
      </div>

      <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '5px', margin: '10px 0' }}>
        <h3>What if notifications stop working?</h3>
        <p>Use the Test Connection tool to diagnose issues. Check your webhook URLs and rule configurations.</p>
      </div>
    </div>
  );
}

function DocsPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ color: '#2563eb', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>Documentation</h1>
      
      <h2>Getting Started</h2>
      <p>PipeNotify integrates your Pipedrive CRM with Google Chat to deliver real-time notifications.</p>

      <h2>Setup Guide</h2>
      <ol>
        <li>Connect your Pipedrive account</li>
        <li>Add your Google Chat webhook URLs</li>
        <li>Configure notification rules</li>
        <li>Test your setup</li>
      </ol>

      <h2>Features</h2>
      <ul>
        <li><strong>Real-time Notifications:</strong> Get instant updates when deals change</li>
        <li><strong>Advanced Filtering:</strong> Control which notifications you receive</li>
        <li><strong>Multiple Channels:</strong> Send notifications to different chat rooms</li>
        <li><strong>Custom Templates:</strong> Personalize your notification format</li>
      </ul>

      <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '8px', marginTop: '30px' }}>
        <h2>Need Help?</h2>
        <p>Contact our support team: <strong>support@primedevlabs.com</strong></p>
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
