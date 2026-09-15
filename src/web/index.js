const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const express = require('express');
const log = require('../utils/log');

/**
 * Render.com uchun holat sahifalari va health-check.
 *
 * Ilgari bu sahifalar `index.js` ichida ~260 qator shablon satr sifatida
 * turardi va har so'rovda qaytadan yig'ilardi. Endi:
 *  - HTML alohida fayllarda (`pages/*.html`), tahrirlash oson;
 *  - bir marta, bot yoqilganda o'qiladi;
 *  - statik sahifalar o'sha zahoti gzip qilinadi (qo'shimcha paket kerak emas -
 *    Node ning o'z `zlib` i, shuning uchun `compression` bog'liqligi yo'q).
 *
 * Faqat `/` sahifasi dinamik: undagi qiymatlar har so'rovda shablonga
 * qo'yiladi, lekin shablonning o'zi keshdan olinadi.
 */

const PAGES_DIR = path.join(__dirname, 'pages');

function loadPage(name) {
  return fs.readFileSync(path.join(PAGES_DIR, `${name}.html`), 'utf8');
}

/** Statik sahifa: matn + oldindan gzip qilingan nusxa. */
function staticPage(name) {
  const body = loadPage(name);
  return {
    raw: Buffer.from(body, 'utf8'),
    gzip: zlib.gzipSync(body, { level: zlib.constants.Z_BEST_COMPRESSION })
  };
}

function acceptsGzip(req) {
  return /\bgzip\b/.test(req.headers['accept-encoding'] || '');
}

function sendHtml(req, res, page) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  if (page.gzip && acceptsGzip(req)) {
    res.set('Content-Encoding', 'gzip');
    res.set('Vary', 'Accept-Encoding');
    return res.end(page.gzip);
  }
  return res.end(page.raw);
}

function render(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : ''
  );
}

/**
 * Express ilovasini yasaydi.
 * @param {import('discord.js').Client} client
 * @param {{ getSupabaseStatus: Function }} storage
 */
function createWebServer(client, storage) {
  const app = express();

  const statusTemplate = loadPage('status');
  const guide = staticPage('guide');
  const terms = staticPage('terms');
  const privacy = staticPage('privacy');

  const savedBytes =
    (guide.raw.length - guide.gzip.length) +
    (terms.raw.length - terms.gzip.length) +
    (privacy.raw.length - privacy.gzip.length);
  log.debug(`[WEB] Sahifalar keshlandi, gzip bilan ${savedBytes} bayt tejaladi`);

  app.get('/', (req, res) => {
    const sbStatus = storage.getSupabaseStatus();
    const sbBadge = sbStatus.connected
      ? '<span class="badge" style="background: #22c55e; color: #052e16;">● SUPABASE: ULANGAN</span>'
      : '<span class="badge" style="background: #ef4444; color: #ffffff;">○ SUPABASE: ULANMAGAN (Lokal)</span>';

    const html = render(statusTemplate, {
      supabaseBadge: sbBadge,
      botStatus: client.isReady() ? 'Faol (Online)' : 'Ishga tushmoqda...',
      botTag: client.user ? client.user.tag : 'Cleva',
      guildCount: client.guilds?.cache.size || 0,
      supabaseMessage: sbStatus.message,
      inviteUrl: process.env.SERVER_INVITE_URL || 'https://discord.gg/fwVyfrtP4h'
    });

    sendHtml(req, res, { raw: Buffer.from(html, 'utf8') });
  });

  app.get('/guide', (req, res) => sendHtml(req, res, guide));
  app.get('/terms', (req, res) => sendHtml(req, res, terms));
  app.get('/privacy', (req, res) => sendHtml(req, res, privacy));

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      bot: 'Cleva',
      uptime: process.uptime(),
      supabase: storage.getSupabaseStatus()
    });
  });

  return app;
}

module.exports = { createWebServer };
