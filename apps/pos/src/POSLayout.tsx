import { Outlet, useNavigate } from 'react-router-dom';
import { useLocale, Button } from '@waffarly/ui';
import { useEffect, useState } from 'react';
import { apiRequest } from './lib/api-client.js';

export function POSLayout() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void apiRequest('/auth/pos/me')
      .then(() => setSignedIn(true))
      .catch(() => {
        setSignedIn(false);
        navigate('/login');
      });
  }, [navigate]);

  async function signOut() {
    try {
      await apiRequest('/auth/pos/logout', { method: 'POST' });
      setSignedIn(false);
      navigate('/login');
    } catch (cause) {
      console.error('Sign out failed:', cause);
    }
  }

  if (signedIn === null) {
    return (
      <main id="main-content" tabIndex={-1} className="shell">
        {t('Loading POS…')}
      </main>
    );
  }

  if (!signedIn) {
    return null; // Will redirect to login via useEffect
  }

  return (
    <main id="main-content" tabIndex={-1} className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">{t('Waffarly · POS')}</div>
          <h1>{t('POS Workspace')}</h1>
        </div>
        <Button variant="outline" type="button" onClick={() => void signOut()}>
          {t('Sign out')}{' '}
        </Button>
      </header>
      <Outlet />
    </main>
  );
}