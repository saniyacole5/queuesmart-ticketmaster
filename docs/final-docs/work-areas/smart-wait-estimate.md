# Required smart feature

Improve the queue wait estimate using past activity for the same service. Customers use the estimate to decide whether to join and to see how their wait changes as the line moves.

## Implementation

- Find the median time between recent consecutive **Serve Next** actions for the service, using only intervals where the next customer was already waiting when the previous customer was served. Multiply that time by the number of people ahead.
- Fall back to the configured duration per person when the service has too little usable history.
- Pass the result through the existing `estimatedWait` field so the Join Queue and Queue Status screens use the same calculation.

Start with `backend/src/modules/waitTime.js`, `backend/src/modules/queueView.js`, `backend/src/repositories/queues.repo.js`, and the service views in `backend/src/app.js`.

## Completion checks

- [ ] Tests cover a service with usable history, an idle gap between customers, the configured-duration fallback, and a customer at the front of the line.
- [ ] The estimate updates when the administrator serves someone ahead of the demo customer.
- [ ] The demo explanation identifies what past data is used, how the estimate reaches the customer’s screen, and how it helps the customer.

For rehearsal, seed a service with a typical three-minute pace and a five-minute configured duration. With two people ahead, the estimate should show about six minutes, then about three after one serve.
