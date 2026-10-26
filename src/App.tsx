import './App.css';
import { Loader } from './components/Loader';
import { useSession } from './hooks/useSession';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';

const App = () => {
  const session = useSession();

  if (session === undefined) return <Loader />;
  return session ? <DashboardPage user={session.user} /> : <LoginPage />;
};

export default App;
