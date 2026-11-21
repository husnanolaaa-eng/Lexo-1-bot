require('dotenv').config();
const fs = require('fs');
const {
  Client, GatewayIntentBits, Partials, PermissionFlagsBits: P, ChannelType, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, AuditLogEvent, Events, MessageFlags, PermissionsBitField,
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

/* ===================== AYARLAR ===================== */
const OWNER_ID = process.env.OWNER_ID;   // cikomiko0787 hesabının Discord ID'si
const GUILD_ID = process.env.GUILD_ID;   // sunucu ID'si
const R = { corum: 'çorum', nuke: 'nuke✅', chat: 'chatyt✅', ses: 'ses yt✅', hayatsiz: 'hayatsız',
  muted: 'susturuldu', sanik: 'SANIK', mahkum: 'mahkum', bekleyen: 'BEKLEYEN ADAM' };
const C = { rules: 'kurallar', announce: 'duyuru', roleinfo: 'rol-bilgilendirme', complaint: 'şikayet',
  fun: 'eğlence', log: 'log', chat: 'chat' };
const MUTE_MIN = 3;
const EPH = { flags: MessageFlags.Ephemeral };

const BLACKLIST = ['sikeyim','amcık','s1keyim','s1keym','s1kym','sıkım','sikim','skecem','sikecem','s1k3c3m','kodom','kodum',
  'koduğumun','koyduğumun','k0yduğumun','0r0spu','orospu','orrospu','oruspo','orosbu','örösbü','horozbu','oe','oç','œ','oc',
  'amcığına','1mcğına','amcıkına','amcikina','nigger','nigga','niggi','niggy','fuck','fack','foeck','fick','kanker','kankerr',
  'hoer','hoer kind','kkr','s1kym','s1keyim'];

const ROLE_CMDS = {
  [R.corum]: 'Tüm yönetim komutları: .nuke .mute .unmute .yavaş .sesegir .sestençık .uyar !kurallar !rolbilgiler !bitir .kurulum',
  [R.nuke]: '.nuke',
  [R.chat]: '.mute .unmute .yavaş',
  [R.ses]: 'Ses kanalında susturma, sağırlaştırma, sesten atma',
  [R.hayatsiz]: '.ship .zeka .zekam .kapış (eğlence kanalında)',
};

/* ===================== VERİ ===================== */
const DB_FILE = './data.json';
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : {};
db.users ||= {}; db.cases ||= {}; db.mutes ||= {}; db.courts ||= {}; db.hidden ||= [];
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1)), 500); };
const U = id => (db.users[id] ||= { roleLog: [], courts: 0, profanity: 0, bans: 0, rejoin: 0, kicks: 0, complaints: 0,
  warns: 0, appeals: 0, mutesGiven: 0, nukeChannels: [], nukes: 0, voice: {}, text: {}, notes: [], hidden: false });

/* ===================== YARDIMCILAR ===================== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel, Partials.Message],
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s).toLocaleLowerCase('tr');
const hasRole = (m, n) => !!m?.roles?.cache.some(r => r.id !== m.guild.id && (norm(r.name) === norm(n) || norm(r.name).includes(norm(n))));
const isCorum = m => hasRole(m, R.corum);
const findRole = (g, n) => g.roles.cache.find(r => norm(r.name) === norm(n)) || g.roles.cache.find(r => r.id !== g.id && norm(r.name).includes(norm(n)));
const findChan = (g, n) => g.channels.cache.find(c => norm(c.name) === norm(n)) || g.channels.cache.find(c => norm(c.name).includes(norm(n)));
const ensureRole = async (g, name, o = {}) => findRole(g, name) || g.roles.create({ name, ...o });
const isIn = (ch, n) => norm(ch.name).includes(norm(n));
const rep = (m, c) => m.reply({ content: c, allowedMentions: { repliedUser: false } }).catch(() => {});
const logChan = g => findChan(g, C.log);
const ts = (ms, f = 'F') => `<t:${Math.floor(ms / 1000)}:${f}>`;
const cut = (s, n = 1000) => (s.length > n ? s.slice(0, n - 3) + '...' : s || '—');
const row = (...b) => new ActionRowBuilder().addComponents(...b);
const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

/* ===================== METİNLER ===================== */
const RULES_DESC = [
  '**1. Saygı ve hoşgörü**\nSunucumuzda bulunan her üyenin birbirine karşı saygılı ve anlayışlı davranması beklenmektedir. Hiçbir üye, başka bir üyeyi küçük düşüremez, aşağılayamaz, hedef gösteremez veya rahatsız edici davranışlarda bulunamaz. Herkesin düşüncelerine ve kişisel sınırlarına saygı gösterilmelidir.',
  '**2. Küfür ve hakaret**\nSunucumuzda küfür, hakaret, ağır argo ve aşağılayıcı söylemler yasaktır. Şaka amacıyla dahi olsa başka bir üyeyi rahatsız edecek, küçük düşürecek veya huzurunu bozacak ifadeler kullanılmamalıdır. Arkadaş ortamında bulunmamız, saygı sınırlarının aşılabileceği anlamına gelmez.',
  '**3. Şantaj, tehdit ve RAT**\nŞantaj, tehdit, korkutma, kişisel bilgileri izinsiz paylaşma ve RAT (uzaktan erişim yoluyla bir kişinin cihazını kontrol etmeye yönelik zararlı yazılımlar) gibi davranışlar kesinlikle yasaktır. Bu tür davranışların hiçbir şekilde bahanesi veya istisnası kabul edilmeyecektir.',
  '**4. Üyeleri rahatsız etmek ve taciz**\nHerhangi bir üyeyi sürekli mesaj atarak rahatsız etmek, özel mesaj yoluyla baskı kurmak, huzurunu bozmak veya istemediği hâlde iletişim kurmaya zorlamak yasaktır. Bir üye rahatsız olduğunu belirttiğinde bu uyarıya saygı gösterilmesi zorunludur.',
  '**5. Kural ihlalleri ve uygulanacak cezalar**\nYukarıdaki kuralları ihlal eden üyeler hakkında gerekli işlemler uygulanacaktır. Şantaj, RAT, tehdit ve ciddi ihlallerde doğrudan kalıcı yasaklama (permanent ban) uygulanabilir.',
  '**6. Genel sunucu düzeni**\nSunucumuzun amacı insanları birbirine düşürmek değil, keyifli sohbetler gerçekleştirmektir. Bu sunucuya katılan herkes kuralları kabul etmiş sayılır.',
  'Herkese iyi eğlenceler, keyifli vakit geçirmeniz dileğiyle! ❤',
].join('\n\n');
const rulesEmbed = () => new EmbedBuilder().setTitle('📜 SUNUCU KURALLARI').setDescription(RULES_DESC).setColor(0x5865f2);

const roleInfoEmbeds = () => [
  new EmbedBuilder().setColor(0xf1c40f).setTitle('📖 ROL BİLGİLENDİRME — YETKİ VE SORUMLULUKLAR')
    .setDescription('Sevgili yetkililer,\n\nBu metin; sahip olduğunuz rollerin ne anlama geldiğini, size hangi yetkileri tanıdığını ve bu yetkilerin beraberinde getirdiği sorumlulukları açıklamak amacıyla hazırlanmıştır. Sunucumuzun huzuru, düzeni ve güvenliği bu rollerin doğru kullanılmasına bağlıdır. Lütfen metni baştan sona dikkatle okuyunuz.'),
  new EmbedBuilder().setColor(0xe74c3c).setTitle('💥 nuke✅ Rolü')
    .setDescription('Bu rol, bir sohbet kanalındaki tüm mesaj geçmişini tek hamlede temizleyerek kanalı sıfırlayabilmenizi sağlar. Kanal; aynı ayarlarla, yepyeni ve tertemiz bir hâlde yeniden oluşturulur.\n\nKanalın bozulduğu, aşırı kirlendiği, spam veya uygunsuz içerikle dolduğu durumlarda başvurulacak son çaredir. İşlem geri alınamaz; bu nedenle komutu kullanmadan önce kanalda saklanması gereken önemli bir içerik olup olmadığını mutlaka kontrol ediniz.\n\n**Kullanım:** `.nuke` yazın ve çıkan onay mesajındaki butondan işlemi onaylayın. Onay butonuna yalnızca komutu yazan kişi basabilir.'),
  new EmbedBuilder().setColor(0x3498db).setTitle('💬 chatyt✅ Rolü')
    .setDescription('Bu rol, sohbet kanallarında düzeni sağlamanız için size gerekli araçları verir. Kurallara aykırı davranan bir üyeyi geçici olarak susturabilir, susturmayı erken kaldırabilir ve kanalın yavaş modunu ayarlayabilirsiniz.\n\n**Komutlar:** `.mute @kullanıcı`, `.unmute @kullanıcı`, `.yavaş <0-5>`\n\nSusturma yetkisi kişisel ya da keyfî sebeplerle kullanılamaz. Her susturma, kural ihlaline dayanmalı ve gerektiğinde kanıtlanabilir olmalıdır. Haksız susturmalar, şikayet sistemi aracılığıyla üst yetkililere iletilecektir.'),
  new EmbedBuilder().setColor(0x9b59b6).setTitle('🔊 ses yt✅ Rolü')
    .setDescription('Bu rol, ses kanallarındaki düzeni korumanız için tanınmıştır. Ses kanalında bir üyeyi **susturabilir**, **sağırlaştırabilir** ve gerekli gördüğünüzde **sesten atabilirsiniz**.\n\nBu yetkiler yalnızca kurallara aykırı davranışlarda (rahatsız edici ses, hakaret, taciz vb.) kullanılmalıdır. Sebepsiz yere birini susturmak ya da kanaldan atmak, yetkinin kötüye kullanılması sayılır.'),
  new EmbedBuilder().setColor(0x2ecc71).setTitle('⚖️ Yetkinin Kötüye Kullanılması ve Rolün Geri Alınması')
    .setDescription('Bir yetkili, rolünü keyfî biçimde kullanır veya kötüye kullanırsa rolü geri alınır. Rolü geri alınan kişinin yetkiyi yeniden kazanabilmesi için aşağıdaki aktiflik şartlarını yerine getirmesi gerekir:\n\n🔊 **ses yt✅ için:** 50 saat ses aktifliği\n💬 **chatyt✅ için:** 2.000 mesaj aktifliği\n💥 **nuke✅ için:** 1.000 saat ses aktifliği\n\nYetki bir ayrıcalık değil, bir sorumluluktur. Hepinizden adil, saygılı ve dikkatli davranmanızı bekliyoruz. Sunucumuzun huzuru hepimizin ortak emanetidir. ❤'),
];

const muteDM = (guildName, byName) =>
  `🔇 **SUSTURULDUNUZ**\n\n**${guildName}** sunucusunda **${byName}** tarafından ${MUTE_MIN} dakika süreyle susturuldunuz.\n\nBu işlemin haksız olduğunu düşünüyorsanız lütfen vakit kaybetmeden **çorum** rolüne sahip bir yetkiliye şikayetçi olun.\n\n**NASIL ŞİKAYETÇİ OLABİLİRSİNİZ?**\n1️⃣ Sunucuya girin.\n2️⃣ **çorum** rolüne sahip bir yetkili bulun.\n3️⃣ Ona özel mesaj (DM) yoluyla ulaşın.\n4️⃣ Şikayetinizi düzgün ve saygılı bir dille yazın.\n5️⃣ Aldığınız susturmanın haksız olduğunu gösteren bir ekran görüntüsünü ve susturulduğunuz saati mutlaka ekleyin.\n\nHiçbir yetkiliye ulaşamıyorsanız aşağıdaki butona basarak şikayetinizi iletebilirsiniz.`;
const warnDM = reason =>
  `⚠️ **RESMİ UYARI**\n\nYetkili tarafından uyarıldınız ve bu uyarı maalesef sicilinize işlenmiştir.\n\n**Uyarı sebebi:** ${reason}\n\nHakkınızda yapılan bu uyarı keyfî değildir; yetkililer delilleri inceleyerek ortak karar almış ve sizi resmî olarak uyarmıştır. Bir daha böyle bir durumla karşılaşmamak için lütfen sunucu kurallarına özen gösterin.`;

/* ===================== SUSTURMA ===================== */
async function doMute(member, by, restore = []) {
  const g = member.guild;
  const role = await ensureRole(g, R.muted, { color: 0x808080 });
  await member.roles.add(role).catch(() => {});
  db.mutes[member.id] = { guildId: g.id, until: Date.now() + MUTE_MIN * 60000,
    restore: [...(db.mutes[member.id]?.restore || []), ...restore] };
  if (by && by.id !== client.user.id) U(by.id).mutesGiven++;
  save();
  const byName = by?.displayName || by?.username || 'LEXO 1';
  member.send({ content: muteDM(g.name, byName),
    components: [row(btn(`sk:${g.id}:${by?.id || client.user.id}`, 'Bir yetkiliye şikayetimi ilet.', ButtonStyle.Danger))] }).catch(() => {});
}
async function releaseMute(id) {
  const m = db.mutes[id]; if (!m) return;
  delete db.mutes[id]; save();
  const g = client.guilds.cache.get(m.guildId);
  const mem = await g?.members.fetch(id).catch(() => null); if (!mem) return;
  const role = findRole(g, R.muted);
  if (role) await mem.roles.remove(role).catch(() => {});
  if (m.restore.length) await mem.roles.add(m.restore.filter(r => g.roles.cache.has(r))).catch(() => {});
}
setInterval(() => { for (const [id, m] of Object.entries(db.mutes)) if (Date.now() >= m.until) releaseMute(id); }, 10000);

/* ===================== KURULUM (kanal izinleri) =====================
 * - SANIK / mahkum / BEKLEYEN ADAM: hiçbir kanalı göremez (rolü olmayanla aynı).
 * - Diğer TÜM roller: tüm kanalları görür, yazar, ses kanalına girer.
 * - susturuldu: kanalları görür, sohbete yazamaz, ses kanalına girer.
 * - kurallar: herkes görür ama yazamaz. duyuru/rol-bilgilendirme/şikayet: roller görür, sadece çorum yazar.
 * - log: sadece çorum.
 * Kanal başına TEK istek atılır (permissionOverwrites.set), mevcut diğer izinler korunur. */
const isSpecial = ch => /^(mahkeme-|ceza-evi|bekleme)/.test(norm(ch.name)) || !!db.courts[ch.id];
function permCtx(g) {
  const blocked = [R.sanik, R.mahkum, R.bekleyen].map(n => findRole(g, n)).filter(Boolean);
  const bid = new Set(blocked.map(r => r.id));
  return { everyone: g.roles.everyone, corum: findRole(g, R.corum), muted: findRole(g, R.muted), blocked,
    allowed: [...g.roles.cache.values()].filter(r => r.id !== g.id && !r.managed && !bid.has(r.id)),
    rules: findChan(g, C.rules), log: findChan(g, C.log),
    info: [C.announce, C.roleinfo, C.complaint].map(n => findChan(g, n)?.id).filter(Boolean) };
}
async function applyPerms(g, ch, x) {
  if (ch.isThread() || ch.type === ChannelType.GuildCategory || isSpecial(ch)) return;
  const map = new Map(ch.permissionOverwrites.cache.map(p => [p.id, { id: p.id, type: p.type,
    allow: new PermissionsBitField(p.allow), deny: new PermissionsBitField(p.deny) }]));
  const set = (id, { allow = [], deny = [], clear = [] }) => {
    const e = map.get(id) || { id, type: 0, allow: new PermissionsBitField(), deny: new PermissionsBitField() };
    e.allow.remove(...clear, ...deny); e.deny.remove(...clear, ...allow);
    e.allow.add(...allow); e.deny.add(...deny); map.set(id, e);
  };
  const V = P.ViewChannel, H = P.ReadMessageHistory, S = P.SendMessages;
  const isLog = ch.id === x.log?.id, isRules = ch.id === x.rules?.id, isInfo = x.info.includes(ch.id);
  if (isLog) {
    set(x.everyone.id, { deny: [V] });
    for (const r of x.allowed) set(r.id, { clear: [V] });
    if (x.corum) set(x.corum.id, { allow: [V, S, H] });
  } else if (isRules) {
    set(x.everyone.id, { allow: [V, H], deny: [S, P.AddReactions] });
    if (x.corum) set(x.corum.id, { allow: [S] });
  } else {
    set(x.everyone.id, { deny: [V] });
    for (const r of x.allowed) set(r.id, { allow: [V, H] });
    if (isInfo) { set(x.everyone.id, { deny: [V, S, P.AddReactions] }); if (x.corum) set(x.corum.id, { allow: [V, S, H] }); }
  }
  if (x.muted && ch.isTextBased()) set(x.muted.id, { deny: [S, P.AddReactions, P.SendMessagesInThreads, P.CreatePublicThreads] });
  for (const r of x.blocked) set(r.id, { deny: [V] });
  await ch.permissionOverwrites.set([...map.values()]).catch(e => console.error('izin hatası', ch.name, e.message));
}
let setupRunning = false;
async function setup(g) {
  setupRunning = true;
  try { return await setupInner(g); } finally { setupRunning = false; }
}
async function setupInner(g) {
  const missing = [R.corum, R.hayatsiz, R.nuke, R.chat, R.ses].filter(n => !findRole(g, n));
  for (const n of [R.muted, R.sanik, R.mahkum, R.bekleyen]) await ensureRole(g, n, n === R.muted ? { color: 0x808080 } : {});
  const x = permCtx(g);
  for (const ch of g.channels.cache.values()) await applyPerms(g, ch, x);
  return missing;
}
client.on(Events.ChannelCreate, async ch => { if (ch.guild) { await sleep(1500); applyPerms(ch.guild, ch, permCtx(ch.guild)); } });
client.on(Events.GuildRoleCreate, async r => {
  if (r.managed || setupRunning) return; const x = permCtx(r.guild);
  if (!x.allowed.some(a => a.id === r.id) && !x.blocked.some(a => a.id === r.id)) return;
  for (const ch of r.guild.channels.cache.values()) await applyPerms(r.guild, ch, x);
});

/* ===================== GÖRSELLER ===================== */
async function avatar(user) {
  const url = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
  return loadImage(Buffer.from(await (await fetch(url)).arrayBuffer()));
}
function circle(ctx, img, cx, cy, r) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2); ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}
function heart(ctx, x, y, s, color = '#ff3366') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.beginPath(); ctx.moveTo(0, 40);
  ctx.bezierCurveTo(-80, -10, -40, -70, 0, -25); ctx.bezierCurveTo(40, -70, 80, -10, 0, 40);
  ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function bg(ctx, w, h, c1, c2) { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
function txt(ctx, t, x, y, size, color = '#fff', align = 'center', maxW) {
  ctx.font = `bold ${size}px sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  maxW ? ctx.fillText(t, x, y, maxW) : ctx.fillText(t, x, y);
}
const attach = (c, name) => new AttachmentBuilder(c.toBuffer('image/png'), { name });

async function shipImage(a, b, pct) {
  const c = createCanvas(900, 500), x = c.getContext('2d'); bg(x, 900, 500, '#2b0a3d', '#7a1b4f');
  txt(x, 'AŞKIMIZ', 450, 55, 46); txt(x, pct + '%', 450, 130, 80, '#ff7aa8');
  circle(x, await avatar(a.user), 170, 290, 110); circle(x, await avatar(b.user), 730, 290, 110);
  for (let i = 0; i < 5; i++) heart(x, 330 + i * 60, 380, 60);
  txt(x, a.displayName, 170, 450, 26, '#fff', 'center', 260); txt(x, b.displayName, 730, 450, 26, '#fff', 'center', 260);
  return attach(c, 'ship.png');
}
async function zekamImage(m, pct) {
  const c = createCanvas(900, 500), x = c.getContext('2d'); bg(x, 900, 500, '#0f2027', '#2c5364');
  circle(x, await avatar(m.user), 200, 250, 130);
  txt(x, 'ZEKA SEVİYEN', 620, 60, 40); txt(x, pct + '%', 620, 150, 90, '#ffd166');
  if (fs.existsSync('./assets/brain.png')) x.drawImage(await loadImage('./assets/brain.png'), 520, 230, 200, 200);
  else { x.font = '170px sans-serif'; x.textAlign = 'center'; x.fillText('🧠', 620, 340); }
  txt(x, m.displayName, 200, 440, 28, '#fff', 'center', 300);
  return attach(c, 'zekam.png');
}
async function zekaImage(m) {
  const c = createCanvas(900, 420), x = c.getContext('2d'); bg(x, 900, 420, '#141e30', '#35577d');
  txt(x, m.displayName, 60, 150, 52, '#fff', 'left', 520); circle(x, await avatar(m.user), 745, 150, 110);
  txt(x, 'SUNUCUNUN EN ZEKİ ELEMANI!', 450, 320, 44, '#ffd166'); txt(x, 'MAŞALLAH!', 450, 375, 40, '#fff');
  return attach(c, 'zeka.png');
}
async function kapisImage(a, b, winner) {
  const c = createCanvas(900, 500), x = c.getContext('2d'); bg(x, 900, 500, '#3a0d0d', '#1a1a2e');
  circle(x, await avatar(a.user), 170, 220, 110); circle(x, await avatar(b.user), 730, 220, 110);
  txt(x, 'BU KAVGAYI', 450, 180, 34); txt(x, 'KAZANAN KİŞİ:', 450, 225, 34, '#ffd166');
  txt(x, winner.displayName, 450, 320, 40, '#fff', 'center', 700);
  txt(x, a.displayName, 170, 360, 24, '#fff', 'center', 260); txt(x, b.displayName, 730, 360, 24, '#fff', 'center', 260);
  return attach(c, 'kapis.png');
}
const lastRand = {};
function uniqueRand(key, max) { let n; do { n = Math.floor(Math.random() * (max + 1)); } while (n === lastRand[key]); return (lastRand[key] = n); }

/* ===================== MAHKEME ===================== */
const KEEP_OUT = [R.chat, R.ses, R.nuke, R.sanik].map(norm);
async function openCourt(guild, targetId, opener, c) {
  const member = await guild.members.fetch(targetId).catch(() => null);
  const sanik = await ensureRole(guild, R.sanik);
  const corum = findRole(guild, R.corum);
  const allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory];
  const ch = await guild.channels.create({
    name: `mahkeme-${member?.user.username || targetId}`.toLowerCase().slice(0, 90), type: ChannelType.GuildText,
    permissionOverwrites: [{ id: guild.id, deny: [P.ViewChannel] },
      { id: client.user.id, allow: [...allow, P.ManageChannels] }, { id: opener.id, allow },
      ...(member ? [{ id: member.id, allow }] : []),
      ...(corum ? [{ id: corum.id, allow: [P.ViewChannel, P.ReadMessageHistory] }] : [])],
  });
  let restore = [];
  if (member) {
    restore = member.roles.cache.filter(r => r.id !== guild.id && !r.managed && !KEEP_OUT.includes(norm(r.name))).map(r => r.id);
    await member.roles.remove(member.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => r.id)).catch(() => {});
    await member.roles.add(sanik).catch(() => {});
  }
  db.courts[ch.id] = { guildId: guild.id, target: targetId, opener: opener.id, restore, messages: [], caseId: c?.id, at: Date.now() };
  U(targetId).courts++; save();
  await ch.send(`<@${targetId}> Şu an mahkemedesiniz.`);
  return ch;
}
async function endCourt(ch) {
  const c = db.courts[ch.id]; if (!c) return;
  const g = ch.guild;
  const member = await g.members.fetch(c.target).catch(() => null);
  if (member) {
    const s = findRole(g, R.sanik); if (s) await member.roles.remove(s).catch(() => {});
    await member.roles.add(c.restore.filter(r => g.roles.cache.has(r))).catch(() => {});
    await member.roles.add(await ensureRole(g, R.hayatsiz)).catch(() => {});
  }
  if (c.caseId && db.cases[c.caseId]) db.cases[c.caseId].transcript = c.messages;
  delete db.courts[ch.id]; save();
  await ch.send('⚖️ Mahkeme sona erdi. Kanal kapatılıyor...'); await sleep(3000); ch.delete().catch(() => {});
}

/* ===================== LOG / KÜFÜR DOSYASI ===================== */
const caseEmbed = c => new EmbedBuilder().setColor(0xe74c3c).setTitle('🚨 KÜFÜR TESPİT EDİLDİ').setThumbnail(c.avatar)
  .addFields({ name: 'Küfür', value: cut('```' + c.text.replace(/`/g, "'") + '```') },
    { name: 'Kanal', value: c.channelName, inline: true },
    { name: 'Bot tarafından fark edildiği saat', value: ts(c.detectedAt), inline: true },
    { name: 'Küfrün edildiği saat', value: ts(c.sentAt), inline: true },
    { name: 'Kullanıcı ID', value: c.userId, inline: true },
    { name: 'Kullanıcı adı', value: c.username, inline: true },
    { name: 'Tetikleyen kelime', value: c.word, inline: true });
const caseButtons = id => row(btn(`lg:sicil:${id}`, 'SİCİLE İŞLE', ButtonStyle.Primary), btn(`lg:mahkeme:${id}`, 'MAHKEME AÇ', ButtonStyle.Danger),
  btn(`lg:gizle:${id}`, 'BU DOSYAYI GİZLE'), btn(`lg:sil:${id}`, 'BU DOSYAYI SİL'), btn(`lg:kopya:${id}`, 'BU DOSYAYI KOPYALA'));

async function logButton(i, action, id) {
  const c = db.cases[id];
  if (!c) return i.reply({ content: 'Dosya bulunamadı.', ...EPH });
  if (!isCorum(i.member)) return i.reply({ content: 'Bu işlem için yetkin yok.', ...EPH });
  if (c.state !== 'open') return i.reply({ content: 'Bu dosya zaten işleme alındı.', ...EPH });
  c.state = 'processing'; c.by = i.user.id; save();
  await i.update({ content: '⏳ İşlem başlatılıyor...', components: [] });
  const msg = i.message;
  if (action === 'sicil') { U(c.userId).notes.push({ at: Date.now(), text: `Küfür: ${c.text}`, by: i.user.id }); c.state = 'done';
    msg.edit({ content: `📝 Sicile işlendi. (${i.user})` }); }
  if (action === 'mahkeme') { const ch = await openCourt(i.guild, c.userId, i.user, c); c.state = 'court'; c.archived = true;
    msg.edit({ content: `⚖️ Mahkeme açıldı: ${ch} — açan: ${i.user}. Küfür arşive alındı.` }); }
  if (action === 'gizle') { db.hidden.push(id); c.state = 'hidden'; msg.delete().catch(() => {}); }
  if (action === 'sil') { delete db.cases[id]; msg.delete().catch(() => {}); }
  if (action === 'kopya') { await i.user.send({ embeds: [caseEmbed(c)] }).catch(() => {}); c.state = 'done';
    msg.edit({ content: '📋 Dosya kopyalandı ve DM olarak gönderildi.' }); }
  save();
}

async function handleBadWord(msg, word) {
  const detectedAt = Date.now();
  await msg.delete().catch(() => {});
  const w = await msg.channel.send(`${msg.author} Sunucumuzda küfür yasaktır.`).catch(() => null);
  if (w) setTimeout(() => w.delete().catch(() => {}), 8000);
  U(msg.author.id).profanity++;
  const id = Date.now().toString(36);
  const c = db.cases[id] = { id, userId: msg.author.id, username: msg.author.tag || msg.author.username, text: msg.content, word,
    channelName: `#${msg.channel.name}`, sentAt: msg.createdTimestamp, detectedAt,
    avatar: msg.author.displayAvatarURL({ size: 256 }), state: 'open' };
  save();
  await logChan(msg.guild)?.send({ embeds: [caseEmbed(c)], components: [caseButtons(id)] });
}
function findBadWord(text) {
  const t = norm(text), tokens = t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const w of BLACKLIST) {
    const lw = norm(w).trim();
    if (lw.length <= 3 ? tokens.includes(lw) : t.includes(lw)) return w;
  }
  return null;
}

/* ===================== LİNK / FLOOD ===================== */
const LINK_RE = /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|tr|me|co|ly|tk)\b)/i;
const offenses = new Map(), floodTrack = new Map();
async function punishSpam(member, why, msg) {
  const o = offenses.get(member.id);
  const n = o && Date.now() - o.at < 120000 ? o.n + 1 : 1;
  offenses.set(member.id, { n, at: Date.now() });
  if (n === 1) {
    const m = await msg.channel.send(`${member} ⚠️ ${why} Devam ederseniz susturulacaksınız.`).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {}), 8000); return;
  }
  const g = member.guild, restore = [], corum = findRole(g, R.corum);
  if (isCorum(member) && corum) {
    const strip = member.roles.cache.filter(r => r.id !== g.id && !r.managed &&
      (r.id === corum.id || (corum.permissions.bitfield !== 0n && r.permissions.has(corum.permissions))));
    restore.push(...strip.keys());
    await member.roles.remove([...strip.keys()]).catch(() => {});
    await member.roles.add(await ensureRole(g, R.hayatsiz)).catch(() => {});
  }
  await doMute(member, client.user, restore);
  msg.channel.send(`🔇 ${member} spam/link/flood nedeniyle ${MUTE_MIN} dakika susturuldu.`).catch(() => {});
}

/* ===================== MESAJLAR ===================== */
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  if (!msg.guild) return handleDM(msg);
  const member = msg.member ?? await msg.guild.members.fetch(msg.author.id).catch(() => null);
  if (!member) return;
  const g = msg.guild, content = msg.content.trim(), low = norm(content);
  const u = U(msg.author.id); u.text[msg.channel.name] = (u.text[msg.channel.name] || 0) + 1;

  const court = db.courts[msg.channel.id];
  if (court && msg.author.id === court.target) { court.messages.push({ at: Date.now(), text: msg.content }); save(); }

  // Küfür
  const bad = findBadWord(content);
  if (bad) return handleBadWord(msg, bad);

  // Link / flood (sunucu sahibi hariç herkes, çorum dahil)
  if (msg.author.id !== g.ownerId) {
    if (LINK_RE.test(content)) {
      await msg.delete().catch(() => {});
      return punishSpam(member, 'Sunucumuzda link paylaşmak yasaktır.', msg);
    }
    const arr = (floodTrack.get(msg.author.id) || []).filter(t => Date.now() - t < 5000); arr.push(Date.now()); floodTrack.set(msg.author.id, arr);
    if (arr.length >= 6) {
      floodTrack.set(msg.author.id, []);
      const recent = await msg.channel.messages.fetch({ limit: 20 }).catch(() => null);
      if (recent) await msg.channel.bulkDelete(recent.filter(m => m.author.id === msg.author.id && Date.now() - m.createdTimestamp < 6e5)).catch(() => {});
      return punishSpam(member, 'Flood/spam yapmak yasaktır.', msg);
    }
  }

  if (low === 'sa') return msg.reply('as hoşgeldin bra').catch(() => {});

  const [cmdRaw, ...args] = content.split(/\s+/); const cmd = norm(cmdRaw);
  const corum = isCorum(member);

  /* ---- .nuke ---- */
  if (cmd === '.nuke') {
    if (!corum && !hasRole(member, R.nuke)) return rep(msg, 'Bu komutu kullanma yetkin yok.');
    if (db.courts[msg.channel.id]) return rep(msg, 'Mahkeme kanalına nuke atılamaz.');
    return msg.reply({ content: 'Bu kanala nuke atacaksınız. Emin misiniz?', allowedMentions: { repliedUser: false },
      components: [row(btn(`nk:y:${msg.author.id}`, 'Evet, nuke at.', ButtonStyle.Danger), btn(`nk:n:${msg.author.id}`, 'İptal'))] });
  }
  /* ---- .mute / .unmute ---- */
  if (cmd === '.mute' || cmd === '.unmute') {
    if (!corum && !hasRole(member, R.chat)) return rep(msg, 'Bu komutu kullanma yetkin yok.');
    const t = msg.mentions.members.first();
    if (!t) return rep(msg, 'Lütfen bir kullanıcı etiketleyin.');
    if (cmd === '.unmute') {
      if (db.mutes[t.id]) await releaseMute(t.id); else { const r = findRole(g, R.muted); if (r) await t.roles.remove(r).catch(() => {}); }
      return rep(msg, `🔊 ${t} kullanıcısının susturması kaldırıldı.`);
    }
    if (t.user.bot || t.id === g.ownerId || (isCorum(t) && !corum)) return rep(msg, 'Bu kullanıcı susturulamaz.');
    await doMute(t, member);
    return rep(msg, `🔇 ${t} ${MUTE_MIN} dakikalığına susturuldu.`);
  }
  /* ---- .yavaş ---- */
  if (cmd === '.yavaş' || cmd === '.yavas') {
    if (!corum && !hasRole(member, R.chat)) return rep(msg, 'Bu komutu kullanma yetkin yok.');
    const n = parseInt(args[0]);
    if (isNaN(n) || n < 0 || n > 5) return rep(msg, 'Lütfen 0 ile 5 arasında bir sayı yazın. (Örnek: `.yavaş 5`)');
    await msg.channel.setRateLimitPerUser(n).catch(() => {});
    return rep(msg, n === 0 ? 'Yavaş mod kaldırıldı.' : 'Kanal başarılı şekilde yavaş moda alındı.');
  }
  /* ---- ses ---- */
  if (cmd === '.sesegir' || cmd === '.sestençık' || cmd === '.sestencik') {
    if (!corum) return;
    if (cmd !== '.sesegir') { getVoiceConnection(g.id)?.destroy(); return rep(msg, 'Ses kanalından çıktım.'); }
    const name = args.join(' ');
    const vc = g.channels.cache.find(c => c.type === ChannelType.GuildVoice && norm(c.name).includes(norm(name)));
    if (!vc) return rep(msg, 'Böyle bir ses kanalı bulamadım.');
    joinVoiceChannel({ channelId: vc.id, guildId: g.id, adapterCreator: g.voiceAdapterCreator, selfDeaf: true });
    return rep(msg, `🔊 **${vc.name}** kanalına girdim.`);
  }
  /* ---- !kurallar / !rolbilgiler / !bitir / .uyar / .kurulum ---- */
  if (cmd === '!kurallar') { if (!corum || !isIn(msg.channel, C.rules)) return; await msg.delete().catch(() => {}); return msg.channel.send({ embeds: [rulesEmbed()] }); }
  if (cmd === '!rolbilgiler') { if (!corum || !isIn(msg.channel, C.roleinfo)) return; await msg.delete().catch(() => {}); return msg.channel.send({ embeds: roleInfoEmbeds() }); }
  if (cmd === '!bitir') { if (!corum || !db.courts[msg.channel.id]) return; return endCourt(msg.channel); }
  if (cmd === '.kurulum') {
    if (!corum && msg.author.id !== g.ownerId) return;
    rep(msg, '⚙️ Roller ve kanal izinleri ayarlanıyor, bu biraz sürebilir...');
    const miss = await setup(g);
    return msg.channel.send('✅ Kurulum tamamlandı.' + (miss.length ? `\n⚠️ Sunucuda bulamadığım roller (oluşturmadım): ${miss.join(', ')}` : ''));
  }
  if (cmd === '.uyar') {
    if (!corum || !isIn(msg.channel, C.log)) return;
    const id = (args[0] || '').replace(/\D/g, ''); if (!id) return rep(msg, 'Kullanım: `.uyar <kullanıcı ID>`');
    return msg.channel.send({ content: '**UYARMA SEBEBİNİZ NEDİR**',
      embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('**A:** Küfür etti\n**B:** Birini rahatsız etti\n**C:** Sunucu kurallarına uymayarak hareket ediyor\n**D:** Bu kullanıcı fazla kez şikayet edildi\n**E:** Başka bir şey').setFooter({ text: `Hedef: ${id}` })],
      components: [row(...['A', 'B', 'C', 'D', 'E'].map(k => btn(`uy:${k}:${id}`, k, k === 'E' ? ButtonStyle.Primary : ButtonStyle.Secondary)))] });
  }

  /* ---- Eğlence ---- */
  if (['.ship', '.zeka', '.zekam', '.kapış', '.kapis'].includes(cmd)) {
    if (!isIn(msg.channel, C.fun)) return rep(msg, `⚠️ Bu komut sadece **${C.fun}** kanalında kullanılabilir.`);
    if (member.roles.cache.size <= 1) return rep(msg, 'Bu komutu kullanmak için bir role sahip olmalısın.');
    // arka arkaya komut -> yavaş mod
    const ft = (funTrack.get(msg.channel.id) || []).filter(t => Date.now() - t < 8000); ft.push(Date.now()); funTrack.set(msg.channel.id, ft);
    if (ft.length >= 3 && msg.channel.rateLimitPerUser < 5) {
      await msg.channel.setRateLimitPerUser(5, 'Komut spamı').catch(() => {});
      msg.channel.send('⏱️ Çok hızlı komut kullanıldı, kanal **5 saniye** yavaş moda alındı.');
    }
    try {
      if (cmd === '.zekam') return msg.reply({ files: [await zekamImage(member, uniqueRand('zekam', 500))] });
      if (cmd === '.zeka') {
        const all = await g.members.fetch(); const pool = all.filter(m => !m.user.bot);
        const pick = pool.random(); return msg.channel.send({ files: [await zekaImage(pick)] });
      }
      const t = msg.mentions.members.first();
      if (!t) return rep(msg, 'Lütfen bir kullanıcı etiketleyin.');
      if (cmd === '.ship') return msg.reply({ files: [await shipImage(member, t, uniqueRand('ship', 100))] });
      const winner = Math.random() < 0.5 ? member : t;
      return msg.reply({ content: `KAZANAN KİŞİ:\n**${winner.displayName}**`, files: [await kapisImage(member, t, winner)] });
    } catch (e) { console.error(e); return rep(msg, 'Görsel oluşturulurken bir hata oluştu.'); }
  }
});
const funTrack = new Map();

/* ===================== DM KOMUTLARI (sadece sahip) ===================== */
function sicilEmbed(id) {
  const g = client.guilds.cache.get(GUILD_ID), u = U(id), m = g?.members.cache.get(id);
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
  const roles = m ? [...m.roles.cache.values()].filter(r => r.id !== g.id) : [];
  const added = u.roleLog.filter(x => x.t === '+').map(x => `${x.name} — ${ts(x.at, 'd')}`);
  const removed = u.roleLog.filter(x => x.t === '-').map(x => `${x.name} — ${ts(x.at, 'd')}`);
  const tv = top(u.voice), tt = top(u.text);
  return new EmbedBuilder().setColor(0x2b2d31).setTitle(`📁 SİCİL — ${m?.user.tag || id}`).setThumbnail(m?.user.displayAvatarURL() || null)
    .addFields(
      { name: `Mevcut roller (${roles.length})`, value: cut(roles.map(r => `• **${r.name}** → ${ROLE_CMDS[r.name] || 'özel komut yok'}`).join('\n')) },
      { name: 'Silinen roller', value: cut(removed.slice(-15).join('\n')) },
      { name: 'Aldığı roller', value: cut(added.slice(-15).join('\n')) },
      { name: 'Sunucuya giriş tarihi', value: m?.joinedTimestamp ? ts(m.joinedTimestamp) : '—', inline: true },
      { name: 'Mahkemeye çıkarıldı', value: String(u.courts), inline: true },
      { name: 'Küfür etti', value: String(u.profanity), inline: true },
      { name: 'Banlanıp geri geldi', value: String(u.rejoin), inline: true },
      { name: 'Kicklendi', value: String(u.kicks), inline: true },
      { name: 'Şikayet edildi', value: String(u.complaints), inline: true },
      { name: 'Uyarıldı', value: String(u.warns), inline: true },
      { name: 'Karara itiraz', value: String(u.appeals), inline: true },
      { name: 'Susturduğu kişi', value: String(u.mutesGiven), inline: true },
      { name: 'Nuke attığı kanal sayısı', value: String(u.nukeChannels.length), inline: true },
      { name: 'Toplam nuke', value: String(u.nukes), inline: true },
      { name: 'En aktif ses kanalı', value: tv ? tv[0] : '—', inline: true },
      { name: 'En aktif sohbet kanalı', value: tt ? '#' + tt[0] : '—', inline: true });
}
async function handleDM(msg) {
  if (msg.author.id !== OWNER_ID) return; // başkasına cevap verme
  const [cmdRaw, ...args] = msg.content.trim().split(/\s+/), cmd = norm(cmdRaw);
  if (cmd === '.sicil') {
    const id = (args[0] || '').replace(/\D/g, ''); if (!id) return msg.reply('Kullanım: `.sicil <kullanıcı ID>`');
    if (U(id).hidden && norm(args[1] || '') !== 'göster') return msg.reply(`Bu sicil gizlenmiş. Görmek için: \`.sicil ${id} göster\``);
    return msg.channel.send({ embeds: [sicilEmbed(id)],
      components: [row(btn(`sc:ban:${id}`, 'KULLANICIYI BANLA', ButtonStyle.Danger), btn(`sc:clear:${id}`, 'SİCİLİ TEMİZLE', ButtonStyle.Primary), btn(`sc:hide:${id}`, 'SİCİLİ GİZLE'))] });
  }
  if (cmd === '.gizlenendosya') {
    if (args[0]) { const c = db.cases[args[0]]; return c ? msg.channel.send({ embeds: [caseEmbed(c)] }) : msg.reply('Dosya bulunamadı.'); }
    if (!db.hidden.length) return msg.reply('Gizlenmiş dosya yok.');
    for (const id of db.hidden) { const c = db.cases[id]; if (c) await msg.channel.send({ content: `Dosya ID: \`${id}\``, embeds: [caseEmbed(c)] }); }
    return;
  }
  if (cmd === '.yardım' || cmd === '.yardim') {
    return msg.channel.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🛠️ LEXO 1 — Komut Rehberi').addFields(
      { name: 'DM komutları (sadece sana özel)', value: '`.sicil <id>` → Kullanıcının tüm sunucu geçmişini gösterir (rol, mahkeme, küfür, uyarı, nuke, aktiflik...). Altında banla/temizle/gizle butonları çıkar.\n`.sicil <id> göster` → Gizlediğin bir sicili tekrar gösterir.\n`.gizlenendosya` → Log kanalında gizlediğin tüm küfür dosyalarını teker teker listeler.\n`.gizlenendosya <dosyaID>` → Tek bir dosyanın kopyasını gösterir.\n`.yardım` → Bu mesaj.' },
      { name: '! ile başlayan komutlar (çorum)', value: '`!kurallar` → Kurallar kanalına kural metnini gönderir.\n`!rolbilgiler` → rol-bilgilendirme kanalına rol açıklamalarını gönderir.\n`!bitir` → Mahkeme kanalında mahkemeyi bitirir, sanığın rollerini iade eder, kanalı siler.' },
      { name: '. ile başlayan komutlar', value: '`.nuke` → (nuke✅/çorum) Kanalı sıfırlar, onay butonu ister.\n`.mute @k` / `.unmute @k` → (chatyt✅/çorum) 3 dk susturur / kaldırır.\n`.yavaş 0-5` → (chatyt✅/çorum) Yavaş mod.\n`.sesegir <kanal>` / `.sestençık` → (çorum) Botu sese sokar/çıkarır.\n`.uyar <id>` → (çorum, log kanalı) Sebep seçmeli uyarı.\n`.kurulum` → (çorum) Rolleri ve kanal izinlerini kurar.\n`.ship @k`, `.zeka`, `.zekam`, `.kapış @k` → Eğlence kanalında, rolü olan herkes.\n`sa` → Bot "as hoşgeldin bra" der.' },
      { name: 'Otomatik sistemler', value: 'Küfür engeli + log dosyası, link silme, flood/spam analizi ve otomatik mute, anti-nuke (DM ile sana sorar), giriş kural onayı, susturma süresi dolunca otomatik kaldırma.' })] });
  }
}

/* ===================== ETKİLEŞİMLER ===================== */
client.on(Events.InteractionCreate, async i => {
  try {
    if (i.isModalSubmit()) {
      const [k, id] = i.customId.split(':');
      if (k === 'um') {
        if (!isCorum(i.member)) return i.reply({ content: 'Yetkin yok.', ...EPH });
        await warnUser(id, i.fields.getTextInputValue('r'), i.user);
        await i.reply('✅ Kullanıcı başarılı şekilde uyarıldı.'); i.message?.edit({ components: [] }).catch(() => {});
      }
      return;
    }
    if (!i.isButton()) return;
    const [k, a, b, c] = i.customId.split(':');

    if (k === 'nk') { // nuke onayı: sadece komutu yazan
      if (i.user.id !== b) return i.reply({ content: 'Bu butonu sadece komutu yazan kişi kullanabilir.', ...EPH });
      await i.deferUpdate();
      if (a === 'n') { await i.message.delete().catch(() => {}); return i.channel.send('Anlaşıldı!'); }
      const ch = i.channel, pos = ch.rawPosition;
      const u = U(i.user.id); u.nukes++; if (!u.nukeChannels.includes(ch.name)) u.nukeChannels.push(ch.name); save();
      const nc = await ch.clone(); await ch.delete(); await nc.setPosition(pos).catch(() => {});
      return nc.send(`${i.user} chat kanalını sıfırladı.`);
    }
    if (k === 'kabul') {
      if (i.user.id !== a) return i.reply({ content: 'Bu buton sana ait değil.', ...EPH });
      await i.deferUpdate();
      await i.member.roles.add(await ensureRole(i.guild, R.hayatsiz)).catch(() => {});
      await i.message.delete().catch(() => {});
      return (findChan(i.guild, C.chat) || i.channel).send(`${i.user} Hoşgeldin🎉`);
    }
    if (k === 'sk') { // mute şikayeti (DM)
      const user = i.user; U(user.id).complaints++; save();
      const owner = await client.users.fetch(OWNER_ID);
      await owner.send(`**${user.username}** sunucuda susturuldu.\nOnu susturan: <@${b}>\n\nBunun yanlış olduğu düşünülüyor, lütfen onunla iletişime geç.`).catch(() => {});
      return i.update({ content: i.message.content + '\n\n✅ Şikayetiniz yetkiliye iletildi.', components: [] });
    }
    if (k === 'lg') return logButton(i, a, b);
    if (k === 'uy') {
      if (!isCorum(i.member)) return i.reply({ content: 'Yetkin yok.', ...EPH });
      if (a === 'E') return i.showModal(new ModalBuilder().setCustomId(`um:${b}`).setTitle('Uyarma sebebi').addComponents(
        row(new TextInputBuilder().setCustomId('r').setLabel('Uyarma sebebi giriniz:').setStyle(TextInputStyle.Paragraph).setRequired(true))));
      const reasons = { A: 'Küfür etti', B: 'Birini rahatsız etti', C: 'Sunucu kurallarına uymayarak hareket ediyor', D: 'Bu kullanıcı fazla kez şikayet edildi' };
      await warnUser(b, reasons[a], i.user);
      return i.update({ content: '✅ Kullanıcı başarılı şekilde uyarıldı.', embeds: [], components: [] });
    }
    if (k === 'sc') {
      if (i.user.id !== OWNER_ID) return;
      if (a === 'ban') { await client.guilds.cache.get(GUILD_ID)?.members.ban(b, { reason: 'Sicil üzerinden banlandı' }).catch(() => {}); return i.reply('🔨 Kullanıcı banlandı.'); }
      if (a === 'clear') { delete db.users[b]; save(); return i.reply('🧹 Sicil temizlendi.'); }
      if (a === 'hide') { U(b).hidden = true; save(); return i.message.delete().catch(() => {}); } // veri silinmez, sadece gizlenir
    }
    if (k === 'an') {
      if (i.user.id !== OWNER_ID) return;
      const s = an.get(`${a}:${b}`); if (s) { clearTimeout(s.auto); s.resolved = true; s.at = Date.now(); }
      if (c === 'acil') { await i.update({ content: '🚨 Acil işlem başlatıldı.', components: [] }); return emergency(client.guilds.cache.get(a), b, 'acil'); }
      return i.update({ content: 'Anlaşıldı.', components: [] });
    }
  } catch (e) { console.error(e); }
});

async function warnUser(id, reason, by) {
  const u = U(id); u.warns++; u.notes.push({ at: Date.now(), text: `Uyarı: ${reason}`, by: by.id }); save();
  const user = await client.users.fetch(id).catch(() => null); user?.send(warnDM(reason)).catch(() => {});
}

/* ===================== OLAYLAR ===================== */
client.on(Events.GuildMemberAdd, async m => {
  if (m.user.bot) return;
  const u = U(m.id); if (u.bans > u.rejoin) { u.rejoin++; save(); }
  const ch = findChan(m.guild, C.rules); if (!ch) return;
  ch.send({ content: `${m}`, embeds: [rulesEmbed()], components: [row(btn(`kabul:${m.id}`, 'Kabul ediyorum', ButtonStyle.Success))] });
});
client.on(Events.GuildMemberUpdate, (o, n) => {
  const u = U(n.id);
  n.roles.cache.forEach(r => { if (!o.roles.cache.has(r.id)) u.roleLog.push({ t: '+', name: r.name, at: Date.now() }); });
  o.roles.cache.forEach(r => { if (!n.roles.cache.has(r.id)) u.roleLog.push({ t: '-', name: r.name, at: Date.now() }); });
  u.roleLog = u.roleLog.slice(-200); save();
});
client.on(Events.GuildBanAdd, b => { U(b.user.id).bans++; save(); });
client.on(Events.GuildMemberRemove, async m => {
  await sleep(800);
  const logs = await m.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 3 }).catch(() => null);
  if (logs?.entries.find(e => e.targetId === m.id && Date.now() - e.createdTimestamp < 8000)) { U(m.id).kicks++; save(); }
});
const vJoin = new Map();
client.on(Events.VoiceStateUpdate, (o, n) => {
  if (n.member?.user.bot) return;
  if (o.channelId && o.channelId !== n.channelId) {
    const st = vJoin.get(n.id);
    if (st) { const u = U(n.id); u.voice[st.name] = (u.voice[st.name] || 0) + Date.now() - st.t; vJoin.delete(n.id); save(); }
  }
  if (n.channelId && o.channelId !== n.channelId) vJoin.set(n.id, { t: Date.now(), name: n.channel.name });
});

/* ===================== ANTİ-NUKE ===================== */
const an = new Map();
async function who(g, types, targetId) {
  await sleep(700);
  for (const t of [].concat(types)) {
    const logs = await g.fetchAuditLogs({ type: t, limit: 6 }).catch(() => null);
    const e = logs?.entries.find(e => e.targetId === targetId && Date.now() - e.createdTimestamp < 15000);
    if (e) return e.executor;
  }
  return null;
}
function antiNuke(g, user, text) {
  if (!user || user.id === client.user.id || user.id === g.ownerId) return;
  const key = `${g.id}:${user.id}`; let s = an.get(key);
  if (s?.resolved && Date.now() - s.at > 60000) { an.delete(key); s = null; }
  if (s?.resolved) return;
  if (!s) { s = { actions: [] }; an.set(key, s); setTimeout(() => sendAlert(g, user, s), 1200); }
  s.actions.push(text);
}
async function sendAlert(g, user, s) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null); if (!owner) return;
  await owner.send({ content: `⚠️ **${user.username}** adlı kullanıcı ${s.actions.join(', ')}. Acil işlem yapılması gerekir mi?`,
    components: [row(btn(`an:${g.id}:${user.id}:acil`, 'ACİL İŞLEM BAŞLAT', ButtonStyle.Danger), btn(`an:${g.id}:${user.id}:bos`, 'BOŞVER', ButtonStyle.Success))] }).catch(() => {});
  s.auto = setTimeout(() => { if (!s.resolved) { s.resolved = true; s.at = Date.now(); emergency(g, user.id, 'bekle'); owner.send('⏱️ 5 saniye içinde cevap verilmedi, yetkiler çekildi ve kişi BEKLEME kanalına alındı.').catch(() => {}); } }, 5000);
}
async function emergency(g, id, mode) {
  const m = await g.members.fetch(id).catch(() => null); if (!m || id === g.ownerId) return;
  const ids = m.roles.cache.filter(r => r.id !== g.id && !r.managed).map(r => r.id);
  U(id).stripped = ids; save();
  await m.roles.remove(ids, 'Anti-nuke').catch(() => {});
  const role = await ensureRole(g, mode === 'acil' ? R.mahkum : R.bekleyen); await m.roles.add(role).catch(() => {});
  const corum = findRole(g, R.corum), allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory];
  const ch = await g.channels.create({ name: mode === 'acil' ? 'ceza-evi' : 'bekleme', type: ChannelType.GuildText,
    permissionOverwrites: [{ id: g.id, deny: [P.ViewChannel] }, { id: m.id, allow }, { id: client.user.id, allow },
      ...(corum ? [{ id: corum.id, allow }] : [])] });
  ch.send(mode === 'acil' ? `${m} Yetkileriniz çekildi ve ceza evine alındınız.` : `${m} Yetkileriniz çekildi. **çorum** yetkilisiyle görüşmeyi bekleyin.`);
}
client.on(Events.ChannelDelete, async ch => { if (!ch.guild || db.courts[ch.id]) return; antiNuke(ch.guild, await who(ch.guild, AuditLogEvent.ChannelDelete, ch.id), `${ch.name} kanalını sildi`); });
client.on(Events.GuildRoleDelete, async r => antiNuke(r.guild, await who(r.guild, AuditLogEvent.RoleDelete, r.id), `${r.name} rolünü sildi`));
const ovKey = c => JSON.stringify(c.permissionOverwrites?.cache.map(p => [p.id, String(p.allow.bitfield), String(p.deny.bitfield)]));
client.on(Events.ChannelUpdate, async (o, n) => {
  if (!n.guild) return;
  if (o.name === n.name && o.topic === n.topic && o.rateLimitPerUser === n.rateLimitPerUser && o.nsfw === n.nsfw && ovKey(o) === ovKey(n)) return;
  antiNuke(n.guild, await who(n.guild, [AuditLogEvent.ChannelUpdate, AuditLogEvent.ChannelOverwriteUpdate], n.id), `${n.name} kanalının ayarını değiştirdi`);
});

client.once(Events.ClientReady, c => console.log(`✅ ${c.user.tag} hazır.`));
client.login(process.env.TOKEN);
