// MEMBER 4: database-backed history and notification helpers.

export function createSqlHistory(
    repository,
    clock = () => new Date().toISOString(),
  ) {
    return {
      joined(entry, service, connection) {
        return repository.createHistoryForJoin(
          {
            entryId: entry.id,
            userId: entry.userId,
            serviceId: service.id,
            serviceName: service.name,
            joinedAt: entry.joinedAt,
          },
          connection,
        );
      },

      finish(entry, outcome, connection) {
        return repository.completeHistory(
          {
            entryId: entry.id,
            outcome,
            endedAt: clock(),
          },
          connection,
        );
      },

      list(userId) {
        return repository.listHistoryForUser(userId);
      },
    };
  }

  export function createSqlNotifications(repository) {
    function emit(
      userId,
      entryId,
      event,
      message,
      connection,
    ) {
      return repository.emitNotification(
        { userId, entryId, event, message },
        connection,
      );
    }

    return {
      emit,

      async close(ordered, service, connection) {
        // "Close" means close to being served: positions 1 and 2.
        const sent = [];

        for (const entry of ordered.slice(0, 2)) {
          const notification = await emit(
            entry.userId,
            entry.id,
            'almost-ready',
            `You are close to being served in ${service.name}.`,
            connection,
          );

          sent.push(notification);
        }

        return sent;
      },

      list(userId) {
        return repository.listNotificationsForUser(userId);
      },

      markRead(userId, id) {
        return repository.markNotificationRead({ id, userId });
      },
    };
  }

  // Call these helpers inside the queue's existing transaction.
  // The caller controls commit and rollback.
  export function createQueueActivity(history, notifications) {
    function requireTransaction(connection) {
      if (
        !connection ||
        typeof connection.execute !== 'function' ||
        typeof connection.getConnection === 'function'
      ) {
        throw new Error(
          "Queue activity requires the caller's transaction connection.",
        );
      }
    }

    return {
      async joined(
        { entry, service, ordered },
        connection,
      ) {
        requireTransaction(connection);

        const record = await history.joined(
          entry,
          service,
          connection,
        );

        await notifications.emit(
          entry.userId,
          entry.id,
          'joined',
          `You joined ${service.name}.`,
          connection,
        );

        await notifications.close(
          ordered,
          service,
          connection,
        );

        return record;
      },

      async finished(
        { entry, service, outcome, ordered },
        connection,
      ) {
        requireTransaction(connection);

        const record = await history.finish(
          entry,
          outcome,
          connection,
        );

        await notifications.emit(
          entry.userId,
          entry.id,
          outcome,
          `Queue participation in ${service.name}: ${outcome}.`,
          connection,
        );

        await notifications.close(
          ordered,
          service,
          connection,
        );

        return record;
      },
    };
  }
