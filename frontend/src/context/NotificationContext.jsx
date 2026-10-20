/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { startAutoRefresh } from "../api/liveUpdates";

import { api } from "../api/client";

const NotificationContext = createContext(null);

function isLocal(id) {
  return typeof id === "string" && id.startsWith("local-");
}

export function NotificationProvider({ children, account }) {
  const accountId = account?.id ?? null;

  const [backendNotifications, setBackendNotifications] =
    useState([]);
  const [localNotifications, setLocalNotifications] =
    useState([]);
  const [dismissedIds, setDismissedIds] = useState(
    () => new Set(),
  );
  const [syncStatus, setSyncStatus] = useState(
    accountId === null ? "idle" : "loading",
  );
  const [readError, setReadError] = useState("");
  const [readingIds, setReadingIds] = useState([]);

  const mounted = useRef(false);
  const confirmedReadIds = useRef(new Set());
  const pendingReadIds = useRef(new Set());
  const localSequence = useRef(0);

  useEffect(() => {
    let active = true;
    let hadError = false;
    let recoveryUntil = 0;

    mounted.current = true;

    async function refreshNotifications() {
      try {
        const incoming = await api("/notifications");

        if (!active) return;

        setBackendNotifications(
          incoming.map((notification) => ({
            ...notification,
            read:
              notification.read ||
              confirmedReadIds.current.has(notification.id),
          })),
        );

        if (hadError) {
          recoveryUntil = Date.now() + 3000;
          hadError = false;
        }

        setSyncStatus(
          Date.now() < recoveryUntil ? "recovered" : "ready",
        );
      } catch (error) {
        if (active && error.status !== 401) {
          hadError = true;
          setSyncStatus("error");
        }
      }
    }

    const stop =
      accountId === null
        ? null
        : startAutoRefresh(refreshNotifications);

    return () => {
      active = false;
      mounted.current = false;
      stop?.();
    };
  }, [accountId]);
  function notify(message, type = "info") {
    localSequence.current += 1;

    const notification = {
      id: `local-${Date.now()}-${localSequence.current}`,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };

    setLocalNotifications((current) => [
      notification,
      ...current,
    ]);

    return notification.id;
  }

  async function markRead(id) {
    if (isLocal(id)) {
      setLocalNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, read: true }
            : notification,
        ),
      );

      return true;
    }

    if (
      accountId === null ||
      pendingReadIds.current.has(id)
    ) {
      return false;
    }

    pendingReadIds.current.add(id);
    setReadingIds([...pendingReadIds.current]);
    setReadError("");

    try {
      const updated = await api(
        `/notifications/${id}/read`,
        {
          method: "PATCH",
          body: {},
        },
      );

      if (!mounted.current) return false;

      confirmedReadIds.current.add(updated.id);

      setBackendNotifications((current) =>
        current.map((notification) =>
          notification.id === updated.id
            ? updated
            : notification,
        ),
      );

      return true;
    } catch (error) {
      if (mounted.current && error.status !== 401) {
        setReadError(
          "Could not mark this notification as read. Please try again.",
        );
      }

      return false;
    } finally {
      pendingReadIds.current.delete(id);

      if (mounted.current) {
        setReadingIds([...pendingReadIds.current]);
      }
    }
  }

  function removeNotification(id) {
    if (isLocal(id)) {
      setLocalNotifications((current) =>
        current.filter((notification) => notification.id !== id),
      );
    } else {
      setDismissedIds((current) => new Set([...current, id]));
    }
  }

  function clearNotifications() {
    setLocalNotifications([]);

    setDismissedIds(
      (current) =>
        new Set([
          ...current,
          ...backendNotifications.map((notification) => notification.id),
        ]),
    );
  }

  const notifications = [
    ...localNotifications,
    ...backendNotifications.filter(
      (notification) => !dismissedIds.has(notification.id),
    ),
  ].sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt),
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify,
        addNotification: notify,
        showNotification: notify,
        markRead,
        removeNotification,
        clearNotifications,
        syncStatus,
        readError,
        readingIds,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications must be used inside a NotificationProvider",
    );
  }

  return context;
}