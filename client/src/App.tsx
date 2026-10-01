import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Toaster } from './components/ui/toaster';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AppShell = lazy(() => import('./components/layout/AppShell'));
const CommandCenterPage = lazy(() => import('./pages/CommandCenterPage'));
const WorkPage = lazy(() => import('./pages/WorkPage'));
const WorkforcePage = lazy(() => import('./pages/WorkforcePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Public: `/` (landing), `/login`, `/register`.
// Authenticated, inside the app shell: `/home` (Command Center), `/work`, `/workforce`, `/settings`.
export const AppRoutes = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/home" element={<CommandCenterPage />} />
          <Route path="/work" element={<WorkPage />} />
          <Route path="/workforce" element={<WorkforcePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);

const App = () => {
  return (
    <Router>
      <Toaster />
      <AppRoutes />
    </Router>
  );
};

export default App;
