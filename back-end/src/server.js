import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import Order from './models/Order.js';

dotenv.config();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL, // Populated in production
].filter(Boolean);

const app = express();
const server = http.createServer(app);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow any origin for WebSockets in local/preview/production
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for real-time mobile & cross-origin tracking
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Customer or Admin joining a specific order tracking room
  socket.on('join_order_room', (orderId) => {
    if (!orderId) return;
    const room = `order_${orderId}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('leave_order_room', (orderId) => {
    if (!orderId) return;
    const room = `order_${orderId}`;
    socket.leave(room);
    console.log(`Socket ${socket.id} left room: ${room}`);
  });

  // Admin joining the overarching live fleet room to track all partners
  socket.on('join_admin_room', () => {
    socket.join('admin_fleet_room');
    console.log(`Admin socket ${socket.id} joined admin_fleet_room`);
  });

  socket.on('leave_admin_room', () => {
    socket.leave('admin_fleet_room');
    console.log(`Admin socket ${socket.id} left admin_fleet_room`);
  });

  // Delivery partner broadcasting live location ping
  socket.on('driver_location_ping', async (data) => {
    const { orderId, partnerId, partnerName, lat, lng, speed = 0, heading = 0 } = data || {};
    if (lat === undefined || lng === undefined) return;

    const payload = {
      orderId,
      partnerId,
      partnerName,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed),
      heading: Number(heading),
      timestamp: new Date().toISOString(),
    };

    // 1. Emit to customer tracking room for this specific order
    if (orderId) {
      io.to(`order_${orderId}`).emit('partner_location_stream', payload);
    }

    // 2. Emit to admin fleet room for live portal monitoring
    io.to('admin_fleet_room').emit('partner_location_stream', payload);

    // 3. Persist latest location in MongoDB asynchronously
    try {
      if (partnerId) {
        await User.findByIdAndUpdate(partnerId, {
          currentLocation: {
            lat: Number(lat),
            lng: Number(lng),
            updatedAt: new Date(),
          },
        }).exec();
      }

      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          lastDriverLocation: {
            lat: Number(lat),
            lng: Number(lng),
            speed: Number(speed),
            heading: Number(heading),
            updatedAt: new Date(),
          },
        }).exec();
      }
    } catch (err) {
      console.error('Failed to persist driver location ping:', err.message);
    }
  });

  // Real-time status update broadcast
  socket.on('driver_status_ping', ({ orderId, status, partnerId }) => {
    if (!orderId) return;
    const payload = { orderId, status, partnerId, timestamp: new Date().toISOString() };
    io.to(`order_${orderId}`).emit('order_status_updated', payload);
    io.to('admin_fleet_room').emit('order_status_updated', payload);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy violation'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Mount All APIs
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
  res.status(200).send('Hey there! <br>You are connected to the logistics app api');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server active on http://localhost:${PORT}`);
  });
});



  //  admin "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhZDRmMDViNmM0ZmZkNWYyNzRhNDJmMCIsImlhdCI6MTc5MjM0MDA1OSwiZXhwIjoxNzkyOTQ0ODU5fQ.hyLeXtQb9TI2DIv31sBqigRldnRKcNT7sz1Pjgxlib4"
  //  customer "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhZDRmMGQ0ZjM2N2M1MmVjZmU4MDcxMiIsImlhdCI6MTc5MjM0MDE4MCwiZXhwIjoxNzkyOTQ0OTgwfQ.KCvldOlWeVfIH2GP3oqIAHzJiIUhUnZbO5UDDJNsAkM"
  //  partner "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhZDQ4ZWUzZDk4MDg5MmVkZjNjMWEyZSIsImlhdCI6MTc5MjM0MTA4NywiZXhwIjoxNzkyOTQ1ODg3fQ.OPu_TuJNS7PEPFSerpH1AfGdrG6BISUWV529EdHe0kA"