import type { ReactNode } from 'react';
import { WorkspaceChrome } from '@waffarly/ui';

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return <WorkspaceChrome>{children}</WorkspaceChrome>;
}
