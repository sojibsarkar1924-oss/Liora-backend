const Payment = require('../models/Payment');
const User    = require('../models/User');

// ============================================================
// Team Bonus হিসাব
// ১জন=৳১০, ২জন=৳২০ ... ১০জন+=৳১০০
// ============================================================
const getTeamBonus = (teamCount) => {
  if (teamCount <= 0)  return 0;
  if (teamCount >= 10) return 100;
  return teamCount * 10;
};

// ============================================================
// POST /api/payment/request
// ============================================================
const requestPayment = async (req, res) => {
  try {
    const {
      userId, packageName, packagePrice, packageTasks,
      amount, method, senderNumber, trxId,
    } = req.body;

    if (!userId || !packageName || !amount || !senderNumber || !trxId) {
      return res.status(400).json({ success: false, msg: 'সব তথ্য পূরণ করুন।' });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, msg: 'সঠিক পরিমাণ দিন।' });
    }

    const bdPhone = /^01[3-9]\d{8}$/;
    if (!bdPhone.test(senderNumber)) {
      return res.status(400).json({ success: false, msg: 'সঠিক বিকাশ/নগদ নম্বর দিন।' });
    }

    const trxClean = trxId.trim().toUpperCase();
    if (trxClean.length < 4) {
      return res.status(400).json({ success: false, msg: 'সঠিক Transaction ID দিন।' });
    }

    const existingTrx = await Payment.findOne({ trxId: trxClean });
    if (existingTrx) {
      return res.status(400).json({ success: false, msg: 'এই Transaction ID আগেই ব্যবহার হয়েছে।' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });
    }

    const pendingPayment = await Payment.findOne({ userId, status: 'Pending' });
    if (pendingPayment) {
      return res.status(400).json({
        success: false,
        msg: 'আপনার একটি পেমেন্ট pending আছে। অ্যাডমিন approve করার পর নতুন করুন।',
      });
    }

    const payment = await Payment.create({
      userId,
      packageName:  packageName.trim(),
      packagePrice: Number(packagePrice) || 0,
      taskLimit:    Number(packageTasks)  || 10,
      amount:       Number(amount),
      method:       method || 'Bkash',
      senderNumber: senderNumber.trim(),
      trxId:        trxClean,
      ipAddress:    req.ip || null,
    });

    return res.status(201).json({
      success: true,
      msg:     'পেমেন্ট রিকোয়েস্ট সফলভাবে জমা হয়েছে।',
      payment,
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, msg: 'এই Transaction ID আগেই ব্যবহার হয়েছে।' });
    }
    console.error('requestPayment error:', error);
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা হয়েছে।' });
  }
};

// ============================================================
// GET /api/payment/admin/pending-deposits
// ============================================================
const getPendingDeposits = async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'Pending' })
      .populate('userId', 'name email referralCode referredBy')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: payments });
  } catch (error) {
    console.error('getPendingDeposits error:', error);
    return res.status(500).json({ success: false, msg: 'লোড ব্যর্থ।' });
  }
};

// ============================================================
// POST /api/payment/admin/approve-deposit
// ✅ Approve হলে:
//   ১. User এর package set + active
//   ২. User পাবে package এর ৭.৫% (welcome bonus)
//   ৩. Referrer পাবে package এর ১০% (referral bonus)
//   ৪. Referrer এর teamCount++ → team bonus আপডেট
// ============================================================
const approveDeposit = async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, msg: 'paymentId আবশ্যক।' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, msg: 'পেমেন্ট পাওয়া যায়নি।' });
    }
    if (payment.status !== 'Pending') {
      return res.status(400).json({ success: false, msg: `ইতিমধ্যে ${payment.status}।` });
    }

    const user = await User.findById(payment.userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });
    }

    const packagePrice = Number(payment.packagePrice) || Number(payment.amount) || 0;

    // ── ১. User এর welcome bonus (৭.৫%) ────────────────────
    const welcomeBonus = Math.floor(packagePrice * 0.075);

    await User.findByIdAndUpdate(payment.userId, {
      $set: {
        packageName:  payment.packageName,
        package:      payment.packageName,
        packagePrice: packagePrice,
        taskLimit:    payment.taskLimit,
        isActive:     true,
        status:       'active',
      },
      $inc: {
        balance:       welcomeBonus,
        wallet:        welcomeBonus,
        totalEarnings: welcomeBonus,
        welcomeBonus:  welcomeBonus,
      },
    });

    console.log(`✅ Welcome bonus: ${user.name} → ৳${welcomeBonus} (৭.৫% of ৳${packagePrice})`);

    // ── ২. Referrer এর bonus (১০%) ─────────────────────────
    if (user.referredBy) {
      const referrer = await User.findOne({ referralCode: user.referredBy });

      if (referrer) {
        const referralBonus = Math.floor(packagePrice * 0.10);
        const newTeamCount  = (referrer.teamCount || 0) + 1;
        const teamBonus     = getTeamBonus(newTeamCount);

        // Referrer এর balance আপডেট
        await User.findByIdAndUpdate(referrer._id, {
          $set: { teamCount: newTeamCount, referralCount: newTeamCount },
          $inc: {
            balance:       referralBonus + teamBonus,
            wallet:        referralBonus + teamBonus,
            totalEarnings: referralBonus + teamBonus,
            referralBonus: referralBonus,
            teamBonus:     teamBonus,
          },
        });

        console.log(`✅ Referral bonus: ${referrer.name} → ৳${referralBonus} (১০%) + ৳${teamBonus} (team bonus, ${newTeamCount} members)`);
      }
    }

    // ── ৩. Payment approve ───────────────────────────────────
    await Payment.findByIdAndUpdate(paymentId, {
      $set: { status: 'Approved', approvedAt: new Date() }
    });

    return res.json({
      success: true,
      msg:     `পেমেন্ট Approve হয়েছে। User পেয়েছে ৳${welcomeBonus} welcome bonus।`,
    });

  } catch (error) {
    console.error('approveDeposit error:', error);
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা।' });
  }
};

// ============================================================
// POST /api/payment/admin/reject-deposit
// ============================================================
const rejectDeposit = async (req, res) => {
  try {
    const { paymentId, reason } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, msg: 'paymentId আবশ্যক।' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, msg: 'পেমেন্ট পাওয়া যায়নি।' });
    }
    if (payment.status !== 'Pending') {
      return res.status(400).json({ success: false, msg: `ইতিমধ্যে ${payment.status}।` });
    }

    await Payment.findByIdAndUpdate(paymentId, {
      $set: {
        status:       'Rejected',
        rejectedAt:   new Date(),
        rejectReason: reason || null,
      }
    });

    return res.json({ success: true, msg: 'পেমেন্ট Reject হয়েছে।' });

  } catch (error) {
    console.error('rejectDeposit error:', error);
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা।' });
  }
};

module.exports = {
  requestPayment,
  getPendingDeposits,
  approveDeposit,
  rejectDeposit,
};