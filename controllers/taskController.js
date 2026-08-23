// ============================================================
// taskController.js — টাস্ক-ভিত্তিক আয় (memory/oddOneOut/captcha/video)
// ============================================================
// ✅ পুরনো Bronze/Silver/Gold/Platinum/Diamond প্যাকেজ-ভিত্তিক সিস্টেম
// সম্পূর্ণ সরিয়ে ফেলা হলো — সেটা এখনকার "WinWay Premium" single-package
// ডিজাইনের সাথে মেলে না। এখন প্রতিটা নির্দিষ্ট টাস্কের জন্য নির্দিষ্ট
// টাকা, দিনে ঠিক একবার করে করা যাবে:
//   মেমরি ম্যাচ   → ৳৫
//   অড ওয়ান আউট  → ৳৫
//   ক্যাপচা       → ৳৮
//   ভিডিও         → ৳৯
//   মোট সর্বোচ্চ  → ৳২৭ / দিন
// ============================================================

const User    = require('../models/User');
const TaskLog = require('../models/TaskLog');

const TASK_REWARDS = {
  memory:    5,
  oddOneOut: 5,
  captcha:   8,
  video:     9,
};

function getTodayString() {
  return new Date().toISOString().split('T')[0]; // "2026-01-24"
}

// ============================================================
// POST /api/task/do
// Body: { userId, taskKey }  — taskKey ∈ ['memory','oddOneOut','captcha','video']
// ============================================================
exports.doTask = async (req, res) => {
  try {
    const { userId, taskKey } = req.body;

    if (!userId || !taskKey) {
      return res.status(400).json({ success: false, msg: 'userId ও taskKey দিন।' });
    }
    if (!TASK_REWARDS[taskKey]) {
      return res.status(400).json({ success: false, msg: 'ভুল taskKey।' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });
    }
    if (user.status !== 'active') {
      return res.status(400).json({ success: false, msg: 'আপনার একাউন্ট এখনো সক্রিয় হয়নি।' });
    }

    const today  = getTodayString();
    const reward = TASK_REWARDS[taskKey];

    // ✅ আজ এই taskKey ইতিমধ্যে সম্পন্ন হয়েছে কিনা চেক
    const alreadyDone = await TaskLog.findOne({ userId, taskKey, date: today });
    if (alreadyDone) {
      return res.status(400).json({
        success: false,
        msg: 'আজকের জন্য এই টাস্ক ইতিমধ্যে সম্পন্ন হয়েছে।',
        alreadyDone: true,
      });
    }

    // ✅ TaskLog এন্ট্রি তৈরি — unique index থাকায় race condition হলেও
    // দ্বিতীয়বার একই টাস্কের জন্য এখানেই এরর দেবে, ডুপ্লিকেট টাকা যাবে না
    try {
      await TaskLog.create({ userId, taskKey, date: today, amount: reward });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        return res.status(400).json({
          success: false,
          msg: 'আজকের জন্য এই টাস্ক ইতিমধ্যে সম্পন্ন হয়েছে।',
          alreadyDone: true,
        });
      }
      throw dupErr;
    }

    user.balance       += reward;
    user.wallet         = user.balance;
    user.totalEarnings += reward;
    await user.save();

    return res.status(200).json({
      success: true,
      msg: `অভিনন্দন! আপনি ৳${reward} ইনকাম করেছেন।`,
      reward,
      newBalance: user.balance,
    });

  } catch (err) {
    console.error('doTask error:', err.message);
    return res.status(500).json({ success: false, msg: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

// ============================================================
// GET /api/task/status/:userId
// আজকে কোন কোন টাস্ক সম্পন্ন হয়েছে তার তালিকা ফেরত দেয়
// ============================================================
exports.getTaskStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const today = getTodayString();

    const logs = await TaskLog.find({ userId, date: today });
    const doneMap = { memory: false, oddOneOut: false, captcha: false, video: false };
    let todaysTotal = 0;

    logs.forEach((log) => {
      doneMap[log.taskKey] = true;
      todaysTotal += log.amount;
    });

    return res.json({
      success: true,
      done: doneMap,
      todaysTotal,
      maxDaily: Object.values(TASK_REWARDS).reduce((a, b) => a + b, 0), // ৳২৭
      rewards: TASK_REWARDS,
    });

  } catch (err) {
    console.error('getTaskStatus error:', err.message);
    return res.status(500).json({ success: false, msg: 'সার্ভার এরর।' });
  }
};