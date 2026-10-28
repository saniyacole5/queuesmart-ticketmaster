-- Optional, repeat-safe demo services.
-- This script deliberately does not create user credentials or admin accounts.
USE queuesmart_db;

INSERT INTO services (name, description, expected_duration, priority, is_open)
VALUES
  ('Concert Ticket Queue', 'Queue for available concert tickets.', 12, 'high', TRUE),
  ('Texans Ticket Queue', 'Queue for available Texans tickets.', 20, 'medium', TRUE),
  ('Rockets Ticket Queue', 'Queue for available Rockets tickets.', 3, 'low', FALSE)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO queues (service_id, status)
SELECT s.id, CASE WHEN s.is_open THEN 'open' ELSE 'closed' END
FROM services AS s
WHERE s.name IN ('Concert Ticket Queue','Texans Ticket Queue','Rockets Ticket Queue')
ON DUPLICATE KEY UPDATE id = id;
