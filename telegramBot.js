const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '8633022184:AAH0wwm6aU7W1zLgRSTtmtRUbEXEyG1nm7w';
const SUPPORT_GROUP = 'https://t.me/+EMlRsLJX1I42YTk1'; // ← আপনার group link দিন

const bot = new TelegramBot(TOKEN, { 
  polling: process.env.RAILWAY_ENVIRONMENT ? true : false 
});

// ✅ /start command
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'বন্ধু';
  bot.sendMessage(msg.chat.id,
    `👋 স্বাগতম ${name}! Liora Support Bot এ আসার জন্য ধন্যবাদ!\n\n` +
    '📌 যা করতে পারবেন:\n' +
    '💰 /payment — পেমেন্ট সমস্যা\n' +
    '📱 /app — অ্যাপ সমস্যা\n' +
    '❓ /help — সাহায্য\n\n' +
    '⏰ সাপোর্ট সময়: সকাল ৯টা — রাত ১০টা'
  );
});

// ✅ /help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '📋 সাহায্যের জন্য:\n\n' +
    '💰 /payment — পেমেন্ট সমস্যা\n' +
    '📱 /app — অ্যাপ সমস্যা\n' +
    `👥 Support Group → ${SUPPORT_GROUP}\n\n` +
    '⏰ সাপোর্ট সময়: সকাল ৯টা — রাত ১০টা'
  );
});

// ✅ /payment command
bot.onText(/\/payment/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '💰 পেমেন্ট সমস্যার জন্য:\n\n' +
    '১. আপনার Transaction ID পাঠান\n' +
    '২. পেমেন্টের screenshot পাঠান\n' +
    '৩. আপনার registered number দিন\n\n' +
    '⏰ ২৪ ঘন্টার মধ্যে সমাধান হবে ✅'
  );
});

// ✅ /app command
bot.onText(/\/app/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '📱 অ্যাপ সমস্যার জন্য:\n\n' +
    '১. সমস্যাটি বিস্তারিত লিখুন\n' +
    '২. আপনার ফোনের model লিখুন\n' +
    '৩. অ্যাপের version লিখুন\n\n' +
    '⏰ শীঘ্রই সমাধান করা হবে ✅'
  );
});

// ✅ যেকোনো text message এর reply
bot.on('message', (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;

  const name = msg.from.first_name || 'বন্ধু';
  bot.sendMessage(msg.chat.id,
    `✅ ধন্যবাদ ${name}! আপনার message পেয়েছি।\n\n`+
    '⏳ আমাদের টিম শীঘ্রই যোগাযোগ করবে।\n\n' +
    '⏰ সাপোর্ট সময়: সকাল ৯টা — রাত ১০টা'
  );
});

// ✅ Error handling
bot.on('polling_error', (error) => {
  console.error('Telegram Bot Error:', error.message);
});

module.exports = bot;