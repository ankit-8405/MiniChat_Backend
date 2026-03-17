const mongoose = require('mongoose');

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
    default: function () {
      return this.username; // Default to username if not set
    }
  },
  // Mobile for OTP authentication
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^[0-9]{10}$/ // 10 digit mobile number
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

userSchema.pre('save', function (next) {
  if (!this.mobile) {
    return next(new Error('Mobile number is required'));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
