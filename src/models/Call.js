const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  },
  callType: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'accepted', 'rejected', 'missed', 'ended', 'busy'],
    default: 'initiated'
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  endedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    leftAt: Date
  }]
}, {
  timestamps: true
});

// Calculate duration before saving
callSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('Call', callSchema);
