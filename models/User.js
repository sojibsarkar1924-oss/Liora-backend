const mongoose = require('mongoose');

// ── ছোট unique code generator ─────────────────────────────────
const generateCode = (prefix = '', length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix;
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const UserSchema = new mongoose.Schema({
  // ===== মূল তথ্য =====
  name:     { type: String, required: true, trim: true },
  password: { type: String, required: true },


  // ===== রেফারেল =====
  // referralCode → নিজের unique code (login এ ব্যবহার হবে)
  referralCode: { type: String, unique: true, sparse: true },
  referredBy:   { type: String, default: null }, // referrer এর referralCode

  // ===== ID কোড (একাধিক একাউন্ট switch এর জন্য) =====
  // ✅ নতুন field — প্রতিটি একাউন্টের জন্য আলাদা
  idCode: { type: String, unique: true, sparse: true },

  // ===== টিম =====
  teamCount:     { type: Number, default: 0 },
  referralCount: { type: Number, default: 0 },

  // ===== লেভেল =====
  // ✅ নতুন: প্রতি সফল সরাসরি রেফারে ১ করে বাড়বে (home.tsx-এর ব্যাজ সিস্টেম ১-৫০ রেঞ্জে ব্যবহার করে)
  level: { type: Number, default: 1, min: 1, max: 50 },

  // ===== ব্যালেন্স =====
  balance:       { type: Number, default: 0 },
  wallet:        { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  referralBonus: { type: Number, default: 0 }, // সরাসরি রেফার বোনাস (৫০ টাকা)
  teamBonus:     { type: Number, default: 0 }, // টিম বোনাস (১০ টাকা × উপরের ৫ জেনারেশন)
  levelBonus:    { type: Number, default: 0 }, // ✅ নতুন: লেভেল বাড়ার বোনাস (১০ টাকা প্রতি লেভেল)
  welcomeBonus:  { type: Number, default: 0 },

  // ===== প্যাকেজ (fixed — শুধু একটি) =====
  // ✅ সব user এর জন্য WinWay Premium @ ৳৪০০
  package:      { type: String, default: 'premium' },
  packageName:  { type: String, default: 'WinWayPremium' },
  packagePrice: { type: Number, default: 400 },
  taskLimit:    { type: Number, default: 10 },

  // ===== রোল ও স্ট্যাটাস =====
  role:   { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'pending', 'banned'], default: 'pending' },

  // ===== কাজের ট্র্যাকিং =====
  todayTaskCount: { type: Number, default: 0 },
  lastTaskDate:   { type: String, default: '' },

  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// ✅ pre-save: referralCode + idCode auto-generate
UserSchema.pre('save', async function () {

  // ── referralCode (login identifier) ───────────────────────
  if (!this.referralCode) {
    let code, exists;
    for (let i = 0; i < 5; i++) {
      code   = generateCode('', 8); // e.g. "AB3X9K7M"
      exists = await this.constructor.findOne({ referralCode: code });
      if (!exists) break;
    }
    this.referralCode = code;
  }

  // ── idCode (account switch identifier) ────────────────────
  // ✅ নতুন: "LR" + 6 digits, e.g. "LR483920"
  if (!this.idCode) {
    let code, exists;
    for (let i = 0; i < 5; i++) {
      code   = 'LR' + Math.floor(100000 + Math.random() * 900000);
      exists = await this.constructor.findOne({ idCode: code });
      if (!exists) break;
    }
    this.idCode = code;
  }

  // ── balance/wallet sync ────────────────────────────────────
  if (this.isNew) return;

  if (this.isModified('balance')) {
    this.wallet = this.balance;
  } else if (this.isModified('wallet')) {
    this.balance = this.wallet;
  }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);