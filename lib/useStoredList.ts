"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type CloudRow = {
  user_id: string;
  storage_key: string;
  items: unknown;
  updated_at: string;
};

function safelyParse<T>(value: string | null): T[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function itemId(value: unknown, index: number) {
  if (isRecord(value) && typeof value.id === "string" && value.id) {
    return value.id;
  }

  return `item-${index}-${JSON.stringify(value)}`;
}

function itemUpdatedAt(value: unknown) {
  if (
    isRecord(value) &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt)
  ) {
    return value.updatedAt;
  }

  return 0;
}

function mergeLists<T>(cloudItems: T[], localItems: T[]) {
  const merged = new Map<string, T>();

  cloudItems.forEach((item, index) => {
    merged.set(itemId(item, index), item);
  });

  localItems.forEach((item, index) => {
    const id = itemId(item, index);
    const existing = merged.get(id);

    if (!existing || itemUpdatedAt(item) >= itemUpdatedAt(existing)) {
      merged.set(id, item);
    }
  });

  return Array.from(merged.values());
}

function migrationStorageKey(userId: string, storageKey: string) {
  return `tt-cloud-migrated:${userId}:${storageKey}`;
}

export function useStoredList<T>(key: string) {
  const [items, setItemsState] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState("");

  const userIdRef = useRef<string | null>(null);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const saveLocal = useCallback(
    (nextItems: T[]) => {
      setItemsState(nextItems);
      window.localStorage.setItem(key, JSON.stringify(nextItems));
    },
    [key]
  );

  const getSignedInUserId = useCallback(async () => {
    if (userIdRef.current) return userIdRef.current;

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    const userId = session?.user.id ?? null;
    userIdRef.current = userId;
    return userId;
  }, []);

  const writeCloud = useCallback(
    async (nextItems: T[]) => {
      const userId = await getSignedInUserId();
      if (!userId) return;

      const { error } = await supabase.from("business_app_data").upsert(
        {
          user_id: userId,
          storage_key: key,
          items: nextItems,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,storage_key",
        }
      );

      if (error) throw error;
    },
    [getSignedInUserId, key]
  );

  const queueCloudWrite = useCallback(
    (nextItems: T[]) => {
      const snapshot = JSON.parse(JSON.stringify(nextItems)) as T[];

      writeQueueRef.current = writeQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await writeCloud(snapshot);
            setSyncError("");
          } catch (error) {
            console.error(`Failed to sync ${key}`, error);
            setSyncError("Cloud sync failed");
          }
        });
    },
    [key, writeCloud]
  );

  const loadCloud = useCallback(
    async (allowMigration: boolean) => {
      const localItems = safelyParse<T>(window.localStorage.getItem(key));

      try {
        const userId = await getSignedInUserId();

        if (!userId) {
          saveLocal(localItems);
          setLoaded(true);
          return;
        }

        const { data, error } = await supabase
          .from("business_app_data")
          .select("user_id, storage_key, items, updated_at")
          .eq("user_id", userId)
          .eq("storage_key", key)
          .maybeSingle<CloudRow>();

        if (error) throw error;

        const cloudItems = Array.isArray(data?.items)
          ? (data.items as T[])
          : [];

        const migrationKey = migrationStorageKey(userId, key);
        const alreadyMigrated =
          window.localStorage.getItem(migrationKey) === "1";

        let resolvedItems: T[];

        if (allowMigration && !alreadyMigrated) {
          resolvedItems = mergeLists(cloudItems, localItems);
          await writeCloud(resolvedItems);
          window.localStorage.setItem(migrationKey, "1");
        } else if (data) {
          resolvedItems = cloudItems;
        } else {
          resolvedItems = localItems;
          await writeCloud(resolvedItems);
        }

        saveLocal(resolvedItems);
        setSyncError("");
      } catch (error) {
        console.error(`Failed to load ${key} from cloud`, error);
        saveLocal(localItems);
        setSyncError("Using device data");
      } finally {
        setLoaded(true);
      }
    },
    [getSignedInUserId, key, saveLocal, writeCloud]
  );

  const reload = useCallback(() => {
    void loadCloud(false);
  }, [loadCloud]);

  useEffect(() => {
    void loadCloud(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      setItemsState(safelyParse<T>(event.newValue));
    };

    const handleLocalChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;

      if (customEvent.detail?.key && customEvent.detail.key !== key) {
        return;
      }

      setItemsState(safelyParse<T>(window.localStorage.getItem(key)));
    };

    const handleFocus = () => {
      void loadCloud(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadCloud(false);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "tt-business-data-change",
      handleLocalChange as EventListener
    );
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "tt-business-data-change",
        handleLocalChange as EventListener
      );
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [key, loadCloud]);

  const setItems = useCallback(
    (next: T[] | ((current: T[]) => T[])) => {
      setItemsState((current) => {
        const resolved =
          typeof next === "function"
            ? (next as (current: T[]) => T[])(current)
            : next;

        window.localStorage.setItem(key, JSON.stringify(resolved));
        window.dispatchEvent(
          new CustomEvent("tt-business-data-change", {
            detail: { key },
          })
        );

        queueCloudWrite(resolved);
        return resolved;
      });
    },
    [key, queueCloudWrite]
  );

  return {
    items,
    setItems,
    loaded,
    reload,
    syncError,
  };
}
