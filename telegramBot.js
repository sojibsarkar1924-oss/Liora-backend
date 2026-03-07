const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('আপনার_TOKEN_এখানে', { polling: true });

// /start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    '👋 স্বাগতম! Liora Support Bot এ আসার জন্য ধন্যবাদ!\n\n' +
    '🆘 সমস্যা লিখুন — আমরা সাহায্য করব\n' +
    '⏰ সাপোর্ট সময়: সকাল ৯টা — রাত ১০টা'
  );
});

// /help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '📋 সাহায্যের জন্য:\n\n' +
    '💰 Payment সমস্যা → /payment লিখুন\n' +
    '📱 App সমস্যা → /app লিখুন\n' +
    '👥 Support Group → t.me/আপনার_group'
  );
});

// /payment command
bot.onText(/\/payment/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '💰 Payment সমস্যার জন্য:\n\n' +
    'আপনার Transaction ID পাঠান\n' +
    '⏰ ২৪ ঘন্টার মধ্যে সমাধান হবে'
  );
});

// যেকোনো message এর reply
bot.on('message', (msg) => {
  if (!msg.text.startsWith('/')) {
    bot.sendMessage(msg.chat.id,
      '✅ আপনার message পেয়েছি!\n' +
      '⏳ শীঘ্রই আমরা যোগাযোগ করব।'
    );
  }
});

module.exports = bot;