require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Слишком много запросов, подождите минуту' }
});
app.use('/api/', limiter);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

function ensureAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Не авторизован' });
  next();
}

async function sendLog(action, user, details = '') {
  const webhook = process.env.WEBHOOK_LOGS;
  if (!webhook) return;
  const embed = {
    title: '📋 Лог действия',
    color: 0x2c3e2f,
    fields: [
      { name: '⏱ Время', value: new Date().toLocaleString('ru-RU'), inline: true },
      { name: '👤 Пользователь', value: user?.username || 'Неизвестно', inline: true },
      { name: '🆔 Discord ID', value: user?.id || '—', inline: true },
      { name: '📌 Действие', value: action, inline: false },
      { name: '📄 Подробности', value: details || '—', inline: false }
    ],
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  try { await axios.post(webhook, { embeds: [embed] }); } catch (err) {}
}

async function sendToWebhook(url, embed, files = []) {
  if (!url) return;
  try {
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify({ embeds: [embed] }));
    for (const file of files) {
      formData.append('file', fs.createReadStream(file.path), file.originalname);
    }
    await axios.post(url, formData, { headers: formData.getHeaders() });
    for (const file of files) if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch (err) {}
}

// ------------------- Авторизация -------------------
app.get('/auth/discord', passport.authenticate('discord', { scope: ['identify', 'guilds'] }));

app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), async (req, res) => {
  const guilds = req.user.guilds;
  const inGuild = guilds.some(g => g.id === process.env.DISCORD_GUILD_ID);
  if (!inGuild) {
    req.logout(() => {});
    await sendLog('❌ Попытка входа без членства', req.user);
    return res.send('<h2>Доступ запрещён</h2><p>Вы не состоите на сервере LSCSD.</p>');
  }
  await sendLog('✅ Успешный вход', req.user);
  res.redirect('/');
});

app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });
app.get('/api/me', ensureAuth, (req, res) => { res.json({ username: req.user.username, id: req.user.id, avatar: req.user.avatar }); });
app.get('/api/check-membership', ensureAuth, (req, res) => { res.json({ authorized: true }); });

// ------------------- Заявки -------------------

// 1. В отдел (пинг роли отдела)
app.post('/api/apply-department', ensureAuth, async (req, res) => {
  const { firstName, lastName, staticc, rank, department, reason } = req.body;
  if (!firstName || !lastName || !staticc || !rank || !department || !reason)
    return res.status(400).json({ error: 'Заполните все поля' });
  const user = req.user;
  const roleId = process.env[`ROLE_${department.toUpperCase()}`];
  const ping = roleId ? `<@&${roleId}>` : '';
  const embed = {
    title: `📝 Заявка в отдел ${department}`,
    color: 0xc9a03d,
    fields: [
      { name: 'Имя Фамилия', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Статик', value: staticc, inline: true },
      { name: 'Ранг', value: rank, inline: true },
      { name: 'Отдел', value: department, inline: true },
      { name: 'Почему хотите в отдел', value: reason, inline: false },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  if (ping) embed.description = ping;
  const webhookUrl = process.env[`WEBHOOK_${department.toUpperCase()}`];
  if (!webhookUrl) return res.status(500).json({ error: 'Вебхук не настроен' });
  await sendToWebhook(webhookUrl, embed);
  await sendLog('Заявка в отдел', user, `${firstName} ${lastName} -> ${department}`);
  res.json({ success: true });
});

// 2. Обжалование выговора (с файлом)
app.post('/api/appeal-reprimand', ensureAuth, upload.single('proof'), async (req, res) => {
  const { firstName, lastName, staticc, reprimandType, issuedBy, issuedDate, reasonGiven, description } = req.body;
  if (!firstName || !lastName || !staticc || !reprimandType || !issuedBy || !issuedDate || !reasonGiven || !description)
    return res.status(400).json({ error: 'Заполните все поля' });
  const user = req.user;
  const embed = {
    title: '⚖ Обжалование выговора',
    color: 0xc9a03d,
    fields: [
      { name: 'Имя Фамилия', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Статик', value: staticc, inline: true },
      { name: 'Вид наказания', value: reprimandType, inline: true },
      { name: 'Кем выдано', value: issuedBy, inline: true },
      { name: 'Когда выдано', value: issuedDate, inline: true },
      { name: 'Причина из выговора', value: reasonGiven, inline: false },
      { name: 'Описание ситуации', value: description, inline: false },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  await sendToWebhook(process.env.WEBHOOK_OBZHALOVANIE, embed, req.file ? [req.file] : []);
  await sendLog('Обжалование выговора', user);
  res.json({ success: true });
});

// 3. Отработка выговора
app.post('/api/workoff-reprimand', ensureAuth, async (req, res) => {
  const { firstName, lastName, staticc, rank, reason, punishmentType, evidence } = req.body;
  if (!firstName || !lastName || !staticc || !rank || !reason || !punishmentType || !evidence)
    return res.status(400).json({ error: 'Заполните все поля' });
  const user = req.user;
  const embed = {
    title: '🛠 Отработка выговора',
    color: 0xc9a03d,
    fields: [
      { name: 'Имя Фамилия', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Статик', value: staticc, inline: true },
      { name: 'Ранг', value: rank, inline: true },
      { name: 'За что выговор', value: reason, inline: false },
      { name: 'Тип наказания', value: punishmentType, inline: true },
      { name: 'Док-ва', value: evidence, inline: false },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  await sendToWebhook(process.env.WEBHOOK_OTRABOTKA, embed);
  await sendLog('Отработка выговора', user);
  res.json({ success: true });
});

// 4. Повышение (пинг отдела)
app.post('/api/promotion', ensureAuth, async (req, res) => {
  const { firstName, lastName, staticc, currentRank, targetRank, points, proof, department } = req.body;
  if (!firstName || !lastName || !staticc || !currentRank || !targetRank || !points || !proof || !department)
    return res.status(400).json({ error: 'Заполните все поля' });
  const user = req.user;
  const roleId = process.env[`ROLE_${department.toUpperCase()}`];
  const ping = roleId ? `<@&${roleId}>` : '';
  const embed = {
    title: `⭐ Заявка на повышение (${department})`,
    color: 0xc9a03d,
    fields: [
      { name: 'Имя Фамилия', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Статик', value: staticc, inline: true },
      { name: 'Текущий ранг', value: currentRank, inline: true },
      { name: 'Целевой ранг', value: targetRank, inline: true },
      { name: 'Кол-во баллов', value: points, inline: true },
      { name: 'Док-ва баллов', value: proof, inline: false },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  if (ping) embed.description = ping;
  const webhookUrl = process.env[`WEBHOOK_PROMOTION_${department.toUpperCase()}`];
  if (!webhookUrl) return res.status(500).json({ error: 'Вебхук не настроен' });
  await sendToWebhook(webhookUrl, embed);
  await sendLog('Заявка на повышение', user, `Отдел ${department}`);
  res.json({ success: true });
});

// 5. Отпуск / отдых (пинг отдела)
app.post('/api/leave', ensureAuth, async (req, res) => {
  const { type, department, reason, from, to, note } = req.body;
  if (!type || !department || !reason || !from || !to)
    return res.status(400).json({ error: 'Заполните обязательные поля' });
  const user = req.user;
  const roleId = process.env[`ROLE_${department.toUpperCase()}`];
  const ping = roleId ? `<@&${roleId}>` : '';
  const embed = {
    title: type === 'отпуск' ? '🏖 Заявка на отпуск' : '🌴 Заявка на отдых',
    color: 0xc9a03d,
    fields: [
      { name: 'Отдел', value: department, inline: true },
      { name: 'Причина', value: reason, inline: true },
      { name: 'Период', value: `${from} → ${to}`, inline: true },
      { name: 'Примечание', value: note || '—', inline: false },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    description: `⚠️ Взять отпуск можно максимум до двух недель, во время отпуска запрещено находиться в игре.\n${ping}`,
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  const webhookUrl = type === 'отпуск' ? process.env.WEBHOOK_LEAVE : process.env.WEBHOOK_REST;
  if (!webhookUrl) return res.status(500).json({ error: 'Вебхук не настроен' });
  await sendToWebhook(webhookUrl, embed);
  await sendLog(`Заявка на ${type}`, user);
  res.json({ success: true });
});

// 6. Заявка на спец вооружение (глобальные роли + отдел)
app.post('/api/spec-weapon-request', ensureAuth, async (req, res) => {
  const { firstName, lastName, staticc, rank, department, weapon } = req.body;
  if (!firstName || !lastName || !staticc || !rank || !department || !weapon)
    return res.status(400).json({ error: 'Заполните все поля' });
  const user = req.user;
  const global1 = process.env.ROLE_GLOBAL_1;
  const global2 = process.env.ROLE_GLOBAL_2;
  const roleDept = process.env[`ROLE_${department.toUpperCase()}`];
  const ping = `<@&${global1}> <@&${global2}> ${roleDept ? `<@&${roleDept}>` : ''}`;
  const embed = {
    title: '🔫 Заявка на спец вооружение',
    color: 0xc9a03d,
    fields: [
      { name: 'Имя Фамилия', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Статик', value: staticc, inline: true },
      { name: 'Ранг', value: rank, inline: true },
      { name: 'Отдел', value: department, inline: true },
      { name: 'Спец вооружение', value: weapon, inline: false },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    description: ping,
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  await sendToWebhook(process.env.WEBHOOK_SPEC_WEAPON, embed);
  await sendLog('Заявка на спец вооружение', user);
  res.json({ success: true });
});

// 7. Получение спец вооружения (глобальные + отдел + файл)
app.post('/api/spec-weapon-receive', ensureAuth, upload.single('inventoryScreenshot'), async (req, res) => {
  const { firstName, lastName, staticc, rank, department, weapon, weaponNumber, issuedBy } = req.body;
  if (!firstName || !lastName || !staticc || !rank || !department || !weapon || !weaponNumber || !issuedBy)
    return res.status(400).json({ error: 'Заполните все поля' });
  const user = req.user;
  const global1 = process.env.ROLE_GLOBAL_1;
  const global2 = process.env.ROLE_GLOBAL_2;
  const roleDept = process.env[`ROLE_${department.toUpperCase()}`];
  const ping = `<@&${global1}> <@&${global2}> ${roleDept ? `<@&${roleDept}>` : ''}`;
  const embed = {
    title: '✅ Получение спец вооружения',
    color: 0xc9a03d,
    fields: [
      { name: 'Имя Фамилия', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Статик', value: staticc, inline: true },
      { name: 'Ранг', value: rank, inline: true },
      { name: 'Отдел', value: department, inline: true },
      { name: 'Спец вооружение', value: weapon, inline: true },
      { name: 'Номер спецухи', value: weaponNumber, inline: true },
      { name: 'Кто выдал', value: issuedBy, inline: true },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    description: ping,
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  await sendToWebhook(process.env.WEBHOOK_SPEC_WEAPON_GET, embed, req.file ? [req.file] : []);
  await sendLog('Получение спец вооружения', user);
  res.json({ success: true });
});

// 8. Увольнение (рапорт) — пинг отдела
app.post('/api/resignation', ensureAuth, async (req, res) => {
  const { firstName, lastName, staticId, department, tablet, inventory, reason, discordId } = req.body;
  if (!firstName || !lastName || !staticId || !department || !tablet || !inventory || !reason)
    return res.status(400).json({ error: 'Заполните все поля' });
  const user = req.user;
  const roleId = process.env[`ROLE_${department.toUpperCase()}`];
  const ping = roleId ? `<@&${roleId}>` : '';
  const embed = {
    title: '📄 Рапорт на увольнение',
    color: 0xc9a03d,
    fields: [
      { name: 'Имя Фамилия', value: `${firstName} ${lastName}`, inline: true },
      { name: 'Static ID', value: staticId, inline: true },
      { name: 'Отдел', value: department, inline: true },
      { name: 'Планшет', value: tablet, inline: true },
      { name: 'Инвентарь', value: inventory, inline: true },
      { name: 'Причина', value: reason, inline: false },
      { name: 'Discord ID', value: discordId || user.id, inline: true },
      { name: 'Отправитель', value: `${user.username} (${user.id})`, inline: false }
    ],
    footer: { text: 'by stylenow' },
    timestamp: new Date().toISOString()
  };
  if (ping) embed.description = ping;
  await sendToWebhook(process.env.WEBHOOK_RESIGNATION, embed);
  await sendLog('Заявка на увольнение', user, `${firstName} ${lastName} из ${department}`);
  res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log(`Сервер запущен на порту ${process.env.PORT || 3000}`));