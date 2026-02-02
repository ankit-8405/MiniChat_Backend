const express = require('express');
const router = express.Router();
const threadController = require('../controllers/threadController');
const auth = require('../middleware/auth');

router.get('/:messageId', auth, threadController.getThreadMessages);
router.post('/:messageId/reply', auth, threadController.createThreadReply);

module.exports = router;
