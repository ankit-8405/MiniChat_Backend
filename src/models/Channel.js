const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 200,
    default: ''
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    select: false // Don't return password by default
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'moderator', 'member', 'guest'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Invite links
  inviteLinks: [{
    code: {
      type: String,
      required: true,
      unique: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    expiresAt: {
      type: Date
    },
    maxUses: {
      type: Number,
      default: null
    },
    uses: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

// Hash password before saving
channelSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
channelSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return true; // No password set
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Channel', channelSchema);
