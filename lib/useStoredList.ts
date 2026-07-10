"use client";

import { useCallback, useEffect, useState } from "react";

function safelyParse<T>(value: string | null): T[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function useStoredList<T>(key: string) {
  const [items, setItemsState] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    setItemsState(safelyParse<T>(window.localStorage.getItem(key)));
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    reload();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) reload();
    };

    const handleFocus = () => reload();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [key, reload]);

  const setItems = useCallback(
    (next: T[] | ((current: T[]) => T[])) => {
      setItemsState((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        window.localStorage.setItem(key, JSON.stringify(resolved));
        window.dispatchEvent(new Event("tt-business-data-change"));
        return resolved;
      });
    },
    [key]
  );

  useEffect(() => {
    const handleLocalChange = () => reload();
    window.addEventListener("tt-business-data-change", handleLocalChange);
    return () => window.removeEventListener("tt-business-data-change", handleLocalChange);
  }, [reload]);

  return { items, setItems, loaded, reload };
}
