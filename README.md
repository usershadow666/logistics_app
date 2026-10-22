# 🚚 Unified Logistics — Real-Time Logistics & E-Commerce Platform

Unified Logistics is an end-to-end, multi-role logistics and e-commerce web platform designed for low-latency dispatching, order management, dynamic inventory control, and live GPS delivery tracking. Built with the MERN stack, Socket.io, Leaflet, and Razorpay, Unified Logistics provides dedicated workflows for Customers, Store Administrators, and Delivery Agents.

---

## 🌐 Live Links

- **Frontend Deployment (Vercel):** [https://logistics-app-usershadow666.vercel.app](https://logistics-app-usershadow666.vercel.app)
- **Backend API & Gateway (Render):** [https://logistics-api.onrender.com](https://logistics-api.onrender.com)
- **GitHub Repository:** [https://github.com/usershadow666/logistics_app](https://github.com/usershadow666/logistics_app)
- **Project Demo & Walkthrough Video:** [https://www.youtube.com/watch?v=YOUR_VIDEO_ID](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)

---

## 🛠️ System Architecture & Tech Stack

Unified Logistics follows a decoupled client-server architecture hosted across cloud infrastructure with real-time bidirectional WebSocket channels:

### **Core Stack**
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, React Router 6, React-Leaflet, OpenStreetMap.
- **Backend:** Node.js, Express.js, MongoDB Atlas with Mongoose ODM, Multer for multipart form handling.
- **Real-Time Layer:** Socket.io (room-based bidirectional streaming).
- **Payment Processing:** Razorpay SDK (UPI / Cards / NetBanking Sandbox with HMAC SHA-256 verification).
- **Deployment & Hosting:** Vercel (Frontend SPA with client rewrites), Render (Node.js web service), GitHub (CI/CD).

---

## ✨ Key Features

### 1. 🛡️ Multi-Role Authentication & Access Control
- **Customer:** Browse catalog, add items to cart, checkout via Razorpay UPI, track active packages on an interactive map.
- **Admin (`AdminDispatch`):** Manage product inventory, upload product images (`.jpg`, `.png`, `.webp`), monitor active orders, and assign runsheets to delivery agents.
- **Delivery Partner (`DeliveryDashboard`):** View assigned deliveries, transition order statuses (`picked_up`, `out_for_delivery`, `delivered`), and transmit coordinates.

### 2. 📍 Real-Time Telemetry & Route Simulation
- **Device GPS Streaming:** Uses the browser `navigator.geolocation.watchPosition` API to stream actual coordinates via Socket.io.
- **Auto-Route Step Simulator:** Smoothly interpolates coordinates toward destination waypoints, enabling instant desktop demonstration without field testing.
- **Socket Rooms:** Isolates telemetry to specific order channels (`order_<id>`), preventing global coordinate leakage.

### 3. 💳 Razorpay Sandbox Payment Flow
- Backend creates cryptographic payment orders with currency safeguards (INR converted to paise).
- Webhook/Client HMAC verification ensures transactions cannot be manipulated on the client side.
