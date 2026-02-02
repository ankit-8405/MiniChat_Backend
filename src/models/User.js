const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  displayName: {
    type: String,
    trim: true,
    minlength: 2,
    maxlength: 50,
    default: function() {
      return this.username; // Default to username if not set
    }
  },
  // Mobile or Email for OTP authentication
  mobile: {
    type: String,
    sparse: true, // Allows null but enforces uniqueness when present
    trim: true,
    match: /^[0-9]{10}$/ // 10 digit mobile number
  },
  email: {
    type: String,
    sparse: true, // Allows null but enforces uniqueness when present
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ // Basic email validation
  },
  // OTP fields
  otp: {
    type: String,
    select: false // Don't return OTP by default
  },
  otpExpiry: {
    type: Date,
    select: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  avatar: {
    type: String,
    default: null // URL to avatar image
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away'],
    default: 'online'
  },
  statusMessage: {
    type: String,
    maxlength: 100,
    default: ''
  },
  bio: {
    type: String,
    maxlength: 200,
    default: ''
  }
});

// Validate that user has either mobile or email
userSchema.pre('save', function(next) {
  if (!this.mobile && !this.email) {
    return next(new Error('Either mobile or email is required'));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
