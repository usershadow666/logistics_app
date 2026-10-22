import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, default: 'Visakhapatnam' },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ['placed', 'processing', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
    },
    assignedPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paymentInfo: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'cod'],
      default: 'cod',
    },
    paymentInfo: {
      razorpayOrderId: { type: String, default: null },
      razorpayPaymentId: { type: String, default: null },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);