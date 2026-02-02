const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const presence = require('./presence');
const { encrypt, decrypt } = require('../utils/encryption');

let io;

const initialize = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  // Import call handler
  const callHandler = require('./callHandler');

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);
    
    // Track user presence
    presence.userConnected(socket.userId, socket.id);
    io.emit('presence:update', presence.getOnlineUsers());

    // Initialize call handler for this socket
    callHandler(io, socket);

    // Join channel room
    socket.on('channel:join', (channelId) => {
      socket.join(channelId);
      console.log(`User ${socket.userId} joined channel ${channelId}`);
    });

    // Leave channel room
    socket.on('channel:leave', (channelId) => {
      socket.leave(channelId);
    });

    // Handle new message
    socket.on('message:send', async (data) => {
      try {
        const Channel = require('../models/Channel');
        
        // Validate message text
        if (!data.text || data.text.trim().length === 0 || data.text.length > 2000) {
          return socket.emit('error', { message: 'Invalid message' });
        }

        // Check if user is a member of the channel
        const channel = await Channel.findById(data.channelId);
        const isMember = channel?.members.some(m => m.userId.toString() === socket.userId.toString());
        if (!channel || !isMember) {
          return socket.emit('error', { message: 'Unauthorized' });
        }

        // Encrypt message before saving
        const encryptedText = encrypt(data.text.trim());
        
        const message = new Message({
          sender: socket.userId,
          channelId: data.channelId,
          text: encryptedText,
          isEncrypted: true,
          replyTo: data.replyTo || null
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

        // Decrypt for broadcasting
        const broadcastMessage = message.toObject();
        if (broadcastMessage.isEncrypted && broadcastMessage.text) {
          broadcastMessage.text = decrypt(broadcastMessage.text);
        }
        
        // Decrypt replyTo text if exists
        if (broadcastMessage.replyTo && broadcastMessage.replyTo.text) {
          try {
            broadcastMessage.replyTo.text = decrypt(broadcastMessage.replyTo.text);
          } catch (error) {
            console.error('Error decrypting replyTo text:', error);
            broadcastMessage.replyTo.text = '[Encrypted message]';
          }
        }

        io.to(data.channelId).emit('message:new', broadcastMessage);
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', async ({ channelId }) => {
      try {
        const User = require('../models/User');
        const user = await User.findById(socket.userId).select('username');
        if (user) {
          socket.to(channelId).emit('user:typing', { 
            userId: socket.userId, 
            username: user.username,
            channelId 
          });
        }
      } catch (error) {
        console.error('Typing event error:', error);
      }
    });

    socket.on('stop-typing', async ({ channelId }) => {
      try {
        const User = require('../models/User');
        const user = await User.findById(socket.userId).select('username');
        if (user) {
          socket.to(channelId).emit('user:stop-typing', { 
            userId: socket.userId,
            username: user.username,
            channelId 
          });
        }
      } catch (error) {
        console.error('Stop typing event error:', error);
      }
    });

    // Handle message reactions
    socket.on('message:react', async ({ messageId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Find existing reaction with this emoji
        let reaction = message.reactions.find(r => r.emoji === emoji);
        
        if (reaction) {
          // Toggle reaction
          const userIndex = reaction.users.indexOf(socket.userId);
          if (userIndex > -1) {
            // Remove reaction
            reaction.users.splice(userIndex, 1);
            if (reaction.users.length === 0) {
              // Remove empty reaction
              message.reactions = message.reactions.filter(r => r.emoji !== emoji);
            }
          } else {
            // Add reaction
            reaction.users.push(socket.userId);
          }
        } else {
          // Create new reaction
          message.reactions.push({
            emoji,
            users: [socket.userId]
          });
        }

        await message.save();

        // Broadcast to channel
        io.to(message.channelId.toString()).emit('message:reaction-update', {
          messageId,
          reactions: message.reactions
        });
      } catch (error) {
        console.error('Message reaction error:', error);
      }
    });

    // Handle message delivered
    socket.on('message:delivered', async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && !message.deliveredTo.includes(socket.userId)) {
          message.deliveredTo.push(socket.userId);
          await message.save();
          
          // Notify sender
          io.to(message.channelId.toString()).emit('message:delivery-update', {
            messageId,
            deliveredTo: message.deliveredTo
          });
        }
      } catch (error) {
        console.error('Message delivered error:', error);
      }
    });

    // Handle message read
    socket.on('message:read', async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message) {
          // Check if already read by this user
          const alreadyRead = message.readBy.some(
            read => read.userId.toString() === socket.userId
          );
          
          if (!alreadyRead) {
            message.readBy.push({
              userId: socket.userId,
              readAt: new Date()
            });
            await message.save();
            
            // Notify sender
            io.to(message.channelId.toString()).emit('message:read-update', {
              messageId,
              readBy: message.readBy
            });
          }
        }
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Handle thread reply
    socket.on('thread:reply', (reply) => {
      io.to(reply.channelId.toString()).emit('thread:reply', reply);
    });

    // Handle message edit
    socket.on('message:edit', async ({ messageId, text }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.sender.toString() === socket.userId) {
          message.editHistory.push({
            text: message.text,
            editedAt: new Date()
          });
          message.text = text;
          message.editedAt = new Date();
          await message.save();
          
          io.to(message.channelId.toString()).emit('message:edited', message);
        }
      } catch (error) {
        console.error('Message edit error:', error);
      }
    });

    // Handle message pin
    socket.on('message:pin', async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message) {
          message.isPinned = true;
          message.pinnedBy = socket.userId;
          message.pinnedAt = new Date();
          await message.save();
          await message.populate('sender', 'username avatar');
          
          io.to(message.channelId.toString()).emit('message:pinned', message);
        }
      } catch (error) {
        console.error('Message pin error:', error);
      }
    });

    // Handle message unpin
    socket.on('message:unpin', async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message) {
          message.isPinned = false;
          message.pinnedBy = null;
          message.pinnedAt = null;
          await message.save();
          
          io.to(message.channelId.toString()).emit('message:unpinned', { messageId });
        }
      } catch (error) {
        console.error('Message unpin error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
      presence.userDisconnected(socket.id);
      io.emit('presence:update', presence.getOnlineUsers());
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initialize, getIO };
