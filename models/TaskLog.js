const mongoose = require('mongoose');

const taskLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // যেমন: "2026-01-24"
    amount: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('TaskLog', taskLogSchema);