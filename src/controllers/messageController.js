const Message = require('../models/Message');
const Channel = require('../models/Channel');
const { encrypt, decrypt } = require('../utils/encryption');

exports.getMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.userId;

    // Check if user is a member of the channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = channel.members.some(m => m.userId.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    const messages = await Message.find({ channelId })
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('sender', 'username')
      .populate({
        path: 'replyTo',
        select: 'text sender timestamp',
        populate: {
          path: 'sender',
          select: 'username'
        }
      })
      .exec();

    // Decrypt messages before sending
    const decryptedMessages = messages.map(msg => {
      const msgObj = msg.toObject();
      
      // Decrypt main message text
      if (msgObj.isEncrypted && msgObj.text) {
        msgObj.text = decrypt(msgObj.text);
      }
      
      // Decrypt replyTo message text if exists
      if (msgObj.replyTo && msgObj.replyTo.text) {
        try {
          msgObj.replyTo.text = decrypt(msgObj.replyTo.text);
        } catch (error) {
          console.error('Error decrypting replyTo text:', error);
          msgObj.replyTo.text = '[Encrypted message]';
        }
      }
      
      return msgObj;
    });

    const count = await Message.countDocuments({ channelId });

    res.json({
      messages: decryptedMessages.reverse(),
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    next(error);
  }
};

exports.saveMessage = async (req, res, next) => {
  try {
    const { channelId, text, replyTo } = req.body;
    const userId = req.userId;

    // Check if user is a member of the channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = channel.members.some(m => m.userId.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    // Encrypt message text before saving
    const encryptedText = text ? encrypt(text) : '';
    
    const message = new Message({
      sender: userId,
      channelId,
      text: encryptedText,
      isEncrypted: true,
      replyTo: replyTo || null
    });

    await message.save();
    await message.populate('sender', 'username');
    
    // Populate replyTo if exists
    if (message.replyTo) {
      await message.populate({
        path: 'replyTo',
        select: 'text sender timestamp',
        populate: {
          path: 'sender',
          select: 'username'
        }
      });
    }

    // Decrypt for response
    const responseMessage = message.toObject();
    if (responseMessage.isEncrypted && responseMessage.text) {
      responseMessage.text = decrypt(responseMessage.text);
    }
    
    // Decrypt replyTo text if exists
    if (responseMessage.replyTo && responseMessage.replyTo.text) {
      responseMessage.replyTo.text = decrypt(responseMessage.replyTo.text);
    }

    res.status(201).json(responseMessage);
  } catch (error) {
    next(error);
  }
};


exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    // Find the message
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check permissions
    const channel = await Channel.findById(message.channelId);
    const member = channel.members.find(m => m.userId.toString() === userId);
    
    const canDelete = message.sender.toString() === userId || 
                     ['owner', 'admin', 'moderator'].includes(member?.role);

    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this message' });
    }

    // Delete the message
    await Message.findByIdAndDelete(messageId);

    // Emit socket event to notify others
    const io = require('../sockets/socketManager').getIO();
    io.to(message.channelId.toString()).emit('message:deleted', { messageId });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Edit message
exports.editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can edit
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    // Save to edit history
    message.editHistory.push({
      text: message.text,
      editedAt: new Date()
    });

    message.text = text;
    message.editedAt = new Date();
    await message.save();
    await message.populate('sender', 'username avatar');

    // Emit socket event
    const io = require('../sockets/socketManager').getIO();
    io.to(message.channelId.toString()).emit('message:edited', message);

    res.json(message);
  } catch (error) {
    next(error);
  }
};

// Pin message
exports.pinMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check permissions
    const channel = await Channel.findById(message.channelId);
    const member = channel.members.find(m => m.userId.toString() === userId);
    
    if (!['owner', 'admin', 'moderator'].includes(member?.role)) {
      return res.status(403).json({ error: 'Only admins can pin messages' });
    }

    message.isPinned = true;
    message.pinnedBy = userId;
    message.pinnedAt = new Date();
    await message.save();
    await message.populate('sender', 'username avatar');

    // Emit socket event
    const io = require('../sockets/socketManager').getIO();
    io.to(message.channelId.toString()).emit('message:pinned', message);

    res.json(message);
  } catch (error) {
    next(error);
  }
};

// Unpin message
exports.unpinMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check permissions
    const channel = await Channel.findById(message.channelId);
    const member = channel.members.find(m => m.userId.toString() === userId);
    
    if (!['owner', 'admin', 'moderator'].includes(member?.role)) {
      return res.status(403).json({ error: 'Only admins can unpin messages' });
    }

    message.isPinned = false;
    message.pinnedBy = null;
    message.pinnedAt = null;
    await message.save();

    // Emit socket event
    const io = require('../sockets/socketManager').getIO();
    io.to(message.channelId.toString()).emit('message:unpinned', { messageId });

    res.json({ message: 'Message unpinned successfully' });
  } catch (error) {
    next(error);
  }
};

// Get pinned messages
exports.getPinnedMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    // Check if user is channel member
    const channel = await Channel.findById(channelId);
    const isMember = channel.members.some(m => m.userId.toString() === userId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'Not a channel member' });
    }

    const pinnedMessages = await Message.find({ 
      channelId, 
      isPinned: true 
    })
      .sort({ pinnedAt: -1 })
      .populate('sender', 'username avatar')
      .populate('pinnedBy', 'username');

    res.json({ pinnedMessages });
  } catch (error) {
    next(error);
  }
};


// Add reaction to message
exports.addReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.emoji === emoji && r.userId.toString() === userId.toString()
    );

    if (existingReaction) {
      return res.status(400).json({ error: 'You already reacted with this emoji' });
    }

    // Instagram-style: Remove any other reaction from this user first
    // This ensures one reaction per user
    message.reactions = message.reactions.filter(
      r => r.userId.toString() !== userId.toString()
    );

    // Add new reaction
    message.reactions.push({
      emoji,
      userId,
      createdAt: new Date()
    });

    await message.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(message.channelId.toString()).emit('message:reaction', {
        messageId: message._id,
        reactions: message.reactions
      });
    }

    res.json({ message: 'Reaction added', reactions: message.reactions });
  } catch (error) {
    next(error);
  }
};

// Remove reaction from message
exports.removeReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Remove reaction
    message.reactions = message.reactions.filter(
      r => !(r.emoji === emoji && r.userId.toString() === userId.toString())
    );

    await message.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(message.channelId.toString()).emit('message:reaction', {
        messageId: message._id,
        reactions: message.reactions
      });
    }

    res.json({ message: 'Reaction removed', reactions: message.reactions });
  } catch (error) {
    next(error);
  }
};
