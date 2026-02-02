const express = require('express');
const router = express.Router();
const inviteController = require('../controllers/inviteController');
const auth = require('../middleware/auth');

router.post('/channel/:channelId/invite', auth, inviteController.createInviteLink);
router.get('/channel/:channelId/invites', auth, inviteController.getInviteLinks);
router.delete('/channel/:channelId/invite/:code', auth, inviteController.deleteInviteLink);
router.post('/invite/:code/join', auth, inviteController.joinViaInvite);

module.exports = router;
