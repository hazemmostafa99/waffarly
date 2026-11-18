import { resolve } from 'node:path';

/** Resolves workspace paths consistently for configs invoked from any directory. */
export function workspacePath(...segments: string[]): string {
  return resolve(__dirname, '../..', ...segments);
}
