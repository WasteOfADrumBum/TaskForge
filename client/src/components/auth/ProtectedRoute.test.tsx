import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import authReducer from '../../redux/slices/authSlice';
import taskReducer from '../../redux/slices/taskSlice';

const renderProtectedRoute = (token: string | null) => {
  const store = configureStore({
    reducer: { auth: authReducer, tasks: taskReducer },
    preloadedState: { auth: { token, loading: false, error: null, sessionVersion: 0 } },
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
  return store;
};

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    renderProtectedRoute(null);
    expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument();
  });

  it('renders protected content for authenticated users', () => {
    renderProtectedRoute(
      `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`,
    );
    expect(screen.getByRole('heading', { name: 'Protected Home' })).toBeInTheDocument();
  });

  it.each(['malformed', `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`])(
    'clears an expired or malformed token and redirects without rendering the dashboard',
    (token) => {
      localStorage.setItem('token', token);
      const store = renderProtectedRoute(token);
      expect(screen.queryByRole('heading', { name: 'Protected Home' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Login Page' })).toBeInTheDocument();
      expect(localStorage.getItem('token')).toBeNull();
      expect(store.getState().auth.token).toBeNull();
      expect(store.getState().auth.error).toMatch(/session has expired/);
      expect(store.getState().tasks).toEqual({
        items: [],
        loading: false,
        error: null,
        loaded: false,
      });
    },
  );
});
