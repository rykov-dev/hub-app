import './App.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Loader } from './components/Loader';
import { useSession } from './hooks/useSession';
import { AppLayout } from './layouts/AppLayout';
import { ChatPage } from './pages/ChatPage';
import { DashboardPage } from './pages/DashboardPage';
import { GamePage } from './pages/GamePage';
import { InboxPage } from './pages/InboxPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { LinksPage } from './pages/LinksPage';
import { LoginPage } from './pages/LoginPage';
import { NotePage } from './pages/NotePage';
import { VaultImportPage } from './pages/VaultImportPage';

// BASE_URL is '/hub-app/' on GitHub Pages and '/' locally.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

const App = () => {
  const session = useSession();

  if (session === undefined) return <Loader />;

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route
          element={session ? <AppLayout user={session.user} /> : <Navigate to="/login" replace />}
        >
          <Route index element={<DashboardPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="inbox/:noteId" element={<NotePage />} />
          <Route path="settings/import-vault" element={<VaultImportPage />} />
          <Route path="chat/:chatId?" element={<ChatPage />} />
          <Route path="game" element={<GamePage />} />
          <Route path="world" element={<Navigate to="/game" replace />} />
          <Route path="links" element={<LinksPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
