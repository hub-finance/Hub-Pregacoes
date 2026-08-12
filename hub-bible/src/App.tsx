import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { UpdatePrompt } from './app/UpdatePrompt';
import { Spinner } from './components/ui';
import HomePage from './features/home/HomePage';
import BiblePage from './features/bible/BiblePage';

/**
 * Rotas. Os módulos ministeriais são carregados sob demanda para manter o
 * primeiro carregamento leve — a Bíblia abre imediatamente.
 */
const SearchPage = lazy(() => import('./features/search/SearchPage'));
const FavoritesPage = lazy(() => import('./features/favorites/FavoritesPage'));
const NotesPage = lazy(() => import('./features/notes/NotesPage'));
const SermonsPage = lazy(() => import('./features/sermons/SermonsPage'));
const SermonEditorPage = lazy(() => import('./features/sermons/SermonEditorPage'));
const StudiesPage = lazy(() => import('./features/studies/StudiesPage'));
const StudyEditorPage = lazy(() => import('./features/studies/StudyEditorPage'));
const DevotionalsPage = lazy(() => import('./features/devotionals/DevotionalsPage'));
const DevotionalEditorPage = lazy(() => import('./features/devotionals/DevotionalEditorPage'));
const LibraryPage = lazy(() => import('./features/library/LibraryPage'));
const LibraryDocEditorPage = lazy(() => import('./features/library/LibraryDocEditorPage'));
const PlansPage = lazy(() => import('./features/plans/PlansPage'));
const PlanDetailPage = lazy(() => import('./features/plans/PlanDetailPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const PreachingPage = lazy(() => import('./features/preaching/PreachingPage'));

export default function App() {
  return (
    <>
      <Routes>
        {/* Modo Pregação ocupa a tela inteira, sem o shell do app. */}
        <Route
          path="/pregacao/*"
          element={
            <Suspense fallback={<Spinner />}>
              <PreachingPage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <AppLayout>
              <Suspense fallback={<Spinner />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/biblia" element={<BiblePage />} />
                  <Route path="/biblia/:book/:chapter" element={<BiblePage />} />
                  <Route path="/busca" element={<SearchPage />} />
                  <Route path="/favoritos" element={<FavoritesPage />} />
                  <Route path="/anotacoes" element={<NotesPage />} />
                  <Route path="/sermoes" element={<SermonsPage />} />
                  <Route path="/sermoes/:id" element={<SermonEditorPage />} />
                  <Route path="/estudos" element={<StudiesPage />} />
                  <Route path="/estudos/:id" element={<StudyEditorPage />} />
                  <Route path="/devocionais" element={<DevotionalsPage />} />
                  <Route path="/devocionais/:id" element={<DevotionalEditorPage />} />
                  <Route path="/biblioteca" element={<LibraryPage />} />
                  <Route path="/biblioteca/material/:id" element={<LibraryDocEditorPage />} />
                  <Route path="/planos" element={<PlansPage />} />
                  <Route path="/planos/:id" element={<PlanDetailPage />} />
                  <Route path="/painel" element={<DashboardPage />} />
                  <Route path="/config" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AppLayout>
          }
        />
      </Routes>
      <UpdatePrompt />
    </>
  );
}
