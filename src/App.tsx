import './App.css';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { useSession } from './hooks/useSession';

const App = () => {
  const session = useSession();

  if (session === undefined) return null;
  return session ? <Dashboard user={session.user} /> : <Login />;
};

export default App;
