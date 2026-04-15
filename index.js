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

const Config = require('./models/Config');

// Maintenance check
app.get('/api/maintenance', async (req, res) => {
  const config = await Config.findOne({ key: 'maintenance' });
  res.json({ maintenance: config?.value || false });
});

// Toggle maintenance
app.get('/api/maintenance/toggle-liora-secret-2026', async (req, res) => {
  const config = await Config.findOne({ key: 'maintenance' });
  const newValue = !(config?.value || false);
  await Config.findOneAndUpdate(
    { key: 'maintenance' },
    { value: newValue },
    { upsert: true }
  );
  res.json({ maintenance: newValue, msg: newValue ? '🔴 App বন্ধ' : '🟢 App চালু' });
});
// Maintenance check - Permanent Force Close
app.get('/api/maintenance', (req, res) => {
  // ডাটাবেস চেক না করে সরাসরি সবসময় true পাঠানো হচ্ছে
  res.json({ maintenance: true }); 
});

// Maintenance c
// ✅ bKash Number Switch System (Database)
const bkashConfigSchema = new mongoose.Schema({
  activeNumber: { type: String, default: '01636257147' }
});
const BkashConfig = mongoose.model('BkashConfig', bkashConfigSchema);

const numbers = ['01636257147', '01812323466'];
app.get('/api/config/reset-number-liora', async (req, res) => {
  await BkashConfig.deleteMany({});
  res.json({ msg: 'Reset done' });
});

app.get('/api/config/switch-number-liora-2026', async (req, res) => {
  let config = await BkashConfig.findOne();
  if (!config) config = await BkashConfig.create({});
  const currentIndex = numbers.indexOf(config.activeNumber);
  const nextNumber = numbers[(currentIndex + 1) % numbers.length];
  config.activeNumber = nextNumber;
  await config.save();
  res.json({ switched: true, now: nextNumber });
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