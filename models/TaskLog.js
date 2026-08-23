const mongoose = require('mongoose');

const taskLogSchema = new mongoose.Schema({
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // ✅ নতুন: কোন নির্দিষ্ট টাস্ক (মেমরি/অড ওয়ান আউট/ক্যাপচা/ভিডিও) সম্পন্ন হয়েছে তা ট্র্যাক করার জন্য
    taskKey: { type: String, enum: ['memory', 'oddOneOut', 'captcha', 'video'], required: true },
    date:    { type: String, required: true }, // যেমন: "2026-01-24"
    amount:  { type: Number, required: true }
}, { timestamps: true });

// ✅ একই ইউজার একই দিনে একই taskKey দুইবার সম্পন্ন করতে পারবে না —
// এটা database লেভেলেই নিশ্চিত করে দেয়, race condition হলেও ডুপ্লিকেট আটকায়
taskLogSchema.index({ userId: 1, taskKey: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TaskLog', taskLogSchema);