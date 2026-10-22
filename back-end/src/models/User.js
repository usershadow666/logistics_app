import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: ['customer', 'admin', 'delivery_partner'],
      default: 'customer',
    },
    currentLocation: {
      lat: { type: Number, default: 17.7231 },
      lng: { type: Number, default: 83.3013 },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Async pre-save hook without next()
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);