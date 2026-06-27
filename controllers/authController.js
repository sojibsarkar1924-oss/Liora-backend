const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'liora_secret_key_2024';

// ── Response এ কোন কোন field পাঠাবো ─────────────────────────
const buildUserResponse = (user) => ({
  id:            user._id,
  _id:           user._id,
  name:          user.name,
  role:          user.role,
  status:        user.status,
  balance:       user.balance,
  wallet:        user.wallet,
  package:       user.package,
  packageName:   user.packageName,
  packagePrice:  user.packagePrice,
  taskLimit:     user.taskLimit,
  referralCode:  user.referralCode,   // ← login এর জন্য save করতে হবে
  idCode:        user.idCode,         // ← account switch এর জন্য
  referredBy:    user.referredBy,
  teamCount:     user.teamCount,
  referralCount: user.referralCount,
  todayTaskCount:user.todayTaskCount,
  lastTaskDate:  user.lastTaskDate,
  welcomeBonus:  user.welcomeBonus,
  referralBonus: user.referralBonus,
  teamBonus:     user.teamBonus,
  totalEarnings: user.totalEarnings,
});

// ============================================================
// POST /api/auth/register
// Body: { name, password, referralCode (referrer এর code) }
// ✅ Email নেই — referredBy বাধ্যতামূলক
// ============================================================
exports.register = async (req, res) => {
  try {
    const { name, password, referralCode } = req.body;

    // ── Validation ────────────────────────────────────────
    if (!name || !password || !referralCode) {
      return res.status(400).json({
        success: false,
        msg: 'পুরো নাম, পাসওয়ার্ড ও রেফার কোড দিন।',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        msg: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
      });
    }

    // ── Referrer খুঁজুন (বাধ্যতামূলক) ───────────────────
    const referrer = await User.findOne({
      referralCode: referralCode.trim().toUpperCase(),
    });
    if (!referrer) {
      return res.status(400).json({
        success: false,
        msg: 'রেফার কোড সঠিক নয়। সঠিক কোড দিন।',
      });
    }

    // ── নতুন User তৈরি ───────────────────────────────────
    const hashed  = await bcrypt.hash(password, 10);
    const newUser = new User({
      name:       name.trim(),
      password:   hashed,
      referredBy: referrer.referralCode,
      status:     'pending',
      // package, packageName, packagePrice → model এ default আছে
    });
    await newUser.save();

    // ── ✅ Referrer কে সরাসরি ৬০ টাকা বোনাস ────────────
    referrer.balance       += 60;
    referrer.wallet        += 60;
    referrer.referralBonus += 60;
    referrer.totalEarnings += 60;
    referrer.referralCount += 1;
    referrer.teamCount     += 1;
    await referrer.save();

    // ── ✅ উপরের ৬ জেনারেশন প্রত্যেকে ১০ টাকা টিম বোনাস
    // referrer এর উপরে ৬ স্তর পর্যন্ত যাবে, আর নয়
    let current = referrer;
    for (let gen = 0; gen < 6; gen++) {
      if (!current.referredBy) break; // আর উপরে নেই

      const senior = await User.findOne({ referralCode: current.referredBy });
      if (!senior) break;

      senior.balance       += 10;
      senior.wallet        += 10;
      senior.teamBonus     += 10;
      senior.totalEarnings += 10;
      senior.teamCount     += 1;
      await senior.save();

      current = senior; // পরের উপরের স্তরে যাও
    }

    // ── Token generate ────────────────────────────────────
    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      success: true,
      msg:     'রেজিস্ট্রেশন সফল! এখন ৳৪০০ পেমেন্ট করে একাউন্ট সক্রিয় করুন।',
      token,
      user:    buildUserResponse(newUser),
    });

  } catch (err) {
    console.error('register error:', err.message);
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা হয়েছে।' });
  }
};

// ============================================================
// POST /api/auth/login
// Body: { referralCode, password }
// ✅ Email নেই — নিজের referralCode দিয়ে login
// ============================================================
exports.login = async (req, res) => {
  try {
    const { name, password } = req.body;

if (!name || !password) {
  return res.status(400).json({
    success: false,
    msg: 'নাম ও পাসওয়ার্ড দিন।',
  });
}

const user = await User.findOne({
  name: name.trim(),
});
if (!user) {
  return res.status(400).json({
    success: false,
    msg: 'নাম বা পাসওয়ার্ড ভুল।',
  });
}

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        msg: 'রেফার কোড বা পাসওয়ার্ড ভুল।',
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        msg: 'আপনার একাউন্ট নিষিদ্ধ করা হয়েছে।',
      });
    }

    // ── Token generate ────────────────────────────────────
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      msg:     'লগইন সফল!',
      token,
      user:    buildUserResponse(user),
    });

  } catch (err) {
    console.error('login error:', err.message);
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা হয়েছে।' });
  }
};