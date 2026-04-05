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

cron.schedule('0 0 * * *', () => {
  console.log('🕛 Daily team bonus শুরু হচ্ছে...');
  distributeTeamBonus();
});

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('✅ Database Connected!'))
    .catch(err => console.error('❌ DB Error:', err));

// ✅ Maintenance Mode
let maintenanceMode = false;

// Maintenance check API
app.get('/api/maintenance', (req, res) => {
  res.json({ maintenance: maintenanceMode });
});

// Secret toggle URL — শুধু আপনি জানবেন
app.get('/api/maintenance/toggle-liora-secret-2026', (req, res) => {
  maintenanceMode = !maintenanceMode;
  res.json({ maintenance: maintenanceMode, msg: maintenanceMode ? '🔴 Maintenance চালু' : '🟢 App চালু' });
});
// 🔴 Global Maintenance Block
app.use((req, res, next) => {
  if (maintenanceMode && !req.path.includes('maintenance')) {
    return res.status(503).json({ success: false, msg: '🔴 সার্ভার সাময়িক বন্ধ আছে' });
  }
  next();
});
// ✅ bKash Number Switch System
let bkashNumbers = ['01636257147', '01812323466']; // আপনার ২টি নাম্বার দিন
let activeIndex = 0;

// App থেকে active নাম্বার নেবে
app.get('/api/config/active-number', (req, res) => {
  res.json({ number: bkashNumbers[activeIndex] });
});

// Browser থেকে switch করবেন
app.get('/api/config/switch-number-liora-2026', (req, res) => {
  activeIndex = (activeIndex + 1) % bkashNumbers.length;
  res.json({ 
    switched: true, 
    now: bkashNumbers[activeIndex],
    msg: "Number switched successfully"
  });
});
// ✅ Routes
app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/payment',     require('./routes/paymentRoutes'));
app.use('/api/withdraw',    require('./routes/withdrawRoutes'));
app.use('/api/task',        require('./routes/taskRoutes'));
app.use('/api/user',        require('./routes/userRoutes'));
app.use('/api/transaction', require('./routes/transactionRoutes'));
app.use('/api/history',     require('./routes/historyRoutes'));

app.use((req, res) => {
    res.status(404).json({ success: false, msg: 'Route পাওয়া যায়নি।' });
});

app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ success: false, msg: 'সার্ভার এরর।' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});