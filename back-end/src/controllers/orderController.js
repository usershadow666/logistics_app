import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';

const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
  });
};

// 1. Create order in MongoDB & initialize Razorpay order
export const createOrder = async (req, res) => {
  try {
    const { items, totalAmount, deliveryAddress, paymentMethod = 'cod' } = req.body;

    let razorpayOrder = null;

    // Only invoke Razorpay if paying online
    if (paymentMethod === 'razorpay') {
      const rzp = getRazorpayInstance();
      razorpayOrder = await rzp.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
      });
    }

    const newOrder = await Order.create({
      customer: req.user._id,
      items,
      totalAmount,
      deliveryAddress,
      paymentMethod,
      paymentInfo: {
        razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
        status: 'pending', // Both COD and unpaid online orders start as pending
      },
    });

    res.status(201).json({
      order: newOrder,
      razorpayOrder,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Verify Razorpay HMAC signature
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpaySignature } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
      .update(`${order.paymentInfo.razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      order.paymentInfo.status = 'failed';
      await order.save();
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    order.paymentInfo.razorpayPaymentId = razorpayPaymentId;
    order.paymentInfo.status = 'paid';
    await order.save();

    res.status(200).json({ message: 'Payment verified successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Fetch user orders
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('items.product')
      .populate('assignedPartner', 'name phone currentLocation');
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Admin: Assign order to delivery partner
export const assignOrder = async (req, res) => {
  try {
    const { partnerId } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { assignedPartner: partnerId, status: 'processing' },
      { new: true }
    ).populate('assignedPartner', 'name phone');

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Fetch orders assigned specifically to the logged-in delivery partner
export const getPartnerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ assignedPartner: req.user._id })
      .populate('items.product')
      .populate('customer', 'name phone')
      .sort({ updatedAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update order status (picked_up, out_for_delivery, delivered)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOne({
      _id: req.params.id,
      assignedPartner: req.user._id,
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or not assigned to you' });
    }

    order.status = status;
    await order.save();

    res.status(200).json({ message: 'Status updated successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Fetch all orders across all customers (Admin only)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('items.product')
      .populate('customer', 'name phone email')
      .populate('assignedPartner', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};