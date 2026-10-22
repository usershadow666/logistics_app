import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: 'General' },
    imageUrl: { type: String, default: 'https://placehold.co/300x300' },
    stock: { type: Number, default: 50 },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);