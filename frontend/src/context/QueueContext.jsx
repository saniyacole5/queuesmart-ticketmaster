/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState } from "react";
import {
  services as initialServices,
  queueEntries as initialQueueEntries,
} from "../data/mockData";

const QueueContext = createContext(null);

export function QueueProvider({ children }) {
  const [services, setServices] = useState(initialServices);
  const [queueEntries, setQueueEntries] = useState(initialQueueEntries);

  function entriesForService(serviceId) {
    return queueEntries.filter((entry) => entry.serviceId === serviceId);
  }

  function queueLength(serviceId) {
    return entriesForService(serviceId).length;
  }

  function saveService(service) {
    setServices((currentServices) =>
      currentServices.some((item) => item.id === service.id)
        ? currentServices.map((item) =>
            item.id === service.id ? service : item
          )
        : [...currentServices, service]
    );
  }

  function toggleQueueOpen(serviceId) {
    setServices((currentServices) =>
      currentServices.map((service) =>
        service.id === serviceId
          ? { ...service, isOpen: !service.isOpen }
          : service
      )
    );
  }

  function serveNext(serviceId) {
    const next = entriesForService(serviceId)[0];

    if (!next) return null;

    setQueueEntries((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== next.id)
    );

    return next;
  }

  function removeEntry(entryId) {
    setQueueEntries((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== entryId)
    );
  }

  // Swaps an entry with its neighbour inside the same service, leaving the
  // interleaved entries of other services where they are.
  function moveEntry(entryId, direction) {
    setQueueEntries((currentEntries) => {
      const entry = currentEntries.find((item) => item.id === entryId);

      if (!entry) return currentEntries;

      const sameService = currentEntries.filter(
        (item) => item.serviceId === entry.serviceId
      );
      const position = sameService.indexOf(entry);
      const target = direction === "up" ? position - 1 : position + 1;

      if (target < 0 || target >= sameService.length) return currentEntries;

      const neighbour = sameService[target];

      return currentEntries.map((item) => {
        if (item.id === entry.id) return neighbour;
        if (item.id === neighbour.id) return entry;
        return item;
      });
    });
  }

  return (
    <QueueContext.Provider
      value={{
        services,
        queueEntries,
        entriesForService,
        queueLength,
        saveService,
        toggleQueueOpen,
        serveNext,
        removeEntry,
        moveEntry,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueues() {
  const context = useContext(QueueContext);

  if (!context) {
    throw new Error("useQueues must be used inside a QueueProvider");
  }

  return context;
}
