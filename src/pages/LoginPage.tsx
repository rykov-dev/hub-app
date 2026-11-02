import { EmailAuthForm } from '../components/EmailAuthForm';
import { OAuthButtons } from '../components/OAuthButtons';
import { ThemeToggle } from '../components/ThemeToggle';

export const LoginPage = () => (
  <div className="layout layout-center">
    <main className="card login area-login">
      <div className="login-top">
        <ThemeToggle />
      </div>
      <h1>Deity</h1>
      <p className="muted">Записывай мысли в Inbox. Они шифруются на твоём устройстве.</p>
      <OAuthButtons />
      <div className="divider">
        <span>или по email</span>
      </div>
      <EmailAuthForm />
    </main>
  </div>
);
