// routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Deposit = require('../models/Deposit');

// ১. পেন্ডিং পেমেন্ট লিস্ট দেখা
router.get('/pending-deposits', async (req, res) => {
  try {
    // যারা পেন্ডিং আছে তাদের খুঁজবে এবং সাথে ইউজারের নাম ও ফোন নম্বর আনবে
    const deposits = await Deposit.find({ status: 'pending' })
      .populate('userId', 'name email phone') 
      .sort({ date: -1 });

    res.json(deposits);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ২. পেমেন্ট অ্যাপ্রুভ করা
router.post('/approve-deposit', async (req, res) => {
  const { depositId } = req.body;

  try {
    // ডিপোজিট খুঁজে বের করা
    const deposit = await Deposit.findById(depositId);
    if (!deposit) return res.status(404).json({ msg: "ডিপোজিট পাওয়া যায়নি" });

    if (deposit.status === 'approved') {
      return res.status(400).json({ msg: "এটি ইতিমধ্যে অ্যাপ্রুভ করা হয়েছে" });
    }

    // ইউজার খুঁজে বের করা
    const user = await User.findById(deposit.userId);
    if (!user) return res.status(404).json({ msg: "ইউজার পাওয়া যায়নি" });

    // --- ব্যালেন্স আপডেট ---
    user.balance += deposit.amount; // ব্যালেন্স যোগ হলো
    user.status = 'active'; // ইউজারের একাউন্ট একটিভ হলো

    // ডিপোজিট স্ট্যাটাস আপডেট
    deposit.status = 'approved';

    // সেভ করা
    await user.save();
    await deposit.save();

    res.json({ msg: "সফল! পেমেন্ট অ্যাপ্রুভ হয়েছে এবং ব্যালেন্স যোগ হয়েছে।" });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;