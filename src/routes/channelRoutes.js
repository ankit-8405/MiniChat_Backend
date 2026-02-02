const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const auth = require('../middleware/auth');
const { channelValidation } = require('../middleware/validation');

router.post('/', auth, channelValidation.create, channelController.createChannel);
router.post('/:channelId/join', auth, channelValidation.join, channelController.joinChannel);
router.get('/', auth, channelController.listChannels);
router.get('/my-channels', auth, channelController.getUserChannels);
router.get('/:channelId', auth, channelController.getChannelDetails);
router.put('/:channelId', auth, channelController.updateChannel);
router.delete('/:channelId', auth, channelController.deleteChannel);
router.delete('/:channelId/leave', auth, channelController.leaveChannel);
router.post('/:channelId/members/:userId/role', auth, channelController.updateMemberRole);
router.delete('/:channelId/members/:userId', auth, channelController.removeMember);

module.exports = router;
