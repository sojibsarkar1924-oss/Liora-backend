// ============================================================
// withdrawController.js — Auto + Manual withdraw
// ============================================================
const Withdraw            = require('../models/Withdraw');
const User                = require('../models/User');
const { sendMoneyToUser } = require('../bkashService');

const MIN_WITHDRAW = 400;

// ১. User — withdraw request
exports.requestWithdraw = async (req, res) => {
  try {
    const { userId, amount, method, number } = req.body;
    if (!userId || !amount || !method || !number)
      return res.status(400).json({ success: false, msg: 'সব তথ্য দিন।' });

    const requestAmount = Number(amount);
    if (isNaN(requestAmount) || requestAmount < MIN_WITHDRAW)
      return res.status(400).json({ success: false, msg: `সর্বনিম্ন ${MIN_WITHDRAW} টাকা.` });

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

    const newBalance = currentBalance - requestAmount;
    const newWithdraw = new Withdraw({ userId, amount: requestAmount, method, number: String(number).trim(), status: 'Pending' });
    await newWithdraw.save();
    await User.findByIdAndUpdate(userId, { $set: { balance: newBalance, wallet: newBalance } });

    return res.json({ success: true, msg: 'রিকোয়েস্ট সফল! এডমিনের অনুমোদনের জন্য অপেক্ষা করুন।', newBalance });
  } catch (err) {
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

// ৩. Admin — সব pending
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const requests = await Withdraw.find({ status: 'Pending' })
      .populate('userId', 'name email wallet balance')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, msg: 'লোড করা যায়নি।' });
  }
};

// ৪. Admin — AUTO approve (bKash)
exports.autoApproveWithdrawal = async (req, res) => {
  try {
    const id = req.body.withdrawId || req.body.id;
    if (!id) return res.status(400).json({ success: false, msg: 'id দিন।' });

    const withdraw = await Withdraw.findById(id);
    if (!withdraw) return res.status(404).json({ success: false, msg: 'পাওয়া যায়নি।' });
    if (withdraw.status !== 'Pending') return res.status(400).json({ success: false, msg: 'আগেই প্রসেস হয়েছে।' });

    try {
      const bkashResult = await sendMoneyToUser({
        receiverMSISDN:        withdraw.number,
        amount:                withdraw.amount,
        // ✅ ASCII only — Bengali char নেই
        reference:             Withdraw-`${withdraw._id}`,
        merchantInvoiceNumber: WD-`${withdraw._id}`,
      });

      withdraw.status      = 'Approved';
      withdraw.processedAt = new Date();
      withdraw.bkashTrxID  = bkashResult.trxID;
      await withdraw.save();

      return res.json({
        success: true,
        msg:     `Auto payment OK! ${withdraw.amount} BDT -> ${withdraw.number}`,
        bkashTrxID: bkashResult.trxID,
        withdraw,
      });
    } catch (bkashError) {
      return res.status(400).json({ success: false, msg: `bKash failed: ${bkashError.message}` });
    }
  } catch (error) {
    return res.status(500).json({ success: false, msg: 'এরর হয়েছে।' });
  }
};

// ৫. Admin — MANUAL approve
exports.manualApproveWithdrawal = async (req, res) => {
  try {
    const id = req.body.withdrawId || req.body.id;
    if (!id) return res.status(400).json({ success: false, msg: 'id দিন।' });

    const withdraw = await Withdraw.findById(id);
    if (!withdraw) return res.status(404).json({ success: false, msg: 'পাওয়া যায়নি।' });
    if (withdraw.status !== 'Pending') return res.status(400).json({ success: false, msg: 'আগেই প্রসেস হয়েছে।' });

    withdraw.status      = 'Approved';
    withdraw.processedAt = new Date();
    withdraw.manualNote  = 'Admin manually approved';
    await withdraw.save();

    return res.json({ success: true, msg: `Manual approve সফল! ${withdraw.amount} BDT, withdraw` });
  } catch (error) {
    return res.status(500).json({ success: false, msg: 'এরর হয়েছে।' });
  }
};

// ৬. Admin — Reject
exports.rejectWithdrawal = async (req, res) => {
  try {
    const id = req.body.withdrawId || req.body.id;
    if (!id) return res.status(400).json({ success: false, msg: 'id দিন।' });

    const withdraw = await Withdraw.findById(id);
    if (!withdraw) return res.status(404).json({ success: false, msg: 'পাওয়া যায়নি।' });
    if (withdraw.status !== 'Pending') return res.status(400).json({ success: false, msg: 'আগেই প্রসেস হয়েছে।' });

    // টাকা ফেরত
    await User.findByIdAndUpdate(withdraw.userId, {
      $inc: { balance: withdraw.amount, wallet: withdraw.amount },
    });

    withdraw.status      = 'Rejected';
    withdraw.processedAt = new Date();
    await withdraw.save();

    return res.json({ success: true, msg:`বাতিল। ${withdraw.amount} টাকা ফেরত।, withdraw` });
  } catch (error) {
    return res.status(500).json({ success: false, msg: 'এরর হয়েছে।' });
  }
};

// ৭. পুরনো processWithdrawal (backward compat)
exports.processWithdrawal = exports.rejectWithdrawal;