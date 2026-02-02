const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    });
    console.log('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.error('⚠️  Continuing without database connection...');
    console.error('⚠️  Please check your internet connection and MongoDB Atlas access');
    // Don't exit, let server run without DB for now
    // process.exit(1);
  }
};

module.exports = connectDB;
