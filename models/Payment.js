const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'userId আবশ্যক'],
      index:    true,
    },

    // ✅ প্যাকেজ তথ্য
    packageName: {
      type:     String,
      required: [true, 'packageName আবশ্যক'],
      trim:     true,
      maxlength: [50, 'packageName সর্বোচ্চ ৫০ অক্ষর'],
    },
    packagePrice: {
      type:    Number,
      default: 0,
      min:     [0, 'price ঋণাত্মক হতে পারবে না'],
    },
    taskLimit: {
      type:    Number,
      default: 10,
      min:     [1, 'taskLimit কমপক্ষে ১'],
    },

    // ✅ পেমেন্ট তথ্য
    amount: {
      type:     Number,
      required: [true, 'amount আবশ্যক'],
      min:      [1, 'amount কমপক্ষে ১ টাকা'],
    },
    method: {
      type:    String,
      enum:    {
        values:  ['Bkash', 'Nagad', 'Rocket'],
        message: '{VALUE} supported নয়',
      },
      default: 'Bkash',
    },
    senderNumber: {
      type:      String,
      required:  [true, 'senderNumber আবশ্যক'],
      trim:      true,
      match:     [/^01[3-9]\d{8}$/, 'সঠিক বাংলাদেশি নম্বর দিন'],
    },

    // ✅ trxId — unique, পুরনো transactionId index বাদ দেওয়া হয়েছে
    trxId: {
      type:      String,
      required:  [true, 'Transaction ID আবশ্যক'],
      unique:    true,
      trim:      true,
      uppercase: true,
      minlength: [4,  'TrxID কমপক্ষে ৪ অক্ষর'],
      maxlength: [50, 'TrxID সর্বোচ্চ ৫০ অক্ষর'],
      match:     [/^[A-Z0-9]+$/, 'TrxID শুধুমাত্র অক্ষর ও সংখ্যা'],
    },

    // ✅ Status
    status: {
      type:    String,
      enum:    ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index:   true,
    },

    // ✅ Admin tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectReason: { type: String, default: null },

    // ✅ IP tracking (fraud protection)
    ipAddress: { type: String, default: null },
  },
  {
    timestamps: true, // createdAt ও updatedAt auto
  }
);

// ✅ Compound index: একই user বারবার same trxId দিতে পারবে না
PaymentSchema.index({ userId: 1, trxId: 1 }, { unique: true });
PaymentSchema.index({ status: 1, createdAt: -1 }); // admin panel fast query

module.exports = mongoose.model('Payment', PaymentSchema);