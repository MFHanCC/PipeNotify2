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
function StaticPage({ htmlFile }: { htmlFile: string }) {
  React.useEffect(() => {
    // Redirect to the static HTML file
    window.location.href = `/${htmlFile}`;
  }, [htmlFile]);
  
  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <p>Redirecting to {htmlFile}...</p>
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
          <Route path="/terms" element={<StaticPage htmlFile="terms.html" />} />
          <Route path="/privacy" element={<StaticPage htmlFile="privacy.html" />} />
          <Route path="/support" element={<StaticPage htmlFile="support.html" />} />
          <Route path="/docs" element={<StaticPage htmlFile="docs.html" />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
