import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import Store from './pages/Store';
import AdminDispatch from './pages/AdminDispatch';
import Login from './pages/Login';
import Cart from './pages/Cart';
import Register from './pages/Register';
import PartnerDashboard from './pages/PartnerDashboard';import OrderTrack from './pages/OrderTrack';
import DeliveryDashboard from './pages/DeliveryDashboard';


const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/" />;
};

const PartnerRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === 'delivery_partner' ? children : <Navigate to="/" />;
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-slate-50">
            <Navbar />
            <Routes>
              <Route path="/" element={<Store />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminDispatch />
                </AdminRoute>
              } />
              <Route path="/cart" element={<Cart />} />
              <Route path="/register" element={<Register />} />
              <Route path="/partner" element={<PartnerRoute><PartnerDashboard /></PartnerRoute>} />
              <Route path="/orders/:id/track" element={<OrderTrack />} />
              <Route path="/delivery" element={<DeliveryDashboard />} />
            </Routes>
          </div>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}