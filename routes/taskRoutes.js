const express = require('express');
const router = express.Router();
const { doTask, getTaskStatus } = require('../controllers/taskController');

// ✅ FIXED: /do route যোগ করা হয়েছে
router.post('/do', doTask);

// ✅ status route
router.get('/status/:userId', getTaskStatus);

module.exports = router;