// ============================================================
// withdrawRoutes.js — Auto + Manual routes
// ============================================================
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/withdrawController');

// User
router.post('/request',              ctrl.requestWithdraw);
router.get('/history/:userId',       ctrl.getMyWithdrawals);

// Admin
router.get('/admin/requests',        ctrl.getPendingWithdrawals);
router.post('/admin/auto-approve',   ctrl.autoApproveWithdrawal);   // ✅ Auto bKash
router.post('/admin/manual-approve', ctrl.manualApproveWithdrawal); // ✅ Manual
router.post('/admin/reject',         ctrl.rejectWithdrawal);
router.post('/admin/action',         ctrl.rejectWithdrawal); // backward compat

module.exports = router;