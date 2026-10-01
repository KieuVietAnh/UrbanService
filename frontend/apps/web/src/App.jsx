// src/App.jsx
import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './contexts/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { toolsApi } from '@urbanmind/shared-api';

function App() {
  useEffect(() => {
    // Initialize local mock data only when explicitly enabled for staging/demo.
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      toolsApi.init();
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Analytics />
        <SpeedInsights />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
