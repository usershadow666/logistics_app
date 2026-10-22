import express from 'express';
import {
  createOrder,
  verifyPayment,
  getMyOrders,
  assignOrder,
  getPartnerOrders,
  updateOrderStatus,
  getAllOrders, // <-- 1. Import this
} from '../controllers/orderController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/my-orders', protect, getMyOrders);
router.patch('/:id/assign', protect, authorize('admin'), assignOrder);
router.get('/partner-orders', protect, authorize('delivery_partner'), getPartnerOrders);
router.patch('/:id/status', protect, authorize('delivery_partner'), updateOrderStatus);
router.get('/all',protect,authorize('admin'),getAllOrders);

export default router;