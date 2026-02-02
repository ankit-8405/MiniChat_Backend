const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');
const { messageValidation } = require('../middleware/validation');

router.get('/:channelId', auth, messageValidation.get, messageController.getMessages);
router.post('/', auth, messageValidation.send, messageController.saveMessage);
router.delete('/:messageId', auth, messageController.deleteMessage);
router.put('/:messageId', auth, messageController.editMessage);
router.post('/:messageId/pin', auth, messageController.pinMessage);
router.delete('/:messageId/pin', auth, messageController.unpinMessage);
router.get('/:channelId/pinned', auth, messageController.getPinnedMessages);

// Reaction routes
router.post('/:messageId/react', auth, messageController.addReaction);
router.delete('/:messageId/react', auth, messageController.removeReaction);

module.exports = router;
