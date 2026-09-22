/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState } from "react";
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  function notify(message, type = "info") {
    const newNotification = {
      id: Date.now(),
      message,
      type,
      read: false,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setNotifications((currentNotifications) => [
      newNotification,
      ...currentNotifications,
    ]);
  }

  function markRead(id) {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  }

  function removeNotification(id) {
    setNotifications((currentNotifications) =>
      currentNotifications.filter(
        (notification) => notification.id !== id
      )
    );
  }

  function clearNotifications() {
    setNotifications([]);
  }

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
      "useNotifications must be used inside a NotificationProvider"
    );
  }

  return context;
}