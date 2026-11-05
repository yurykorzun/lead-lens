import { createContext, useContext } from 'react';

/**
 * Who an admin is looking through on Officer View / Agent View (lendinggroupco-uhnx.7):
 * 'agent:<Contact Id>' or 'loan_officer:<User Id>'. The server scopes every read to that
 * person and refuses writes, so the admin sees exactly their dashboard, read-only.
 */
export const ViewAsContext = createContext<string | undefined>(undefined);

export function useViewAs() {
  return useContext(ViewAsContext);
}

/** Adds ?viewAs= to an API path when an admin is viewing as someone */
export function withViewAs(path: string, viewAs: string | undefined) {
  if (!viewAs) return path;
  return `${path}${path.includes('?') ? '&' : '?'}viewAs=${encodeURIComponent(viewAs)}`;
}
