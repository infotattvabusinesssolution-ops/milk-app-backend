import { Server } from 'socket.io';
import { env } from './config/env.js';
import { app } from './app.js';
import { connectDb } from './config/db.js';

await connectDb();

const server = app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}`));

const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins for dev
    methods: ["GET", "POST"]
  }
});

// Attach io to the Express app so routes can use it
app.set('io', io);

// Socket.io logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Partner emits location
  socket.on('partner:update_location', (data) => {
    // data = { deliveryId, lat, lng, partnerId }
    // Broadcast this to customers and admins subscribed to this delivery
    io.emit(`delivery:location:${data.deliveryId}`, data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

