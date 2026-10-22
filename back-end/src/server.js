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
    origin: allowedOrigins, // Allows WebSocket handshakes from Vercel
    methods: ['GET', 'POST'],
    credentials: true,
  },
});


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_order_room', (orderId) => {
    console.log(`Socket ${socket.id} joined room: order_${orderId}`);
    socket.join(`order_${orderId}`);
  });

  socket.on('driver_location_ping', ({ orderId, lat, lng }) => {
    console.log(`Location update for order ${orderId}: ${lat}, ${lng}`);
    io.to(`order_${orderId}`).emit('partner_location_stream', {
      lat,
      lng,
      timestamp: new Date(),
    });
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