const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'liora_secret_key_2024';

// ============================================================
// POST /api/auth/register
// ============================================================
exports.register = async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, msg: 'নাম, ইমেইল ও পাসওয়ার্ড দিন।' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, msg: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ success: false, msg: 'এই ইমেইল দিয়ে আগেই একাউন্ট আছে।' });
    }

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
      if (!referrer) {
        return res.status(400).json({ success: false, msg: 'রেফারেল কোড সঠিক নয়।' });
      }
    }

    const hashed  = await bcrypt.hash(password, 10);
    const newUser = new User({
      name:       name.trim(),
      email:      email.toLowerCase().trim(),
      password:   hashed,
      referredBy: referrer ? referrer.referralCode : null,
      status:     'pending',
    });
    await newUser.save();

    // ✅ Token generate
    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      success: true,
      msg:     'রেজিস্ট্রেশন সফল! এখন প্যাকেজ কিনুন।',
      token,
      user: {
        id:            newUser._id,
        _id:           newUser._id,
        name:          newUser.name,
        email:         newUser.email,
        role:          newUser.role,
        status:        newUser.status,
        balance:       newUser.balance,
        wallet:        newUser.wallet,
        package:       newUser.package,
        packageName:   newUser.packageName,
        packagePrice:  newUser.packagePrice,
        taskLimit:     newUser.taskLimit,
        referralCode:  newUser.referralCode,
        referredBy:    newUser.referredBy,
        teamCount:     newUser.teamCount,
        referralCount: newUser.referralCount,
        todayTaskCount:newUser.todayTaskCount,
        lastTaskDate:  newUser.lastTaskDate,
        welcomeBonus:  newUser.welcomeBonus,
        referralBonus: newUser.referralBonus,
        teamBonus:     newUser.teamBonus,
      },
    });

  } catch (err) {
    console.error('register error:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, msg: 'এই ইমেইল আগেই ব্যবহার হয়েছে।' });
    }
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা হয়েছে।' });
  }
};

// ============================================================
// POST /api/auth/login
// ============================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, msg: 'ইমেইল ও পাসওয়ার্ড দিন।' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ success: false, msg: 'ইমেইল বা পাসওয়ার্ড ভুল।' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, msg: 'ইমেইল বা পাসওয়ার্ড ভুল।' });
    }

    // ✅ Token generate
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      msg:     'লগইন সফল!',
      token,
      user: {
        id:            user._id,
        _id:           user._id,
        name:          user.name,
        email:         user.email,
        role:          user.role,
        status:        user.status,
        balance:       user.balance,
        wallet:        user.wallet,
        package:       user.package,
        packageName:   user.packageName,
        packagePrice:  user.packagePrice,
        taskLimit:     user.taskLimit,
        referralCode:  user.referralCode,
        referredBy:    user.referredBy,
        teamCount:     user.teamCount,
        referralCount: user.referralCount,
        todayTaskCount:user.todayTaskCount,
        lastTaskDate:  user.lastTaskDate,
        welcomeBonus:  user.welcomeBonus,
        referralBonus: user.referralBonus,
        teamBonus:     user.teamBonus,
      },
    });

  } catch (err) {
    console.error('login error:', err.message);
    return res.status(500).json({ success: false, msg: 'সার্ভার সমস্যা হয়েছে।' });
  }
};