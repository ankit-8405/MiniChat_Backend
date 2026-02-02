const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');
const auth = require('../middleware/auth');

router.get('/history', auth, callController.getCallHistory);
router.get('/:callId', auth, callController.getCallById);
router.post('/', auth, callController.createCall);
router.put('/:callId/status', auth, callController.updateCallStatus);

module.exports = router;
