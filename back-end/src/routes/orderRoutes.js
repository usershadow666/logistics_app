import express from 'express';
import {
  createOrder,
  verifyPayment,
  getMyOrders,
  assignOrder,
  getPartnerOrders,
  updateOrderStatus,
  getAllOrders,
  getOrderById,
} from '../controllers/orderController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/my-orders', protect, getMyOrders);
router.get('/partner-orders', protect, authorize('delivery_partner'), getPartnerOrders);
router.get('/all', protect, authorize('admin'), getAllOrders);
router.get('/', protect, authorize('admin'), getAllOrders);
router.get('/:id', protect, getOrderById);
router.patch('/:id/assign', protect, authorize('admin'), assignOrder);
router.patch('/:id/status', protect, authorize('delivery_partner'), updateOrderStatus);

export default router;