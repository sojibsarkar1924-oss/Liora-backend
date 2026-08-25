const Payment = require('../models/Payment');
const User    = require('../models/User');

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

    // ── ২. বোনাস প্রদান (সরাসরি রেফারার এবং উপরের ৫ জেনারেশন) ─────────────
    if (user.referredBy) {
      const directReferrer = await User.findOne({ referralCode: user.referredBy });

      if (directReferrer) {
        // ১. সরাসরি রেফারার পাবে ৫০ (রেফার) + ১০ (লেভেল) = মোট ৬০ টাকা
        await User.findByIdAndUpdate(directReferrer._id, {
          $inc: {
            balance:       60,
            wallet:        60,
            totalEarnings: 60,
            referralBonus: 50,
            levelBonus:    10,
            referralCount: 1,
            teamCount:     1
          }
        });

        console.log(`✅ Direct Referrer (${directReferrer.name}) got 60 TK`);

        // ২. উপরের সর্বোচ্চ ৫ জেনারেশন প্রত্যেকে ১০ টাকা টিম বোনাস পাবে
        let currentSeniorCode = directReferrer.referredBy;
        
        for (let gen = 0; gen < 5; gen++) {
          if (!currentSeniorCode) break; // উপরে কেউ না থাকলে লুপ বন্ধ

          const senior = await User.findOne({ referralCode: currentSeniorCode });
          if (!senior) break;

          await User.findByIdAndUpdate(senior._id, {
            $inc: {
              balance:       10,
              wallet:        10,
              totalEarnings: 10,
              teamBonus:     10,
              teamCount:     1
            }
          });

          console.log(`✅ Generation ${gen + 1} Senior (${senior.name}) got 10 TK Team Bonus`);
          
          currentSeniorCode = senior.referredBy; // পরের স্তরের জন্য
        }
      }
    }

    // ── ৩. Payment Status Approved করা ────────────────────────
    await Payment.findByIdAndUpdate(paymentId, {
      $set: { status: 'Approved', approvedAt: new Date() }
    });

    return res.json({
      success: true,
      msg: 'পেমেন্ট সফলভাবে Approve হয়েছে এবং রেফার বোনাস সঠিকভাবে প্রদান করা হয়েছে।',
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
      return res.status(400).json({ success: false, msg: ইতিমধ্যে `${payment.status}।` });
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