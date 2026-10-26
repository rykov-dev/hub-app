import type { Provider } from '@supabase/supabase-js';
import { type FormEvent, type ReactNode, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ThemeToggle';

type Mode = 'signIn' | 'signUp';

const providers: { id: Provider; label: string; icon: ReactNode }[] = [
  {
    id: 'google',
    label: 'Google',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'GitHub',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
      </svg>
    ),
  },
];

export const Login = () => {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    // Email confirmation is disabled, so sign-up signs the user in right away.
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setPending(false);
    if (error) setError(error.message);
  };

  const signInWith = async (provider: Provider) => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Back to the app root, including the GitHub Pages base path.
      options: { redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="layout layout-center">
      <main className="card login area-login">
        <div className="login-top">
          <ThemeToggle />
        </div>
        <h1>Монетки</h1>
        <p className="muted">Заходи каждый день и собирай монетки.</p>
        <div className="oauth">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn btn-oauth"
              onClick={() => signInWith(p.id)}
            >
              {p.icon}
              Войти через {p.label}
            </button>
          ))}
        </div>
        <div className="divider">
          <span>или по email</span>
        </div>
        <form className="login-form" onSubmit={onSubmit}>
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="input"
            placeholder="Пароль"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {mode === 'signIn' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
          }}
        >
          {mode === 'signIn' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
        </button>
      </main>
    </div>
  );
};
