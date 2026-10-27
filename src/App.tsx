import './App.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Loader } from './components/Loader';
import { useSession } from './hooks/useSession';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { NotePage } from './pages/NotePage';

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
          <Route path="inbox" element={<InboxPage />} />
          <Route path="inbox/:noteId" element={<NotePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
