import Product from '../models/Product.js';

// Get all products
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new product (Admin only)
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;

    // Check if an image file was uploaded
    let imageUrl = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80';
    if (req.file) {
      // Constructs URL: http://localhost:5000/uploads/image-12345.jpg
      imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    const product = await Product.create({
      name,
      description,
      price: Number(price),
      category: category || 'General',
      stock: Number(stock) || 0,
      imageUrl,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};