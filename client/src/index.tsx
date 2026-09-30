import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as ReduxProvider } from 'react-redux';
import App from './App';
import { Provider as UIProvider } from './components/ui/provider';
import { store } from './redux/store';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ReduxProvider store={store}>
      <UIProvider>
        <App />
      </UIProvider>
    </ReduxProvider>
  </React.StrictMode>,
);
