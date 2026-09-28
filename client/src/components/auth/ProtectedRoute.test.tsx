import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import authReducer from '../../redux/slices/authSlice';

const renderProtectedRoute = (token: string | null) => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token, loading: false, error: null } },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/login" element={<h1>Login Page</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<h1>Protected Home</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
};

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    renderProtectedRoute(null);
    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument();
  });

  it('renders protected content for authenticated users', () => {
    renderProtectedRoute('jwt-token');
    expect(screen.getByRole('heading', { name: 'Protected Home' })).toBeInTheDocument();
  });
});
