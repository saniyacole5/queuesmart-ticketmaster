import { createApp } from './app.js';
const port = Number(process.env.PORT || 3001), minutes = Number(process.env.SESSION_TTL_MINUTES || 60);
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(minutes) || minutes <= 0) throw new Error('Invalid PORT or SESSION_TTL_MINUTES.');
const { app } = createApp({ ttl: minutes * 60000 });
app.listen(port, '127.0.0.1', () => console.log(`QueueSmart API: http://127.0.0.1:${port}/api/health (in-memory, local demo)`));
