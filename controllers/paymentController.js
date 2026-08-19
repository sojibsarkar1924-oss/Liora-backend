const Payment = require('../models/Payment');
const User    = require('../models/User');

// ============================================================
// Team / Level Bonus হিসাব
// ============================================================
const getTeamBonus = (teamCount) => {
  if (teamCount <= 0) return 0;
  if (teamCount >= 5) return 50;
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
      return res.status(400).json({ success: false, msg: ইতিমধ্যে `${payment.status}।` });
    }

    const user = await User.findById(payment.userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });
    }

    const packagePrice = Number(payment.packagePrice) || Number(payment.amount) || 0;

    // ── ১. User এর Package Active করা ─────────────────────────
    await User.findByIdAndUpdate(payment.userId, {
      $set: {
        packageName:  payment.packageName,
        package:      payment.packageName,
        packagePrice: packagePrice,
        taskLimit:    payment.taskLimit,
        isActive:     true,
        status:       'active',
      },
    });

    // ── ২. ৫-লেভেল আপলাইন সিনিয়রদের বোনাস প্রদান ও লেভেল/ব্যাজ আপডেট ─────────────
    if (user.referredBy) {
      let currentReferralCode = user.referredBy;
      let level = 1;

      // সর্বোচ্চ ৫ লেভেল (সিনিয়র ৫ জন) পর্যন্ত বোনাস যাবে
      while (currentReferralCode && level <= 5) {
        const seniorUser = await User.findOne({ referralCode: currentReferralCode });
        if (!seniorUser) break; // সিনিয়র ইউজার না থাকলে লুপ বন্ধ হবে

        let referralBonus = 0;
        let levelBonus = 10; // প্রতিটি সিনিয়রের জন্য ৳১০ লেভেল বোনাস

        // ১ম লেভেল (সরাসরি রেফারকারী) পাবে অতিরিক্ত ৳৫০ রেফার বোনাস (মোট ৳৬০)
        if (level === 1) {
          referralBonus = 50;
        }

        const totalBonus = referralBonus + levelBonus;
        const isDirectReferrer = (level === 1);

        // আপডেট অবজেক্ট তৈরি
        const updateData = {
          $inc: {
            balance:       totalBonus,
            wallet:        totalBonus,
            totalEarnings: totalBonus,
            referralBonus: referralBonus,
            teamBonus:     levelBonus,
          }
        };

        // শুধু ডিরেক্ট রেফারারের (Level 1) ক্ষেত্রে প্রতি ১ টি রেফারে ১ লেভেল ও ব্যাজ বাড়বে
        if (isDirectReferrer) {
          const currentCount = seniorUser.teamCount || seniorUser.referralCount || 0;
          const newTeamCount = currentCount + 1;

          // ১টি রেফার করলে ১ লেভেল বাড়বে (যেমন: ১টি রেফারে Lv-2, ২টি রেফারে Lv-3)
          const newLevel = newTeamCount + 1;
          const newLevelBadge = `Lv-${newLevel}`;

          updateData.$set = {
            teamCount:     newTeamCount,
            referralCount: newTeamCount,
            level:         newLevel,
            userLevel:     newLevel,
            levelBadge:    newLevelBadge,
          };
        }

        await User.findByIdAndUpdate(seniorUser._id, updateData);

        console.log(`✅ Level ${level} Senior (${seniorUser.name}): Direct Refer: ৳${referralBonus}, Level Bonus: ৳${levelBonus}`);

        // এর পরের লেভেলের সিনিয়রের কাছে যাওয়ার জন্য
        currentReferralCode = seniorUser.referredBy;
        level++;
      }
    }

    // ── ৩. Payment Status Approved করা ────────────────────────
    await Payment.findByIdAndUpdate(paymentId, {
      $set: { status: 'Approved', approvedAt: new Date() }
    });

    return res.json({
      success: true,
      msg: 'পেমেন্ট সফলভাবে Approve হয়েছে, বোনাস প্রদান করা হয়েছে এবং ১ রেফারে ১ লেভেল ও ব্যাজ বৃদ্ধি পেয়েছে।',
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