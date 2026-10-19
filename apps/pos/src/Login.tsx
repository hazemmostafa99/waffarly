import { useLocale, Input, PasswordInput } from '@waffarly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, LoaderCircle, LogIn, Moon, Sun } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PosButton } from './components/pos-button.js';
import { ApiError, apiRequest } from './lib/api-client.js';
import { getPosSession, posSessionKey } from './features/auth/pos-session.api.js';
import { usePosAppearanceStore } from './app/pos-appearance-store.js';
import '@waffarly/ui/pos-theme.css';

export function Login() {
  const { t, errorText, locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = usePosAppearanceStore((state) => state.theme);
  const setTheme = usePosAppearanceStore((state) => state.setTheme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
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

  const selectedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const accent = usePosAppearanceStore((state) => state.accent);
  const sessionCheckError =
    sessionQuery.error instanceof Error &&
    !(sessionQuery.error instanceof ApiError && sessionQuery.error.statusCode === 401)
      ? sessionQuery.error
      : null;

  useEffect(() => {
    if (sessionQuery.data) navigate('/', { replace: true });
  }, [navigate, sessionQuery.data]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginMutation.mutateAsync(login).catch(() => {});
  }

  return (
    <div
      className="pos-theme flex min-h-dvh flex-col bg-background font-sans text-sm text-foreground"
      data-theme={selectedTheme}
      data-accent={accent}
    >
      <a
        className="fixed start-3 top-3 z-50 -translate-y-[150%] rounded-lg bg-primary px-3 py-2 text-primary-foreground focus:translate-y-0"
        href="#main-content"
      >
        {t('Skip to content')}
      </a>

      <header className="shrink-0 border-b border-border bg-card/60">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LayoutGrid aria-hidden="true" size={18} />
            </span>
            <span className="hidden truncate text-sm font-semibold tracking-tight sm:inline">
              {t('Waffarly · POS')}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <PosButton
              type="button"
              variant="outline"
              aria-label={t('Change language')}
              className="min-h-10 px-3 text-xs"
              onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
            >
              {locale === 'en' ? 'العربية' : 'English'}
            </PosButton>
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-2.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
              {selectedTheme === 'dark' ? (
                <Moon aria-hidden="true" size={15} />
              ) : (
                <Sun aria-hidden="true" size={15} />
              )}
              <span className="sr-only">{t('Theme')}</span>
              <select
                aria-label={t('Theme')}
                value={theme}
                onChange={(event) => setTheme(event.target.value as 'light' | 'dark' | 'system')}
                className="max-w-24 cursor-pointer bg-transparent py-2 text-xs text-foreground outline-none"
              >
                <option value="light">{t('Light')}</option>
                <option value="dark">{t('Dark')}</option>
                <option value="system">{t('System')}</option>
              </select>
            </label>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10"
      >
        <section className="w-full max-w-[440px]" aria-labelledby="pos-login-title">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <LogIn aria-hidden="true" size={22} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{t('Cashier workspace')}</p>
              <h1 id="pos-login-title" className="mt-1.5 text-2xl font-semibold tracking-tight">
                {t('Sign in')}
              </h1>
              <p
                id="pos-login-description"
                className="mt-2 text-sm leading-6 text-muted-foreground"
              >
                {t('Sign in with your business code and employee account.')}
              </p>
            </div>

            {sessionCheckError && (
              <div
                className="mb-5 flex flex-col gap-3 rounded-xl border border-warning/40 bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                role="alert"
              >
                <span className="leading-5 text-foreground">
                  {errorText(sessionCheckError.message)}
                </span>
                <PosButton
                  type="button"
                  variant="outline"
                  className="min-h-10 shrink-0 px-3 text-xs"
                  disabled={sessionQuery.isFetching}
                  onClick={() => void sessionQuery.refetch()}
                >
                  {sessionQuery.isFetching ? t('Checking session…') : t('Retry session check')}
                </PosButton>
              </div>
            )}

            <form
              aria-describedby="pos-login-description"
              className="space-y-5"
              onSubmit={(event) => void signIn(event)}
            >
              <div className="space-y-2">
                <label htmlFor="pos-business-code" className="block text-xs font-semibold">
                  {t('Business code')}
                </label>
                <Input
                  id="pos-business-code"
                  name="storefrontSlug"
                  autoComplete="organization"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-12 border-border bg-background text-base md:text-sm"
                  value={login.storefrontSlug}
                  onChange={(event) => setLogin({ ...login, storefrontSlug: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pos-username" className="block text-xs font-semibold">
                  {t('Username')}
                </label>
                <Input
                  id="pos-username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-12 border-border bg-background text-base md:text-sm"
                  value={login.username}
                  onChange={(event) => setLogin({ ...login, username: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 [&_button]:inset-y-1.5 [&_button]:rounded-md [&_button]:bg-secondary [&_button]:text-foreground [&_button]:hover:bg-muted [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring">
                <label htmlFor="pos-password" className="block text-xs font-semibold">
                  {t('Password')}
                </label>
                <PasswordInput
                  id="pos-password"
                  name="password"
                  aria-label={t('Password')}
                  autoComplete="current-password"
                  className="h-12 border-border bg-background text-base md:text-sm"
                  value={login.password}
                  onChange={(event) => setLogin({ ...login, password: event.target.value })}
                  required
                />
              </div>

              {loginMutation.error && (
                <p
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm leading-5 text-destructive"
                  role="alert"
                >
                  {errorText(
                    loginMutation.error instanceof Error
                      ? loginMutation.error.message
                      : t('Sign in failed.'),
                  )}
                </p>
              )}

              <PosButton
                type="submit"
                variant="solid"
                className="min-h-12 w-full gap-2 rounded-lg text-sm font-semibold"
                disabled={loginMutation.isPending || sessionQuery.isLoading}
              >
                {loginMutation.isPending || sessionQuery.isLoading ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                ) : null}
                {loginMutation.isPending
                  ? t('Signing in…')
                  : sessionQuery.isLoading
                    ? t('Checking session…')
                    : t('Sign in')}
              </PosButton>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
