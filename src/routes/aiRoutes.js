const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../middleware/auth');

router.post('/summarize', auth, aiController.summarizeConversation);
router.post('/translate', auth, aiController.translateMessage);
router.post('/smart-replies', auth, aiController.getSmartReplies);
router.post('/sentiment', auth, aiController.detectSentiment);

module.exports = router;
