import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from './redux/store';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { ColorModeProvider } from './components/ui/color-mode';
import { Provider as UIProvider } from './components/ui/provider';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement); // This is the new API in React 18
  root.render(
    <React.StrictMode>
      <ReduxProvider store={store}>
        <ChakraProvider value={defaultSystem}>
          <ColorModeProvider>
            <UIProvider>
              <App />
            </UIProvider>
          </ColorModeProvider>
        </ChakraProvider>
      </ReduxProvider>
    </React.StrictMode>,
  );
} else {
  throw new Error('Root element not found');
}
