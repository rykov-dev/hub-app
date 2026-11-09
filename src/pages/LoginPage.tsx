import { useState } from 'react';
import { EmailAuthForm } from '../components/EmailAuthForm';
import { OAuthButtons } from '../components/OAuthButtons';
import { ThemeToggle } from '../components/ThemeToggle';
import { resetDeviceData } from '../lib/auth';

export const LoginPage = () => {
  const [resetting, setResetting] = useState(false);

  const reset = async () => {
    if (!window.confirm('Удалить локальные данные приложения на этом устройстве и начать с нуля?')) {
      return;
    }

    setResetting(true);
    await resetDeviceData();
    window.location.reload();
  };

  return (
    <div className="layout layout-center">
      <main className="card login area-login">
        <div className="login-top">
          <ThemeToggle />
        </div>
        <h1>Deity</h1>
        <p className="muted">Записывай мысли, ссылки и фото в Inbox и выбирай посильные дела на день.</p>
        <OAuthButtons />
        <div className="divider">
          <span>или по email</span>
        </div>
        <EmailAuthForm />
        <div className="divider">
          <span>Проблемы со входом или локальными данными?</span>
        </div>
        <button type="button" className="link" disabled={resetting} onClick={reset}>
          {resetting ? 'Удаляем данные…' : 'Начать с нуля'}
        </button>
      </main>
    </div>
  );
};
