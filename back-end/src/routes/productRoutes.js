import express from 'express';
import { getProducts, getProductById, createProduct } from '../controllers/productController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { upload } from '../config/upload.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:id', getProductById);

router.post('/', protect, authorize('admin'), upload.single('image'), createProduct);

export default router;