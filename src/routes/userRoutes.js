const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.post('/upload-avatar', userController.uploadAvatar);

// User routes
router.get('/:userId', userController.getUserById);
router.put('/status', userController.updateStatus);

module.exports = router;
