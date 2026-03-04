const User = require('../models/User');

const PACKAGE_CONFIG = {
  'Bronze':   { limit: 4,  perTask: 12  },
  'Silver':   { limit: 6,  perTask: 18  },
  'Gold':     { limit: 8,  perTask: 28 },
  'Platinum': { limit: 10, perTask: 46 },
  'Diamond':  { limit: 12, perTask: 80 },
};

const getPackageConfig = (pkgName) => {
  if (!pkgName || pkgName === 'None') return null;
  const key = Object.keys(PACKAGE_CONFIG).find(
    k => k.toLowerCase() === pkgName.toLowerCase()
  );
  return key ? PACKAGE_CONFIG[key] : null;
};

exports.doTask = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, msg: 'userId দিন।' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });

    if (user.status !== 'active') {
      return res.status(400).json({ success: false, msg: 'আপনার একাউন্ট এখনো সক্রিয় হয়নি।' });
    }

    // ✅ FIXED: packageName "None" হলে package ব্যবহার করবে
    const pkgName = (user.packageName && user.packageName !== 'None')
      ? user.packageName
      : user.package;
    const userPkg = getPackageConfig(pkgName);

    if (!userPkg) {
      return res.status(400).json({ success: false, msg: 'কাজ করতে আগে একটি প্যাকেজ কিনুন।' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (user.lastTaskDate !== today) {
      user.todayTaskCount = 0;
      user.lastTaskDate   = today;
    }

    if (user.todayTaskCount >= userPkg.limit) {
      return res.status(400).json({
        success: false,
        msg: `আজকের ${userPkg.limit}টি কাজ শেষ! কাল আবার আসুন।`,
      });
    }

    user.balance        += userPkg.perTask;
    user.todayTaskCount += 1;
    await user.save();

    return res.status(200).json({
      success:    true,
      msg:        `অভিনন্দন! আপনি ৳${userPkg.perTask} ইনকাম করেছেন।`,
      newBalance: user.balance,
      done:       user.todayTaskCount,
      limit:      userPkg.limit,
      remaining:  userPkg.limit - user.todayTaskCount,
    });

  } catch (err) {
    console.error('doTask error:', err.message);
    return res.status(500).json({ success: false, msg: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

exports.getTaskStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, msg: 'ইউজার পাওয়া যায়নি।' });

    // ✅ FIXED: এখানেও একই fix
    const pkgName = (user.packageName && user.packageName !== 'None')
      ? user.packageName
      : user.package;
    const userPkg = getPackageConfig(pkgName);

    const today = new Date().toISOString().split('T')[0];
    const done  = user.lastTaskDate === today ? (user.todayTaskCount || 0) : 0;
    const limit = userPkg?.limit || 0;

    return res.json({
      success:   true,
      done,
      limit,
      remaining: Math.max(0, limit - done),
      perTask:   userPkg?.perTask || 0,
    });

  } catch (err) {
    return res.status(500).json({ success: false, msg: 'সার্ভার এরর।' });
  }
};