const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  text: {
    type: mongoose.Schema.Types.Mixed, // Can be string or encrypted object
    default: ''
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file'],
    default: 'text'
  },
  fileUrl: {
    type: String
  },
  fileName: {
    type: String
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  deliveredTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Reply to message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Thread support
  parentMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  threadReplies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  threadCount: {
    type: Number,
    default: 0
  },
  // Edit support
  editedAt: {
    type: Date
  },
  editHistory: [{
    text: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Pinned message
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pinnedAt: {
    type: Date
  }
});

messageSchema.index({ channelId: 1, timestamp: -1 });
messageSchema.index({ channelId: 1, isPinned: 1 });
messageSchema.index({ parentMessageId: 1 });

module.exports = mongoose.model('Message', messageSchema);
