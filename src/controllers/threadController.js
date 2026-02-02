const Message = require('../models/Message');
const Channel = require('../models/Channel');

// Get thread messages
exports.getThreadMessages = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const parentMessage = await Message.findById(messageId)
      .populate('sender', 'username avatar');

    if (!parentMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is channel member
    const channel = await Channel.findById(parentMessage.channelId);
    const isMember = channel.members.some(m => m.userId.toString() === userId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'Not a channel member' });
    }

    const replies = await Message.find({ parentMessageId: messageId })
      .sort({ timestamp: 1 })
      .populate('sender', 'username avatar');

    res.json({
      parentMessage,
      replies,
      count: replies.length
    });
  } catch (error) {
    next(error);
  }
};

// Create thread reply
exports.createThreadReply = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    const parentMessage = await Message.findById(messageId);
    if (!parentMessage) {
      return res.status(404).json({ error: 'Parent message not found' });
    }

    // Check if user is channel member
    const channel = await Channel.findById(parentMessage.channelId);
    const isMember = channel.members.some(m => m.userId.toString() === userId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'Not a channel member' });
    }

    const reply = new Message({
      sender: userId,
      channelId: parentMessage.channelId,
      text,
      parentMessageId: messageId
    });

    await reply.save();
    await reply.populate('sender', 'username avatar');

    // Update parent message thread count
    await Message.findByIdAndUpdate(messageId, {
      $push: { threadReplies: reply._id },
      $inc: { threadCount: 1 }
    });

    res.status(201).json(reply);
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
