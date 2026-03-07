const User = require('../models/User');

const TEAM_BONUS_PER_MEMBER = 10;

const distributeTeamBonus = async () => {
  try {
    const users = await User.find({ 
      status: 'active', 
      package: { $ne: 'None' },
      teamCount: { $gt: 0 }
    });

    for (const user of users) {
      const bonus = user.teamCount * TEAM_BONUS_PER_MEMBER;
      await User.findByIdAndUpdate(user._id, {
        $inc: { 
          balance: bonus,
          wallet: bonus,
          teamBonus: bonus,
          totalEarnings: bonus
        }
      });
    }
    console.log(`✅ Team bonus দেওয়া হয়েছে ${users.length} জন কে`);
  } catch (err) {
    console.error('❌ Team bonus error:', err.message);
  }
};

module.exports = { distributeTeamBonus };