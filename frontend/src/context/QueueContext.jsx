/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  DATA_CHANGED_EVENT,
  startAutoRefresh,
} from "../api/liveUpdates";

import { api } from "../api/client";

const QueueContext = createContext(null);

export function QueueProvider({ children, account }) {
  const accountId = account?.id ?? null;

  const [data, setData] = useState(() => ({
    services: [],
    queueEntries: [],
    currentQueue: null,
    history: [],
  }));

  const [loading, setLoading] = useState(accountId !== null);
  const [error, setError] = useState("");

  const mounted = useRef(false);
  const requestVersion = useRef(0);

  const refreshState = useCallback(async () => {
    if (accountId === null || !mounted.current) {
      return false;
    }

    const version = ++requestVersion.current;

    try {
      const next = await api("/state");

      if (
        !mounted.current ||
        version !== requestVersion.current
      ) {
        return false;
      }

      setData(next);
      setError("");

      return true;
    } catch (requestError) {
      if (
        mounted.current &&
        version === requestVersion.current &&
        requestError.status !== 401
      ) {
        setError(
          "Could not refresh queue information. Retrying automatically.",
        );
      }

      return false;
    } finally {
      if (
        mounted.current &&
        version === requestVersion.current
      ) {
        setLoading(false);
      }
    }
  }, [accountId]);

  useEffect(() => {
    mounted.current = true;

    const stop =
      accountId === null
        ? null
        : startAutoRefresh(refreshState, {
            listenForChanges: false,
          });

    return () => {
      mounted.current = false;
      requestVersion.current += 1;
      stop?.();
    };
  }, [accountId, refreshState]);

  async function mutate(path, options) {
    // Older refresh responses cannot overwrite this action's refresh.
    requestVersion.current += 1;

    let result;

    try {
      result = await api(path, options);
    } catch (requestError) {
      requestError.fields ??= {};
      throw requestError;
    }

    await refreshState();

    if (mounted.current) {
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    }

    return result;
  }

  const {
    services,
    queueEntries,
    currentQueue,
    history,
  } = data;

  function entriesForService(serviceId) {
    return queueEntries.filter(
      (entry) => entry.serviceId === Number(serviceId),
    );
  }

  function queueLength(serviceId) {
    const service = services.find(
      (item) => item.id === Number(serviceId),
    );

    return service?.queueLength ?? 0;
  }

  function saveService(service) {
    const editing =
      service.id !== undefined && service.id !== null;

    const body = {
      name: service.name,
      description: service.description,
      expectedDuration: service.expectedDuration,
      priority: service.priority,
      isOpen: service.isOpen,
    };

    return mutate(
      editing ? `/services/${service.id}` : "/services",
      {
        method: editing ? "PATCH" : "POST",
        body,
      },
    );
  }

  function toggleQueueOpen(serviceId) {
    const service = services.find(
      (item) => item.id === Number(serviceId),
    );

    if (!service) {
      throw new Error("Service not found. Refresh and try again.");
    }

    return mutate(`/services/${service.id}`, {
      method: "PATCH",
      body: { isOpen: !service.isOpen },
    });
  }

  function joinQueue(serviceId) {
    return mutate(`/services/${serviceId}/queue`, {
      method: "POST",
      body: {},
    });
  }

  function leaveQueue(entryId) {
    return mutate(`/queue-entries/${entryId}`, {
      method: "DELETE",
    });
  }

  function serveNext(serviceId) {
    return mutate(`/services/${serviceId}/serve-next`, {
      method: "POST",
      body: {},
    });
  }

  function removeEntry(entryId) {
    return mutate(`/admin/queue-entries/${entryId}`, {
      method: "DELETE",
    });
  }

  function moveEntry(entryId, direction) {
    return mutate(`/admin/queue-entries/${entryId}/move`, {
      method: "POST",
      body: { direction },
    });
  }

  function setPriority(entryId, priority) {
    return mutate(
      `/admin/queue-entries/${entryId}/priority`,
      {
        method: "PATCH",
        body: { priority },
      },
    );
  }

  return (
    <QueueContext.Provider
      value={{
        services,
        queueEntries,
        currentQueue,
        history,
        loading,
        error,
        refreshState,
        entriesForService,
        queueLength,
        saveService,
        toggleQueueOpen,
        joinQueue,
        leaveQueue,
        serveNext,
        removeEntry,
        moveEntry,
        setPriority,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueues() {
  const context = useContext(QueueContext);

  if (!context) {
    throw new Error(
      "useQueues must be used inside a QueueProvider",
    );
  }

  return context;
}