const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // ===== মূল তথ্য =====
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone:    { type: String, default: null },

  // ===== রেফারেল =====
  referralCode: { type: String, unique: true, sparse: true },
  referredBy:   { type: String, default: null },

  // ===== টিম =====
  teamCount:     { type: Number, default: 0 },
  referralCount: { type: Number, default: 0 },

  // ===== ব্যালেন্স =====
  balance:       { type: Number, default: 0 },
  wallet:        { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  referralBonus: { type: Number, default: 0 },
  teamBonus:     { type: Number, default: 0 },
  welcomeBonus:  { type: Number, default: 0 },

  // ===== প্যাকেজ =====
  package:      { type: String, default: 'None' },
  packageName:  { type: String, default: 'None' },
  packagePrice: { type: Number, default: 0 },
  taskLimit:    { type: Number, default: 0 },

  // ===== রোল ও স্ট্যাটাস =====
  role:   { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'pending', 'banned'], default: 'pending' },

  // ===== কাজের ট্র্যাকিং =====
  todayTaskCount: { type: Number, default: 0 },
  lastTaskDate:   { type: String, default: '' },

  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// ✅ Unique referral code generate helper
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ✅ FIXED: pre-save hook
// ১. referralCode না থাকলে unique code তৈরি (collision check সহ)
// ২. balance/wallet sync — শুধু নতুন user এর জন্য
UserSchema.pre('save', async function () {

  // ── referralCode generate ──────────────────────────────────
  if (!this.referralCode) {
    let code;
    let exists = true;

    // ✅ FIXED: collision হলে নতুন code তৈরি করো (max 5 চেষ্টা)
    for (let attempt = 0; attempt < 5; attempt++) {
      code  = generateCode();
      // ✅ 'this.constructor' = User model — require loop ছাড়া
      exists = await this.constructor.findOne({ referralCode: code });
      if (!exists) break;
    }

    this.referralCode = code;
  }

  // ── balance/wallet sync ────────────────────────────────────
  // ✅ FIXED: findByIdAndUpdate এ isModified কাজ করে না
  // তাই শুধু নতুন document এর জন্য sync করো
  if (this.isNew) {
    // নতুন user — balance=wallet=0, কিছু করার নেই
    return;
  }

  if (this.isModified('balance')) {
    this.wallet = this.balance;
  } else if (this.isModified('wallet')) {
    this.balance = this.wallet;
  }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);