import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { applyTheme, currentTheme } from './app/theme';
import { Spinner } from './components/ui';
import LibraryPage from './features/LibraryPage';

const MaterialPage = lazy(() => import('./features/MaterialPage'));
const ReviewPage = lazy(() => import('./features/ReviewPage'));
const SettingsPage = lazy(() => import('./features/SettingsPage'));
const HelpPage = lazy(() => import('./features/HelpPage'));

export default function App() {
  useEffect(() => {
    applyTheme(currentTheme());
  }, []);
  return (
    <Layout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/m/:id" element={<MaterialPage />} />
          <Route path="/revisar" element={<ReviewPage />} />
          <Route path="/config" element={<SettingsPage />} />
          <Route path="/ajuda" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
