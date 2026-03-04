const express = require('express');
const router  = express.Router();
const {
  requestPayment,
  getPendingDeposits,  // ✅ নাম ঠিক করা হয়েছে
  approveDeposit,      // ✅ নাম ঠিক করা হয়েছে
  rejectDeposit,       // ✅ নাম ঠিক করা হয়েছে
} = require('../controllers/paymentController');

// ✅ ইউজার — পেমেন্ট রিকোয়েস্ট
router.post('/request', requestPayment);

// ✅ Admin — Pending list
router.get('/admin/pending-deposits', getPendingDeposits);

// ✅ Admin — Approve
router.post('/admin/approve-deposit', approveDeposit);

// ✅ Admin — Reject
router.post('/admin/reject-deposit', rejectDeposit);

module.exports = router;