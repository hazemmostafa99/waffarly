import { useContext, useLayoutEffect, type ReactNode } from 'react';
import { PageTitleContext } from '../lib/page-title-context.js';

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  const context = useContext(PageTitleContext);
  if (!context) throw new Error('PageHeader requires a PageTitleProvider.');
  const { setTitle } = context;

  useLayoutEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);

  return actions ? <div className="admin-toolbar">{actions}</div> : null;
}
