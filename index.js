const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
require('./telegramBot');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const cron = require('node-cron');
const { distributeTeamBonus } = require('./controllers/teamBonusController');

// প্রতিদিন রাত ১২টায় team bonus দেবে
cron.schedule('0 0 * * *', () => {
  console.log('🕛 Daily team bonus শুরু হচ্ছে...');
  distributeTeamBonus();
});

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('✅ Database Connected!'))
    .catch(err => console.error('❌ DB Error:', err));

// ✅ Routes
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/payment',  require('./routes/paymentRoutes'));
app.use('/api/withdraw', require('./routes/withdrawRoutes'));
app.use('/api/task',     require('./routes/taskRoutes'));
app.use('/api/user',     require('./routes/userRoutes'));  // ← এটা থাকতেই হবে
app.use('/api/transaction', require('./routes/transactionRoutes'));
app.use('/api/history',  require('./routes/historyRoutes')); // ← এটা যোগ করুন

// ✅ 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ success: false, msg: 'Route পাওয়া যায়নি।' });
});

// ✅ Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ success: false, msg: 'সার্ভার এরর।' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});