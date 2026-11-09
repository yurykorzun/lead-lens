import { createContext, useContext } from 'react';

/**
 * The Lead Lens user an admin is viewing the dashboard as, or undefined. Read hooks send
 * it as ?asUser=; the server ignores it on writes, and the UI hides every write while set.
 */
export const ViewAsContext = createContext<string | undefined>(undefined);

export function useViewAs(): string | undefined {
  return useContext(ViewAsContext);
}

/** Adds ?asUser= (or &asUser=) to a GET path when viewing as someone */
export function withViewAs(path: string, asUser: string | undefined): string {
  if (!asUser) return path;
  return `${path}${path.includes('?') ? '&' : '?'}asUser=${encodeURIComponent(asUser)}`;
}
