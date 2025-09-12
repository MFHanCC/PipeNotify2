import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import OnboardingWizard from './components/OnboardingWizard';
import Dashboard from './components/Dashboard';
import PricingPage from './components/PricingPage';
import BillingDashboard from './components/BillingDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={
            <OnboardingWizard 
              onComplete={() => window.location.href = '/dashboard'} 
              onSkip={() => window.location.href = '/dashboard'} 
            />
          } />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/billing" element={<BillingDashboard onNavigateToPricing={() => window.location.href = '/pricing'} />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
