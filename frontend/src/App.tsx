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
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
