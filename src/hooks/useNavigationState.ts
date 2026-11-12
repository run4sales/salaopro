import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isNavigationDate, navigationScope, readNavigation, writeNavigation } from "@/lib/navigationPersistence";

/** Only pass navigation primitives/IDs, never records, search text, drafts or credentials. */
export function useNavigationState<T>(key: string, initial: T | (() => T), valid: (value: unknown) => value is T) {
  const { user, profile } = useAuth();
  const scope = user?.id && profile?.id ? navigationScope(user.id, profile.id) : null;
  const [entry, setEntry] = useState(() => {
    const fallback = typeof initial === "function" ? (initial as () => T)() : initial;
    let value = fallback;
    try { if (scope) value = readNavigation(window.localStorage, scope, key, fallback, valid); } catch { /* Browser privacy settings can deny localStorage itself. */ }
    return { scope, value };
  });
  // AppLayout keys the authenticated outlet by account and salon, so a scope change remounts this hook.
  useEffect(() => {
    try {
      if (scope && scope === entry.scope && valid(entry.value)) writeNavigation(window.localStorage, scope, key, entry.value);
    } catch { /* Persistence is optional; the current screen stays usable. */ }
  }, [entry, scope, key, valid]);
  const setValue = useCallback((next: SetStateAction<T>) => {
    setEntry(current => {
      const value = typeof next === "function" ? (next as (value: T) => T)(current.value) : next;
      return Object.is(value, current.value) ? current : { ...current, value };
    });
  }, []);
  return [entry.value, setValue] as const;
}

export function useNavigationDate(key: string, initial: Date) {
  const [value, setValue] = useNavigationState(key, initial.toISOString(), isNavigationDate);
  const setDate = useCallback((next: SetStateAction<Date>) => {
    setValue(current => (typeof next === "function" ? next(new Date(current)) : next).toISOString());
  }, [setValue]);
  const date = useMemo(() => new Date(value), [value]);
  return [date, setDate] as const;
}