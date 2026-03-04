// ============================================================
// bkashService.js — bKash B2C Send Money
// ✅ FIXED: Bengali characters সরানো হয়েছে
// ============================================================
const axios = require('axios');

const BKASH_BASE_URL  = process.env.BKASH_BASE_URL  || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
const BKASH_APP_KEY   = process.env.BKASH_APP_KEY   || '';
const BKASH_APP_SECRET= process.env.BKASH_APP_SECRET|| '';
const BKASH_USERNAME  = process.env.BKASH_USERNAME  || '';
const BKASH_PASSWORD  = process.env.BKASH_PASSWORD  || '';

// ✅ Token cache
let cachedToken   = null;
let tokenExpiry   = 0;

// ── Token নেওয়া ─────────────────────────────────────────────
const getToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/token/grant`,
    { app_key: BKASH_APP_KEY, app_secret: BKASH_APP_SECRET },
    {
      headers: {
        // ✅ FIXED: শুধু ASCII characters — বাংলা নেই
        username:     BKASH_USERNAME,
        password:     BKASH_PASSWORD,
        'Content-Type': 'application/json',
        Accept:       'application/json',
      },
    }
  );

  if (!res.data?.id_token) throw new Error('bKash token পাওয়া যায়নি');

  cachedToken = res.data.id_token;
  tokenExpiry = Date.now() + (3500 * 1000); // ~58 min
  return cachedToken;
};

// ── B2C Send Money ───────────────────────────────────────────
const sendMoneyToUser = async ({ receiverMSISDN, amount, reference, merchantInvoiceNumber }) => {
  const token = await getToken();

  // ✅ FIXED: amount অবশ্যই string number — Bengali char নেই
  const cleanAmount  = String(Number(amount).toFixed(2)); // "500.00"
  // ✅ FIXED: reference — ASCII only, Bengali char নেই
  const cleanRef     = String(reference).replace(/[^\x00-\x7F]/g, '').trim() || 'Withdraw';
  const cleanInvoice = String(merchantInvoiceNumber).replace(/[^\w\-\?]/g, '').trim() || `ID-${Date.now()}`;

  const res = await axios.post(
    `${BKASH_BASE_URL}/tokenized/checkout/b2c/payment`,
    {
      amount:               cleanAmount,
      currency:             'BDT',
      intent:               'sale',
      merchantInvoiceNumber: cleanInvoice,
      receiverMSISDN:       String(receiverMSISDN).trim(),
      reference:            cleanRef,
    },
    {
      headers: {
        Authorization:  token,
        'X-APP-Key':    BKASH_APP_KEY,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
    }
  );

  if (res.data?.statusCode !== '0000') {
    throw new Error(res.data?.statusMessage || 'bKash payment failed');
  }

  return res.data;
};

module.exports = { sendMoneyToUser };