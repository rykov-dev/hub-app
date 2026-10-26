import { type FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'signIn' | 'signUp';

/** Email + password sign-in with a toggle to sign-up. */
export const EmailAuthForm = () => {
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

  return (
    <>
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
    </>
  );
};
