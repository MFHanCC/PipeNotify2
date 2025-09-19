import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import OnboardingWizard from './components/OnboardingWizard';
import Dashboard from './components/Dashboard';
import PricingPage from './components/PricingPage';
import BillingDashboard from './components/BillingDashboard';
import './App.css';

function OnboardingRoute() {
  const navigate = useNavigate();
  
  return (
    <OnboardingWizard 
      onComplete={() => navigate('/dashboard')} 
      onSkip={() => navigate('/dashboard')} 
    />
  );
}

function BillingRoute() {
  const navigate = useNavigate();
  
  return (
    <BillingDashboard onNavigateToPricing={() => navigate('/pricing')} />
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
