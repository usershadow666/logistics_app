import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Trash2, ShieldCheck, MapPin, Banknote, CreditCard } from 'lucide-react';

export default function Cart() {
  const { cartItems, removeFromCart, clearCart, totalAmount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'razorpay'
  const [address, setAddress] = useState({
    street: 'Sector 5, MVP Colony',
    city: 'Visakhapatnam',
    lat: 17.7384,
    lng: 83.3364,
  });
  const [processing, setProcessing] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      alert('Please sign in as a customer to place an order.');
      return navigate('/login');
    }

    if (cartItems.length === 0) return;
    setProcessing(true);

    try {
      const payload = {
        items: cartItems.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
          price: item.product.price,
        })),
        totalAmount,
        deliveryAddress: address,
        paymentMethod,
      };

      const res = await axios.post(`${API_BASE_URL}/api/orders`, payload, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const { order, razorpayOrder } = res.data;

      // Handle Cash on Delivery flow
      if (paymentMethod === 'cod') {
        clearCart();
        alert('Order placed successfully with Cash on Delivery!');
        return navigate(`/orders/${order._id}/track`);
      }

      // Handle Online Razorpay flow
      const options = {
        key: 'rzp_test_placeholder',
        amount: razorpayOrder.amount,
        currency: 'INR',
        name: 'TrackFlow Logistics',
        description: `Order #${order._id.slice(-6)} Checkout`,
        order_id: razorpayOrder.id,
        handler: async function (response) {
          try {
            await axios.post(
              `${API_BASE_URL}/api/orders/verify-payment`,
              {
                orderId: order._id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
              { headers: { Authorization: `Bearer ${user.token}` } }
            );

            clearCart();
            alert('Payment completed successfully!');
            navigate(`/orders/${order._id}/track`);
          } catch {
            alert('Payment verification failed');
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || '9999999999',
        },
        theme: { color: '#4f46e5' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failRes) => {
        alert(`Payment Failed: ${failRes.error.description}`);
      });
      rzp.open();
    } catch (err) {
      alert(err.response?.data?.message || 'Error initializing order');
    } finally {
      setProcessing(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Your cart is empty</h2>
        <p className="text-slate-500 mt-2">Add items from the catalog to place a delivery run.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
        >
          Explore Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Review & Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {/* Cart Items */}
          {cartItems.map((item) => (
            <div key={item.product._id} className="bg-white border p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <img src={item.product.imageUrl} alt={item.product.name} className="w-16 h-16 object-cover rounded-lg border" />
                <div>
                  <h3 className="font-semibold text-slate-800">{item.product.name}</h3>
                  <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">₹{item.product.price * item.quantity}</p>
                </div>
              </div>
              <button onClick={() => removeFromCart(item.product._id)} className="text-slate-400 hover:text-rose-500 p-2">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          {/* Delivery Address */}
          <div className="bg-white border p-5 rounded-xl shadow-sm">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-indigo-600" /> Delivery Destination
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs text-slate-500 font-medium">Street Address</label>
                <input
                  type="text"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">City</label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="bg-white border p-5 rounded-xl shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-3">Select Payment Method</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition ${
                  paymentMethod === 'cod' ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600' : 'hover:bg-slate-50'
                }`}
              >
                <Banknote className={`w-5 h-5 ${paymentMethod === 'cod' ? 'text-emerald-600' : 'text-slate-500'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Cash on Delivery</p>
                  <p className="text-xs text-slate-500">Pay cash or UPI upon delivery</p>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('razorpay')}
                className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition ${
                  paymentMethod === 'razorpay' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'hover:bg-slate-50'
                }`}
              >
                <CreditCard className={`w-5 h-5 ${paymentMethod === 'razorpay' ? 'text-indigo-600' : 'text-slate-500'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Online Payment</p>
                  <p className="text-xs text-slate-500">UPI, Cards, NetBanking (Sandbox)</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white border p-6 rounded-xl shadow-sm h-fit space-y-4">
          <h2 className="font-bold text-lg text-slate-800">Order Summary</h2>
          <div className="space-y-2 text-sm text-slate-600 border-b pb-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{totalAmount}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span className="text-emerald-600 font-medium">FREE</span>
            </div>
          </div>
          <div className="flex justify-between font-bold text-base text-slate-900">
            <span>Total Payable</span>
            <span>₹{totalAmount}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={processing}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow transition disabled:opacity-50 text-white ${
              paymentMethod === 'cod' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {processing ? 'Processing...' : paymentMethod === 'cod' ? 'Place COD Order' : 'Pay via Gateway'}
          </button>

          <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure Checkout
          </p>
        </div>
      </div>
    </div>
  );
}