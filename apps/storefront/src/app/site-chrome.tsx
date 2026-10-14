'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@waffarly/ui';

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith('/s/') ? children : <WorkspaceChrome>{children}</WorkspaceChrome>;
}
