const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Withdraw = require('../models/Withdraw');
const TaskLog  = require('../models/TaskLog');
const User     = require('../models/User');
const Payment  = require('../models/Payment');

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, msg: 'userId সঠিক নয়।' });
    }

    // ১. Withdraw
    const withdraws = await Withdraw.find({ userId }).sort({ createdAt: -1 }).limit(50);
    const withdrawList = withdraws.map(w => ({
      id:     w._id,
      type:   'withdraw',
      label:  w.status === 'Approved' ? 'উইথড্র (সম্পন্ন)' :
              w.status === 'Rejected' ? 'উইথড্র (বাতিল)' : 'উইথড্র রিকোয়েস্ট',
      amount: Number(w.amount) || 0,
      status: w.status,
      color:  'red',
      date:   w.createdAt,
    }));

    // ২. Daily Task
    const taskLogs = await TaskLog.find({ userId }).sort({ createdAt: -1 }).limit(50);
    const taskList = taskLogs.map(t => ({
      id:     t._id,
      type:   'task',
      label:  'ডেইলি বোনাস',
      amount: Number(t.amount) || 0,
      status: 'Success',
      color:  'green',
      date:   t.createdAt,
    }));

    // ৩. Referral ও Team bonus
    const bonusList = [];
    const payments  = await Payment.find({ status: 'Approved' })
      .sort({ approvedAt: -1 }).limit(100);

    for (const payment of payments) {
      const buyer = await User.findById(payment.userId).select('referredBy name');
      if (!buyer) continue;

      const price = Number(payment.packagePrice) || Number(payment.amount) || 0;

      // Referrer এর bonus
      if (buyer.referredBy) {
        const referrer = await User.findOne({ referralCode: buyer.referredBy }).select('_id teamCount');
        
        if (referrer && referrer._id.toString() === userId) {
          // রেফার বোনাস ১০%
          bonusList.push({
            id:     'ref-' + payment._id,
            type:   'referral',
            label:  'রেফার বোনাস',
            amount: Math.floor(price * 0.10),
            status: 'Success',
            color:  'green',
            date:   payment.approvedAt || payment.createdAt,
          });

          // টিম বোনাস
          const teamBonus = Math.min((referrer.teamCount || 1) * 10, 100);
          if (teamBonus > 0) {
            bonusList.push({
              id:     'team-' + payment._id,
              type:   'team',
              label:  'টিম বোনাস',
              amount: teamBonus,
              status: 'Success',
              color:  'green',
              date:   payment.approvedAt || payment.createdAt,
            });
          }
        }
      }

      // Buyer এর welcome bonus ৭.৫%
      if (payment.userId.toString() === userId && buyer.referredBy) {
        const wb = Math.floor(price * 0.075);
        if (wb > 0) {
          bonusList.push({
            id:     'welcome-' + payment._id,
            type:   'referral',
            label:  'ওয়েলকাম বোনাস',
            amount: wb,
            status: 'Success',
            color:  'green',
            date:   payment.approvedAt || payment.createdAt,
          });
        }
      }
    }

    // ৪. সব একসাথে — নতুন আগে
    const all = [...withdrawList, ...taskList, ...bonusList]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json({ success: true, data: all });

  } catch (error) {
    console.error('history error:', error.message);
    return res.status(500).json({ success: false, msg: 'লোড ব্যর্থ।' });
  }
});

module.exports = router;