import { EmailAuthForm } from '../components/EmailAuthForm';
import { OAuthButtons } from '../components/OAuthButtons';
import { ThemeToggle } from '../components/ThemeToggle';

export const LoginPage = () => (
  <div className="layout layout-center">
    <main className="card login area-login">
      <div className="login-top">
        <ThemeToggle />
      </div>
      <h1>Монетки</h1>
      <p className="muted">Заходи каждый день и собирай монетки.</p>
      <OAuthButtons />
      <div className="divider">
        <span>или по email</span>
      </div>
      <EmailAuthForm />
    </main>
  </div>
);
