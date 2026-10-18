import { useLocale, Input, Button, PasswordInput } from '@waffarly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from './lib/api-client.js';
import { getPosSession, posSessionKey } from './features/auth/pos-session.api.js';

export function Login() {
  const { t, errorText } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [login, setLogin] = useState({ storefrontSlug: '', username: '', password: '' });
  const sessionQuery = useQuery({
    queryKey: posSessionKey,
    queryFn: ({ signal }) => getPosSession(signal),
    retry: false,
    staleTime: 30_000,
  });
  const loginMutation = useMutation({
    mutationFn: async (credentials: typeof login) => {
      await apiRequest('/auth/pos/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return getPosSession();
    },
    onSuccess: (session) => {
      queryClient.setQueryData(posSessionKey, session);
      navigate('/', { replace: true });
    },
  });

  useEffect(() => {
    if (sessionQuery.data) navigate('/', { replace: true });
  }, [navigate, sessionQuery.data]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginMutation.mutateAsync(login).catch(() => {});
  }

  return (
    <main id="main-content" tabIndex={-1} className="shell narrow">
      <div className="eyebrow">{t('Waffarly · POS')}</div>
      <h1>{t('Point of Sale')}</h1>
      <p>{t('Sign in with your business code and employee account.')}</p>
      <form className="panel form" onSubmit={(event) => void signIn(event)}>
        <label>
          {t('Business code')}{' '}
          <Input
            autoComplete="organization"
            value={login.storefrontSlug}
            onChange={(event) => setLogin({ ...login, storefrontSlug: event.target.value })}
            required
          />
        </label>
        <label>
          {t('Username')}{' '}
          <Input
            autoComplete="username"
            value={login.username}
            onChange={(event) => setLogin({ ...login, username: event.target.value })}
            required
          />
        </label>
        <label>
          {t('Password')}{' '}
          <PasswordInput
            aria-label={t('Password')}
            autoComplete="current-password"
            value={login.password}
            onChange={(event) => setLogin({ ...login, password: event.target.value })}
            required
          />
        </label>
        <Button type="submit" disabled={loginMutation.isPending || sessionQuery.isLoading}>
          {loginMutation.isPending ? t('Signing in…') : t('Sign in')}{' '}
        </Button>
      </form>
      {(loginMutation.error ||
        (sessionQuery.error instanceof Error &&
          !(sessionQuery.error instanceof ApiError && sessionQuery.error.statusCode === 401))) && (
        <p className="error" role="alert">
          {errorText(
            loginMutation.error instanceof Error
              ? loginMutation.error.message
              : sessionQuery.error instanceof Error
                ? sessionQuery.error.message
                : t('Sign in failed.'),
          )}
        </p>
      )}
    </main>
  );
}
