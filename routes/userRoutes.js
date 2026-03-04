const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const TaskLog = require('../models/TaskLog');

// ✅ Profile GET
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });
        }

        const teamSize = await User.countDocuments({ referredBy: user.referralCode });

        return res.json({
            success: true,
            user: {
                _id:           user._id,
                id:            user._id,
                name:          user.name,
                email:         user.email,
                phone:         user.phone        || null,
                role:          user.role         || 'user',
                status:        user.status       || 'active',
                balance:       user.balance      || 0,
                wallet:        user.balance      || 0,
                totalEarnings: user.totalEarnings || 0,
                referralCode:  user.referralCode,
                referredBy:    user.referredBy   || null,
                referralCount: teamSize,
                teamCount:     teamSize,
                package:       user.package      || 'None',
                taskLimit:     user.taskLimit    || 10,
                createdAt:     user.createdAt,
            }
        });
    } catch (err) {
        console.error('Profile error:', err);
        return res.status(500).json({ success: false, msg: 'সার্ভার এরর।' });
    }
});


// ✅ সব ইনকাম এবং উইথড্র একসাথে পাওয়ার রাউ

router.get('/transactions/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // ১. উইথড্র ডাটা আনা
        const withdraws = await Withdraw.find({ userId }).lean();
        const formattedWithdraws = withdraws.map(w => ({
            ...w,
            title: 'Withdraw',
            type: 'Debit',
            amount: w.amount,
            createdAt: w.createdAt
        }));

        // ২. টাস্ক ইনকাম ডাটা আনা
        const tasks = await TaskLog.find({ userId }).lean();
        const formattedTasks = tasks.map(t => ({
            ...t,
            title: 'Task Income',
            type: 'Credit',
            amount: t.amount,
            status: 'Success',
            createdAt: t.createdAt || new Date(t.date)
        }));

        // ৩. সব ডাটা এক করে তারিখ অনুযায়ী সাজানো
        let history = [...formattedWithdraws, ...formattedTasks];
        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.json({ success: true, data: history.slice(0, 10) }); // সর্বশেষ ১০টি
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: 'সার্ভার এরর।' });
    }
});
module.exports = router;