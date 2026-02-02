const Call = require('../models/Call');

// Store active calls and user socket mappings
const activeCalls = new Map(); // callId -> { caller, receiver, status }
const userSockets = new Map(); // userId -> socketId

module.exports = (io, socket) => {
  const userId = socket.userId;

  // Register user socket
  userSockets.set(userId.toString(), socket.id);
  console.log(`User ${userId} registered for calls with socket ${socket.id}`);

  // Initiate call
  socket.on('call:initiate', async ({ receiverId, callType, channelId }) => {
    try {
      console.log(`Call initiated: ${userId} -> ${receiverId}, type: ${callType}`);

      // Check if receiver is online
      const receiverSocketId = userSockets.get(receiverId.toString());
      
      if (!receiverSocketId) {
        return socket.emit('call:error', { 
          error: 'User is offline',
          code: 'USER_OFFLINE'
        });
      }

      // Check if receiver is already in a call
      let receiverInCall = false;
      activeCalls.forEach((call) => {
        if (call.caller === receiverId || call.receiver === receiverId) {
          if (call.status === 'ringing' || call.status === 'connected') {
            receiverInCall = true;
          }
        }
      });

      if (receiverInCall) {
        return socket.emit('call:busy', { receiverId });
      }

      // Create call record
      const call = new Call({
        caller: userId,
        receiver: receiverId,
        callType,
        channelId,
        status: 'initiated'
      });

      await call.save();
      await call.populate('caller', 'username avatar');
      await call.populate('receiver', 'username avatar');

      // Store in active calls
      activeCalls.set(call._id.toString(), {
        callId: call._id.toString(),
        caller: userId.toString(),
        receiver: receiverId.toString(),
        callType,
        status: 'ringing',
        callerSocketId: socket.id,
        receiverSocketId
      });

      // Notify caller
      socket.emit('call:initiated', { call });

      // Notify receiver
      io.to(receiverSocketId).emit('call:incoming', { call });

      // Update call status to ringing
      call.status = 'ringing';
      await call.save();

    } catch (error) {
      console.error('Call initiate error:', error);
      socket.emit('call:error', { 
        error: 'Failed to initiate call',
        code: 'INITIATE_FAILED'
      });
    }
  });

  // Accept call
  socket.on('call:accept', async ({ callId }) => {
    try {
      console.log(`Call accepted: ${callId} by ${userId}`);

      const call = await Call.findById(callId);
      if (!call) {
        return socket.emit('call:error', { 
          error: 'Call not found',
          code: 'CALL_NOT_FOUND'
        });
      }

      // Update call status
      call.status = 'accepted';
      call.startTime = new Date();
      await call.save();

      const activeCall = activeCalls.get(callId);
      if (activeCall) {
        activeCall.status = 'connected';

        // Notify both parties
        io.to(activeCall.callerSocketId).emit('call:accepted', { callId });
        io.to(activeCall.receiverSocketId).emit('call:accepted', { callId });
      }

    } catch (error) {
      console.error('Call accept error:', error);
      socket.emit('call:error', { 
        error: 'Failed to accept call',
        code: 'ACCEPT_FAILED'
      });
    }
  });

  // Reject call
  socket.on('call:reject', async ({ callId }) => {
    try {
      console.log(`Call rejected: ${callId} by ${userId}`);

      const call = await Call.findById(callId);
      if (call) {
        call.status = 'rejected';
        call.endTime = new Date();
        call.endedBy = userId;
        await call.save();
      }

      const activeCall = activeCalls.get(callId);
      if (activeCall) {
        // Notify caller
        io.to(activeCall.callerSocketId).emit('call:rejected', { callId });
        
        // Remove from active calls
        activeCalls.delete(callId);
      }

    } catch (error) {
      console.error('Call reject error:', error);
    }
  });

  // WebRTC Signaling - Offer
  socket.on('call:offer', ({ callId, offer }) => {
    console.log(`Call offer received for ${callId}`);
    
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const targetSocketId = socket.id === activeCall.callerSocketId 
        ? activeCall.receiverSocketId 
        : activeCall.callerSocketId;
      
      io.to(targetSocketId).emit('call:offer', { callId, offer });
    }
  });

  // WebRTC Signaling - Answer
  socket.on('call:answer', ({ callId, answer }) => {
    console.log(`Call answer received for ${callId}`);
    
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const targetSocketId = socket.id === activeCall.callerSocketId 
        ? activeCall.receiverSocketId 
        : activeCall.callerSocketId;
      
      io.to(targetSocketId).emit('call:answer', { callId, answer });
    }
  });

  // WebRTC Signaling - ICE Candidate
  socket.on('call:ice-candidate', ({ callId, candidate }) => {
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const targetSocketId = socket.id === activeCall.callerSocketId 
        ? activeCall.receiverSocketId 
        : activeCall.callerSocketId;
      
      io.to(targetSocketId).emit('call:ice-candidate', { callId, candidate });
    }
  });

  // End call
  socket.on('call:end', async ({ callId }) => {
    try {
      console.log(`Call ended: ${callId} by ${userId}`);

      const call = await Call.findById(callId);
      if (call) {
        call.status = 'ended';
        call.endTime = new Date();
        call.endedBy = userId;
        await call.save();
      }

      const activeCall = activeCalls.get(callId);
      if (activeCall) {
        // Notify both parties
        io.to(activeCall.callerSocketId).emit('call:ended', { callId });
        io.to(activeCall.receiverSocketId).emit('call:ended', { callId });
        
        // Remove from active calls
        activeCalls.delete(callId);
      }

    } catch (error) {
      console.error('Call end error:', error);
    }
  });

  // Toggle video
  socket.on('call:toggle-video', ({ callId, enabled }) => {
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const targetSocketId = socket.id === activeCall.callerSocketId 
        ? activeCall.receiverSocketId 
        : activeCall.callerSocketId;
      
      io.to(targetSocketId).emit('call:peer-video-toggle', { enabled, userId });
    }
  });

  // Toggle audio
  socket.on('call:toggle-audio', ({ callId, enabled }) => {
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const targetSocketId = socket.id === activeCall.callerSocketId 
        ? activeCall.receiverSocketId 
        : activeCall.callerSocketId;
      
      io.to(targetSocketId).emit('call:peer-audio-toggle', { enabled, userId });
    }
  });

  // Screen share start
  socket.on('call:screen-share-start', ({ callId }) => {
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const targetSocketId = socket.id === activeCall.callerSocketId 
        ? activeCall.receiverSocketId 
        : activeCall.callerSocketId;
      
      io.to(targetSocketId).emit('call:peer-screen-share-start', { userId });
    }
  });

  // Screen share stop
  socket.on('call:screen-share-stop', ({ callId }) => {
    const activeCall = activeCalls.get(callId);
    if (activeCall) {
      const targetSocketId = socket.id === activeCall.callerSocketId 
        ? activeCall.receiverSocketId 
        : activeCall.callerSocketId;
      
      io.to(targetSocketId).emit('call:peer-screen-share-stop', { userId });
    }
  });

  // Switch call type (video <-> audio)
  socket.on('call:switch-type', async ({ callId, newType }) => {
    try {
      const call = await Call.findById(callId);
      if (call) {
        call.callType = newType;
        await call.save();
      }

      const activeCall = activeCalls.get(callId);
      if (activeCall) {
        activeCall.callType = newType;
        
        const targetSocketId = socket.id === activeCall.callerSocketId 
          ? activeCall.receiverSocketId 
          : activeCall.callerSocketId;
        
        io.to(targetSocketId).emit('call:type-switched', { callId, newType });
      }
    } catch (error) {
      console.error('Call switch type error:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User ${userId} disconnected from calls`);
    
    // Remove user socket mapping
    userSockets.delete(userId.toString());

    // End any active calls
    activeCalls.forEach(async (activeCall, callId) => {
      if (activeCall.callerSocketId === socket.id || activeCall.receiverSocketId === socket.id) {
        try {
          const call = await Call.findById(callId);
          if (call && call.status !== 'ended') {
            call.status = 'ended';
            call.endTime = new Date();
            call.endedBy = userId;
            await call.save();
          }

          // Notify the other party
          const otherSocketId = activeCall.callerSocketId === socket.id 
            ? activeCall.receiverSocketId 
            : activeCall.callerSocketId;
          
          io.to(otherSocketId).emit('call:ended', { callId, reason: 'peer_disconnected' });
          
          activeCalls.delete(callId);
        } catch (error) {
          console.error('Error ending call on disconnect:', error);
        }
      }
    });
  });
};
