import './App.css';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { useSession } from './hooks/useSession';

const App = () => {
  const session = useSession();

  return (
    <div className="content">
      {session === undefined ? null : session ? (
        <Dashboard user={session.user} />
      ) : (
        <Login />
      )}
    </div>
  );
};

export default App;
