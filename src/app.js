const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const channelRoutes = require('./routes/channelRoutes');
const messageRoutes = require('./routes/messageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');
const searchRoutes = require('./routes/searchRoutes');
const threadRoutes = require('./routes/threadRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const aiRoutes = require('./routes/aiRoutes');
const quizRoutes = require('./routes/quizRoutes');
const errorHandler = require('./middleware/error');

const app = express();

// --- DEBUG / HEALTH / BASIC MIDDLEWARE ---
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// simple request logger for debugging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

// health route (test)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'unknown' });
});
// --- END DEBUG ---

// Connect to database
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(mongoSanitize());

// Rate limiting - Relaxed for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for development
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => process.env.NODE_ENV === 'development' // Skip in development
});
app.use('/api/', limiter);

// Auth rate limiting - Relaxed for development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Increased from 5 to 50 for development
  message: 'Too many login attempts, please try again later.',
  skip: (req) => process.env.NODE_ENV === 'development' // Skip in development
});
app.use('/api/auth', authLimiter);

// CORS configuration - Allow all origins in development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost on any port
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow configured CLIENT_URL
    if (origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    
    // In development, allow all
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body parser with size limits
app.use(express.json({ limit: '100kb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/calls', require('./routes/callRoutes'));
app.use('/api/search', searchRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api', inviteRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/quizzes', quizRoutes);

// Error handling
app.use(errorHandler);

module.exports = app;
