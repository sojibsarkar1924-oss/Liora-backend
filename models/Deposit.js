// models/Deposit.js
const mongoose = require('mongoose');

const DepositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['Bkash', 'Nagad'], // শুধুমাত্র বিকাশ বা নগদ
    required: true
  },
  senderNumber: {
    type: String,
    required: true
  },
  trxId: {
    type: String,
    required: true,
    unique: true // একই TrxID দুইবার ব্যবহার করা যাবে না
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending' // শুরুতে পেন্ডিং থাকবে
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Deposit', DepositSchema);