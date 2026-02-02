const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const auth = require('../middleware/auth');

router.get('/messages', auth, searchController.searchMessages);

module.exports = router;
