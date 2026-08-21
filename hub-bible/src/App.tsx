import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { UpdatePrompt } from './app/UpdatePrompt';
import { Spinner } from './components/ui';
import HomePage from './features/home/HomePage';
import BiblePage from './features/bible/BiblePage';
import { autoBackupIfDue } from './core/backupStore';
import { ensurePersistenceQuietly } from './core/storage';
import { unregisterServiceWorkerInApp } from './core/platform';
import { useSettings } from './core/settings/SettingsContext';

/**
 * Rotas. Os módulos ministeriais são carregados sob demanda para manter o
 * primeiro carregamento leve — a Bíblia abre imediatamente.
 */
const SearchPage = lazy(() => import('./features/search/SearchPage'));
const FavoritesPage = lazy(() => import('./features/favorites/FavoritesPage'));
const NotesPage = lazy(() => import('./features/notes/NotesPage'));
const SermonsPage = lazy(() => import('./features/sermons/SermonsPage'));
const SermonEditorPage = lazy(() => import('./features/sermons/SermonEditorPage'));
const RhemaPage = lazy(() => import('./features/rhema/RhemaPage'));
const RhemaEditorPage = lazy(() => import('./features/rhema/RhemaEditorPage'));
const ClassPage = lazy(() => import('./features/common/ClassPage'));
const CoursesPage = lazy(() => import('./features/courses/CoursesPage'));
const CourseEditorPage = lazy(() => import('./features/courses/CourseEditorPage'));
const LibraryPage = lazy(() => import('./features/library/LibraryPage'));
const LibraryDocEditorPage = lazy(() => import('./features/library/LibraryDocEditorPage'));
const PlansPage = lazy(() => import('./features/plans/PlansPage'));
const PlanDetailPage = lazy(() => import('./features/plans/PlanDetailPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const HelpPage = lazy(() => import('./features/help/HelpPage'));
const PreachingPage = lazy(() => import('./features/preaching/PreachingPage'));

/** `/estudos/:id` de antes do nome Rhema continua abrindo o mesmo documento. */
function LegacyStudyRedirect() {
  const { id } = useParams();
  return <Navigate to={`/rhema/${id}`} replace />;
}

/** O mesmo para os devocionais, que agora vivem na aba Cursos. */
function LegacyDevotionalRedirect() {
  const { id } = useParams();
  return <Navigate to={`/cursos/${id}`} replace />;
}

/**
 * Cópia automática no aparelho, uma vez a cada poucos dias.
 *
 * Roda depois do primeiro desenho e sem bloquear nada: não é um recurso que o
 * usuário está esperando, é uma rede embaixo dele. Falhar em silêncio é o
 * comportamento certo — um aviso de erro aqui só assustaria sem ajudar.
 */
function useAutoBackup() {
  const { settings } = useSettings();
  useEffect(() => {
    /* Antes de tudo: pedir ao navegador que não descarte estes dados sozinho.
       É barato, é silencioso, e é a diferença entre "o Android liberou espaço"
       e "sumiram os sermões". */
    ensurePersistenceQuietly();

    /* No aplicativo empacotado, tirar do caminho qualquer service worker que
       tenha sobrado de uma versão anterior. Ele serviria telas antigas por cima
       dos arquivos novos do pacote — e recarregar é a única forma de a tela
       atual passar a vir do lugar certo. */
    void unregisterServiceWorkerInApp().then((precisaRecarregar) => {
      if (precisaRecarregar) window.location.reload();
    });

    const timer = window.setTimeout(() => {
      void autoBackupIfDue(settings).catch(() => undefined);
    }, 8000);
    return () => window.clearTimeout(timer);
    // só na montagem: a cópia é periódica, não reage a cada ajuste
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default function App() {
  useAutoBackup();
  return (
    <>
      <Routes>
        {/* Modo Pregação ocupa a tela inteira, sem o shell do app. */}
        <Route
          path="/pregacao/*"
          element={
            <Suspense fallback={<Spinner />}>
              {/* rotas aninhadas: sem elas `/pregacao/:id` casa apenas com o
                  coringa e o parâmetro `id` chega vazio ao Modo Pregação */}
              <Routes>
                <Route path="" element={<PreachingPage />} />
                <Route path=":id" element={<PreachingPage />} />
              </Routes>
            </Suspense>
          }
        />
        {/* Modo Aula — a apostila do Rhema em tela cheia, mesma regra. */}
        <Route
          path="/aula/*"
          element={
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path=":id" element={<ClassPage />} />
                <Route path="*" element={<Navigate to="/rhema" replace />} />
              </Routes>
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
                  <Route path="/rhema" element={<RhemaPage />} />
                  <Route path="/rhema/:id" element={<RhemaEditorPage />} />
                  {/* endereços antigos continuam abrindo: o módulo mudou de
                      nome, não de conteúdo */}
                  <Route path="/estudos" element={<Navigate to="/rhema" replace />} />
                  <Route path="/estudos/:id" element={<LegacyStudyRedirect />} />
                  <Route path="/cursos" element={<CoursesPage />} />
                  <Route path="/cursos/:id" element={<CourseEditorPage />} />
                  <Route path="/devocionais" element={<Navigate to="/cursos" replace />} />
                  <Route path="/devocionais/:id" element={<LegacyDevotionalRedirect />} />
                  <Route path="/biblioteca" element={<LibraryPage />} />
                  <Route path="/biblioteca/material/:id" element={<LibraryDocEditorPage />} />
                  <Route path="/planos" element={<PlansPage />} />
                  <Route path="/planos/:id" element={<PlanDetailPage />} />
                  <Route path="/painel" element={<DashboardPage />} />
                  <Route path="/config" element={<SettingsPage />} />
                  <Route path="/ajuda" element={<HelpPage />} />
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
