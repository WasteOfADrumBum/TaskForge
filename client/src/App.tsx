// App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LoginPage, HomePage, RegisterPage, NotFoundPage } from './pages';
import { Toaster } from './components/ui/toaster';

const App: React.FC = () => {
  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} /> {/* Fallback route */}
      </Routes>
    </Router>
  );
};

export default App;
