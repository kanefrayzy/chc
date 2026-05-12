import http from 'node:http';
import { Server } from 'socket.io';
import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

const PORT = Number(process.env.PORT ?? 4001);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const ALLOWED_ORIGINS = [
  process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000',
  process.env.ADMIN_PUBLIC_URL ?? 'http://localhost:3001',
];

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ['websocket', 'polling'],
});

async function setupRedisAdapter(): Promise<void> {
  const pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.ping(), subClient.ping()]);
  io.adapter(createAdapter(pubClient, subClient));
  // eslint-disable-next-line no-console
  console.log('[realtime] Redis adapter connected');
}

io.on('connection', (socket) => {
  // eslint-disable-next-line no-console
  console.log(`[realtime] client connected: ${socket.id}`);
  socket.emit('hello', { ts: Date.now() });

  socket.on('disconnect', () => {
    // eslint-disable-next-line no-console
    console.log(`[realtime] client disconnected: ${socket.id}`);
  });
});

setupRedisAdapter()
  .then(() => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      // eslint-disable-next-line no-console
      console.log(`[realtime] listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[realtime] failed to start:', err);
    process.exit(1);
  });
