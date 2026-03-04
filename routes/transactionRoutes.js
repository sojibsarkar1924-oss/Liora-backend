const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Withdraw = require('../models/Withdraw');
const Payment  = require('../models/Payment');
const TaskLog  = require('../models/TaskLog'); // ✅ TaskLog.js আছে তাই সরাসরি require

// GET /api/transaction/history/:userId
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, msg: 'সঠিক userId দিন।' });
    }

    const objId = new mongoose.Types.ObjectId(userId);

    const [withdraws, tasks, payments] = await Promise.allSettled([
      Withdraw.find({ userId: objId }).sort({ createdAt: -1 }).limit(50).lean(),
      TaskLog.find({ userId: objId }).sort({ createdAt: -1 }).limit(50).lean(),
      Payment.find({ userId: objId, status: 'Approved' }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const transactions = [];

    // Withdraw
    const wdList = withdraws.status === 'fulfilled' ? withdraws.value : [];
    wdList.forEach((w) => {
      transactions.push({
        _id:    w._id,
        type:   'withdraw',
        label:  w.status === 'Rejected' ? 'উইথড্র (বাতিল)' : 'উইথড্র রিকোয়েস্ট',
        amount: Number(w.amount) || 0,
        status: w.status || 'Pending',
        method: w.method || 'Bkash',
        number: w.number || '-',
        date:   w.createdAt || w.date,
      });
    });

    // Daily Task Bonus
    const taskList = tasks.status === 'fulfilled' ? tasks.value : [];
    taskList.forEach((t) => {
      transactions.push({
        _id:    t._id,
        type:   'task',
        label:  'দৈনিক বোনাস',
        amount: Number(t.amount) || 0,
        status: 'Approved',
        date:   t.createdAt || t.date,
      });
    });

    // Package Payment
    const payList = payments.status === 'fulfilled' ? payments.value : [];
    payList.forEach((p) => {
      transactions.push({
        _id:    p._id,
        type:   'deposit',
        label:  `প্যাকেজ (${p.packageName || 'Membership'})`,
        amount: Number(p.amount) || 0,
        status: p.status,
        date:   p.createdAt,
      });
    });

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({ success: true, transactions });

  } catch (error) {
    console.error('transaction history error:', error);
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা।' });
  }
});

module.exports = router;