// Track online users
const onlineUsers = new Map(); // userId -> Set of socketIds

const userConnected = (userId, socketId) => {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
};

const userDisconnected = (socketId) => {
  for (const [userId, socketIds] of onlineUsers.entries()) {
    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      onlineUsers.delete(userId);
    }
  }
};

const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

module.exports = {
  userConnected,
  userDisconnected,
  getOnlineUsers,
  isUserOnline
};
