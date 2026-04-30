// ============================================================
// withdrawController.js — Auto + Manual withdraw (FIXED)
// ============================================================
const Withdraw            = require('../models/Withdraw');
const User                = require('../models/User');
const { sendMoneyToUser } = require('../bkashService');

const MIN_WITHDRAW = 850;

// ১. User — withdraw request
exports.requestWithdraw = async (req, res) => {
  try {
    const { userId, amount, method, number } = req.body;
    if (!userId || !amount || !method || !number)
      return res.status(400).json({ success: false, msg: 'সব তথ্য দিন।' });

    const requestAmount = Number(amount);
    if (isNaN(requestAmount) || requestAmount < MIN_WITHDRAW)
      return res.status(400).json({ success: false, msg: `সর্বনিম্ন ${MIN_WITHDRAW} টাকা।` });

    if (String(number).trim().length < 11)
      return res.status(400).json({ success: false, msg: '১১ ডিজিটের নম্বর দিন।' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });

    const currentBalance = Math.max(Number(user.balance || 0), Number(user.wallet || 0));
    if (currentBalance < requestAmount)
      return res.status(400).json({ success: false, msg: `ব্যালেন্স কম। বর্তমান: ${currentBalance}` });

    const pendingExists = await Withdraw.findOne({ userId, status: 'Pending' });
    if (pendingExists)
      return res.status(400).json({ success: false, msg: 'আগের রিকোয়েস্ট পেন্ডিং আছে।' });

    // ✅ টাকা balance থেকে কেটে নাও (withdraw request করলেই কাটে)
    const newBalance = currentBalance - requestAmount;
    const newWithdraw = new Withdraw({
      userId,
      amount: requestAmount,
      method,
      number: String(number).trim(),
      status: 'Pending',
    });
    await newWithdraw.save();
    await User.findByIdAndUpdate(userId, { $set: { balance: newBalance, wallet: newBalance } });

    return res.json({
      success: true,
      msg: 'রিকোয়েস্ট সফল! এডমিনের অনুমোদনের জন্য অপেক্ষা করুন।',
      newBalance,
    });
  } catch (err) {
    console.error('requestWithdraw error:', err.message);
    return res.status(500).json({ success: false, msg: 'সার্ভার এরর।' });
  }
};

// ২. User — নিজের history
exports.getMyWithdrawals = async (req, res) => {
  try {
    const { userId } = req.params;
    const withdrawals = await Withdraw.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: withdrawals });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
};

// ৩. Admin — সব requests (Pending + Approved + Rejected)
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const requests = await Withdraw.find()
      .populate('userId', 'name email wallet balance')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, msg: 'লোড করা যায়নি।' });
  }
};

// ৪. Admin — AUTO approve (bKash API দিয়ে পাঠায়)
exports.autoApproveWithdrawal = async (req, res) => {
  try {
    const id = req.body.withdrawId || req.body.id;
    if (!id) return res.status(400).json({ success: false, msg: 'id দিন।' });

    const withdraw = await Withdraw.findById(id);
    if (!withdraw) return res.status(404).json({ success: false, msg: 'পাওয়া যায়নি।' });
    if (withdraw.status !== 'Pending') return res.status(400).json({ success: false, msg: 'আগেই প্রসেস হয়েছে।' });

    try {
      // ✅ FIX: Template literal syntax ঠিক করা হয়েছে
      const bkashResult = await sendMoneyToUser({
        receiverMSISDN:        withdraw.number,
        amount:                withdraw.amount,
        reference:             `Withdraw-${withdraw._id}`,   // ✅ FIXED
        merchantInvoiceNumber: `WD-${withdraw._id}`,         // ✅ FIXED
      });

      withdraw.status      = 'Approved';
      withdraw.processedAt = new Date();
      withdraw.bkashTrxID  = bkashResult.trxID;
      await withdraw.save();

      return res.json({
        success:    true,
        msg:        `Auto payment সফল! ${withdraw.amount} BDT → ${withdraw.number}`,
        bkashTrxID: bkashResult.trxID,
        withdraw,
      });
    } catch (bkashError) {
      return res.status(400).json({ success: false, msg: `bKash failed: ${bkashError.message}` });
    }
  } catch (error) {
    console.error('autoApprove error:', error.message);
    return res.status(500).json({ success: false, msg: 'এরর হয়েছে।' });
  }
};

// ৫. Admin — MANUAL approve
// ✅ এই function শুধু status = 'Approved' করে
// ✅ টাকা REFUND করে না (টাকা আগেই requestWithdraw এ কেটেছে)
// ✅ Admin নিজে bKash merchant থেকে পাঠায়, তারপর confirm করে
exports.manualApproveWithdrawal = async (req, res) => {
  try {
    const id = req.body.withdrawId || req.body.id;
    if (!id) return res.status(400).json({ success: false, msg: 'id দিন।' });

    const withdraw = await Withdraw.findById(id);
    if (!withdraw) return res.status(404).json({ success: false, msg: 'পাওয়া যায়নি।' });
    if (withdraw.status !== 'Pending') return res.status(400).json({ success: false, msg: 'আগেই প্রসেস হয়েছে।' });

    // ✅ শুধু status update — টাকা ফেরত দেওয়া হচ্ছে না!
    withdraw.status      = 'Approved';
    withdraw.processedAt = new Date();
    withdraw.manualNote  = 'Admin manually approved via bKash merchant';
    await withdraw.save();

    // ✅ FIX: withdraw object সঠিকভাবে return করা হচ্ছে
    return res.json({
      success: true,
      msg: `Manual approve সফল! ${withdraw.amount} টাকা পাঠানো হয়েছে।`,
      withdraw,
    });
  } catch (error) {
    console.error('manualApprove error:', error.message);
    return res.status(500).json({ success: false, msg: 'এরর হয়েছে।' });
  }
};

// ৬. Admin — Reject (টাকা ফেরত দেয়)
// ✅ শুধু এই function-ই টাকা user এর কাছে return করে
exports.rejectWithdrawal = async (req, res) => {
  try {
    const id = req.body.withdrawId || req.body.id;
    if (!id) return res.status(400).json({ success: false, msg: 'id দিন।' });

    const withdraw = await Withdraw.findById(id);
    if (!withdraw) return res.status(404).json({ success: false, msg: 'পাওয়া যায়নি।' });
    if (withdraw.status !== 'Pending') return res.status(400).json({ success: false, msg: 'আগেই প্রসেস হয়েছে।' });

    // ✅ বাতিল হলে টাকা ফেরত
    await User.findByIdAndUpdate(withdraw.userId, {
      $inc: { balance: withdraw.amount, wallet: withdraw.amount },
    });

    withdraw.status      = 'Rejected';
    withdraw.processedAt = new Date();
    await withdraw.save();

    // ✅ FIX: msg string এর বাইরে withdraw object দেওয়া হচ্ছে
    return res.json({
      success: true,
      msg: `বাতিল হয়েছে। ${withdraw.amount} টাকা ফেরত দেওয়া হয়েছে।`,
      withdraw,
    });
  } catch (error) {
    console.error('rejectWithdrawal error:', error.message);
    return res.status(500).json({ success: false, msg: 'এরর হয়েছে।' });
  }
};

// ৭. backward compat
exports.processWithdrawal = exports.rejectWithdrawal;