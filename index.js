const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Partials,
    AuditLogEvent,
    Events
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration, // ban olaylarını yakalamak için gerekli
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// ======================= AYARLAR =======================
const YETKILI_ADLARI = { ciko: 'cikomiko0787', mvn: 'mvn_zuid010', fw: '4w7j' };
// İsterseniz ID'leri ortam değişkeni olarak verin (isim değişse bile sorun çıkmaz)
const yetkiliIdler = {
    ciko: process.env.CIKO_ID || null,
    mvn: process.env.MVN_ID || null,
    fw: process.env.FW_ID || null
};
const BEYIN_GORSELI = 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=600&auto=format&fit=crop';
const KAPIS_GORSELI = 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600&auto=format&fit=crop';

// Küfür listesi
const blacklist = [
    'sikeyim', 'sikim', 'skem', 'sikem', 'sikeyim', 'sıkm', 'sik', 'siker',
    'oç', 'orospu', 'orospu evladı', 'orosph çocuğu', 'oc',
    'ibne', 'ibine', 'piç', 'pezevenk', 'pzvnk',
    'yarrak', 'yrrm', 'yrm', 'yrk', 'yarak', 'yark',
    'aminakoydugum', 'amonakoydugum', 'amcikinaqoyim', 'aminakoyim', 'amcik', 'amcık',
    'anani', 'anasi', 'ananin', 'anneniyi', 'annenisikeyim', 'ananinami'
];

// ======================= VERİ =======================
const sicilVeritabani = new Map();
const mahkemeKanallari = new Map(); // kanalId -> sanıkId
const katilimZamanlari = new Map();
const bekleyenNuke = new Map();     // yapanId -> { zamanlayici, geriYukle[] }

function yeniSicil() {
    return {
        mahkemeSayisi: 0, uyarilar: [], sikayetSayisi: 0, susturmaSayisi: 0,
        banSayisi: 0, kickSayisi: 0, alinanRoller: [], cekilenRoller: [],
        sesGirisSesleri: [], sesGirisSayisi: 0, mesajSayisi: 0, kufurSayisi: 0,
        unmuteSayisi: 0, mutelemeSayisi: 0, nukeSayisi: 0, mesajSilmeSayisi: 0,
        takmaAdSayisi: 0, everyoneSayisi: 0, kufurUyariSayisi: 0,
        mahkemeSozleri: [], mahkemeKararlari: [], ozurSayisi: 0,
        gorusulenYetkililer: [], mahkemeGirisSaati: null, mahkemeChatSayisi: 0,
        gizliMi: false
    };
}

function getSicil(userId) {
    if (!sicilVeritabani.has(userId)) sicilVeritabani.set(userId, yeniSicil());
    return sicilVeritabani.get(userId);
}

// ======================= YARDIMCILAR =======================
const bekle = ms => new Promise(r => setTimeout(r, ms));
const anaSunucu = () => client.guilds.cache.first();

function cikoMu(user) {
    if (!user) return false;
    if (user.id === yetkiliIdler.ciko) return true;
    if (user.username.toLowerCase() === YETKILI_ADLARI.ciko) {
        yetkiliIdler.ciko = user.id;
        return true;
    }
    return false;
}

function yetkiliMi(member) {
    if (!member) return false;
    return cikoMu(member.user) ||
        member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
}

async function butonYetkisi(interaction) {
    if (cikoMu(interaction.user)) return true;
    const guild = interaction.guild || anaSunucu();
    const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
    return yetkiliMi(member);
}

async function kimlikleriCoz(guild) {
    await guild.members.fetch().catch(() => {});
    for (const [anahtar, kullaniciAdi] of Object.entries(YETKILI_ADLARI)) {
        if (!yetkiliIdler[anahtar]) {
            const m = guild.members.cache.find(x => x.user.username.toLowerCase() === kullaniciAdi);
            if (m) yetkiliIdler[anahtar] = m.id;
        }
    }
}

async function getSahipUser() {
    if (!yetkiliIdler.ciko) {
        const g = anaSunucu();
        if (g) await kimlikleriCoz(g);
    }
    if (!yetkiliIdler.ciko) return null;
    return client.users.fetch(yetkiliIdler.ciko).catch(() => null);
}

// Yetkililerin GÜNCEL kullanıcı adları (biri adını değiştirirse otomatik değişir)
async function yetkiliIsimleri() {
    const sonuc = [];
    for (const anahtar of ['ciko', 'mvn', 'fw']) {
        let isim = YETKILI_ADLARI[anahtar];
        if (yetkiliIdler[anahtar]) {
            const u = await client.users.fetch(yetkiliIdler[anahtar]).catch(() => null);
            if (u) isim = u.username;
        }
        sonuc.push(isim);
    }
    return sonuc;
}

async function denetimYapani(guild, type, hedefId) {
    await bekle(1000);
    const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
    if (!logs) return null;
    const e = logs.entries.find(x => x.target && x.target.id === hedefId && Date.now() - x.createdTimestamp < 10000);
    return e ? e.executor : null;
}

function parcala(metin, limit = 1900) {
    const parcalar = [];
    let kalan = metin;
    while (kalan.length > limit) {
        let kes = kalan.lastIndexOf('\n', limit);
        if (kes < 1) kes = limit;
        parcalar.push(kalan.slice(0, kes));
        kalan = kalan.slice(kes);
    }
    if (kalan.trim()) parcalar.push(kalan);
    return parcalar;
}

async function uzunGonder(hedef, metin) {
    for (const p of parcala(metin)) await hedef.send(p);
}

function kufurVarMi(icerik) {
    const kelimeler = icerik.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').split(/\s+/);
    for (const kelime of kelimeler) {
        const temiz = kelime.replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o').replace(/5/g, 's');
        if (!temiz) continue;
        for (const y of blacklist) {
            if (y.length <= 3) { if (temiz === y) return true; }
            else if (temiz.includes(y)) return true;
        }
    }
    return false;
}

// ======================= MAHKEME =======================
async function mahkemeAc(guild, hedefUye, acanKisi) {
    const sicil = getSicil(hedefUye.id);
    sicil.mahkemeSayisi++;
    sicil.mahkemeGirisSaati = new Date().toLocaleString('tr-TR');

    const eskiRoller = hedefUye.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => r.id);
    await hedefUye.roles.remove(eskiRoller).catch(() => {});

    const corumRolu = guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
    const izin = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages];
    const overwrites = [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: hedefUye.id, allow: izin },
        { id: client.user.id, allow: izin }
    ];
    if (corumRolu) overwrites.push({ id: corumRolu.id, allow: izin });
    if (yetkiliIdler.ciko) overwrites.push({ id: yetkiliIdler.ciko, allow: izin });

    const kanal = await guild.channels.create({
        name: `mahkeme-${hedefUye.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites
    });
    mahkemeKanallari.set(kanal.id, hedefUye.id);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mk_ban_${hedefUye.id}`).setLabel('BANLA').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`mk_kick_${hedefUye.id}`).setLabel('KİCKLE').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`mk_yetki_${hedefUye.id}`).setLabel('YETKİSİNİ ÇEK (sağ çıktı)').setStyle(ButtonStyle.Primary)
    );
    await kanal.send({
        content: `⚖️ **MAHKEME BAŞLATILDI!** Sanık: ${hedefUye}\nMahkemeyi başlatan: ${acanKisi}\n\n` +
                 `Banlanmadan/kicklenmeden sağ çıkarsa cezası **yetkisinin çekilmesi** olur ve en başa döner (hayatsız rolü).`,
        components: [row]
    });
    return kanal;
}

// ======================= ANTI-NUKE =======================
async function nukeBildir(guild, yapan, tur, geriYukle) {
    const mevcut = bekleyenNuke.get(yapan.id);
    if (mevcut) { mevcut.geriYukle.push(geriYukle); return; }

    const kayit = { geriYukle: [geriYukle], zamanlayici: null };
    bekleyenNuke.set(yapan.id, kayit);

    const sahip = await getSahipUser();
    if (sahip) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mass_islem_${yapan.id}`).setLabel('GEREKLİ İŞLEMLERİ BAŞLAT').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mass_bos_${yapan.id}`).setLabel('BOŞ VER').setStyle(ButtonStyle.Secondary)
        );
        await sahip.send({
            content: `ACİL!🚨\n\nKullanıcı ismi: ${yapan.user.tag}\nDiscord id: \`${yapan.id}\`\n\nBu kişi ${tur} sildi.`,
            components: [row]
        }).catch(() => {});
    }

    kayit.zamanlayici = setTimeout(async () => {
        bekleyenNuke.delete(yapan.id);
        try {
            const roller = yapan.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => r.id);
            await yapan.roles.remove(roller).catch(() => {});
            await yapan.timeout(24 * 60 * 60 * 1000, 'Acil Anti-Nuke: 7 saniyede yanıt verilmedi.').catch(() => {});
            for (const geri of kayit.geriYukle) await geri().catch(() => {});
            if (sahip) {
                await sahip.send(`⚠️ 7 saniye içinde yanıt verilmediği için <@${yapan.id}> kullanıcısının tüm yetkileri çekildi, 1 gün susturuldu ve silinenler geri getirildi.`).catch(() => {});
            }
        } catch (e) { console.error('anti-nuke hatası:', e); }
    }, 7000);
}

client.on(Events.ChannelDelete, async channel => {
    try {
        const guild = channel.guild;
        if (!guild) return;
        const executor = await denetimYapani(guild, AuditLogEvent.ChannelDelete, channel.id);
        if (!executor || executor.bot || cikoMu(executor) || executor.id === guild.ownerId) return;
        const yapan = await guild.members.fetch(executor.id).catch(() => null);
        if (!yapan) return;

        const geriYukle = async () => {
            const opts = {
                name: channel.name,
                type: channel.type,
                parent: channel.parentId || undefined,
                permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny }))
            };
            if (channel.type === ChannelType.GuildText) {
                opts.topic = channel.topic || undefined;
                opts.nsfw = channel.nsfw;
                opts.rateLimitPerUser = channel.rateLimitPerUser;
            }
            if (channel.type === ChannelType.GuildVoice) {
                opts.bitrate = channel.bitrate;
                opts.userLimit = channel.userLimit;
            }
            const yeni = await guild.channels.create(opts);
            await yeni.setPosition(channel.rawPosition).catch(() => {});
        };
        await nukeBildir(guild, yapan, '1 kanal', geriYukle);
    } catch (e) { console.error('channelDelete hatası:', e); }
});

client.on(Events.GuildRoleDelete, async role => {
    try {
        const guild = role.guild;
        const executor = await denetimYapani(guild, AuditLogEvent.RoleDelete, role.id);
        if (!executor || executor.bot || cikoMu(executor) || executor.id === guild.ownerId) return;
        const yapan = await guild.members.fetch(executor.id).catch(() => null);
        if (!yapan) return;

        const geriYukle = async () => {
            const yeni = await guild.roles.create({
                name: role.name, color: role.color, hoist: role.hoist,
                mentionable: role.mentionable, permissions: role.permissions
            });
            await yeni.setPosition(role.rawPosition).catch(() => {});
        };
        await nukeBildir(guild, yapan, '1 rol', geriYukle);
    } catch (e) { console.error('roleDelete hatası:', e); }
});

// ======================= SİCİL OLAYLARI =======================
client.on(Events.GuildBanAdd, async ban => {
    getSicil(ban.user.id).banSayisi++;
});

client.on(Events.GuildMemberRemove, async member => {
    try {
        katilimZamanlari.delete(member.id);
        await bekle(1000);
        const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
        const e = logs.entries.first();
        if (e && e.target && e.target.id === member.id && Date.now() - e.createdTimestamp < 10000) {
            getSicil(member.id).kickSayisi++;
        }
    } catch (e) {}
});

client.on(Events.GuildMemberUpdate, async (eski, yeni) => {
    try {
        if (eski.partial) return;
        const sicil = getSicil(yeni.id);
        yeni.roles.cache.forEach(r => {
            if (r.id !== yeni.guild.id && !eski.roles.cache.has(r.id)) sicil.alinanRoller.push(r.name);
        });
        eski.roles.cache.forEach(r => {
            if (r.id !== yeni.guild.id && !yeni.roles.cache.has(r.id)) sicil.cekilenRoller.push(r.name);
        });
        if (eski.nickname !== yeni.nickname) {
            const yapan = await denetimYapani(yeni.guild, AuditLogEvent.MemberUpdate, yeni.id);
            if (yapan && !yapan.bot && yapan.id !== yeni.id) getSicil(yapan.id).takmaAdSayisi++;
        }
    } catch (e) {}
});

client.on(Events.MessageDelete, async msg => {
    try {
        if (!msg.guild || !msg.author || msg.author.bot) return;
        const yapan = await denetimYapani(msg.guild, AuditLogEvent.MessageDelete, msg.author.id);
        if (yapan && !yapan.bot && yapan.id !== msg.author.id) getSicil(yapan.id).mesajSilmeSayisi++;
    } catch (e) {}
});

client.on(Events.VoiceStateUpdate, async (eski, yeni) => {
    try {
        if (!yeni.member || yeni.member.user.bot || !yeni.channelId) return;
        if (eski.channelId === yeni.channelId) return; // sadece kanal değişimi / giriş
        const member = yeni.member;
        const sicil = getSicil(member.id);
        sicil.sesGirisSayisi++;
        if (yeni.channel && !sicil.sesGirisSesleri.includes(yeni.channel.name)) sicil.sesGirisSesleri.push(yeni.channel.name);
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator) && member.roles.cache.size <= 1) {
            await member.voice.disconnect('Kurallar onaylanmadı.');
        }
    } catch (e) {}
});

// ======================= READY =======================
client.once(Events.ClientReady, async () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Gelişmiş Güvenlik Sistemleri');

    const guild = anaSunucu();
    if (guild) await kimlikleriCoz(guild);

    // 3 gün inaktiflik (zombi hesap) kontrolü
    setInterval(async () => {
        const g = anaSunucu();
        if (!g) return;
        const simdi = Date.now();
        for (const [userId, zaman] of [...katilimZamanlari.entries()]) {
            if (simdi - zaman < 259200000) continue;
            const member = await g.members.fetch(userId).catch(() => null);
            katilimZamanlari.delete(userId);
            if (!member) continue;
            if (getSicil(userId).mesajSayisi > 0) continue;

            const sahip = await getSahipUser();
            if (!sahip) continue;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`inactive_taniyorum_${userId}`).setLabel('Bu kullanıcıyı tanıyorum').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`inactive_eminim_${userId}`).setLabel('Bilmiyorum ama gerçek').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`inactive_supheli_${userId}`).setLabel('Bilmiyorum ve emin değilim').setStyle(ButtonStyle.Danger)
            );
            await sahip.send({
                content: `KULLANICI:\nDISCORD ID: \`${userId}\` (${member.user.tag})\n\n3 gün boyunca sunucuda herhangi bir aktiflik sağlamadı.`,
                components: [row]
            }).catch(() => {});
        }
    }, 3600000);
});

client.on(Events.GuildMemberAdd, async member => {
    try {
        katilimZamanlari.set(member.id, Date.now());
        const kurallarKanal = member.guild.channels.cache.find(c => c.name === 'kurallar');
        if (!kurallarKanal) return;
        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('📜 Sunucu Kurallarına Hoş Geldin!')
            .setDescription('Sunucumuzun tamamını görebilmek ve sohbet edebilmek için lütfen aşağıdaki **✅ Kabul Ediyorum** butonuna tıkla.');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kabul_et_${member.id}`).setLabel('✅ Kabul Ediyorum').setStyle(ButtonStyle.Success)
        );
        await kurallarKanal.send({ content: `${member}`, embeds: [embed], components: [row] });
    } catch (err) { console.error('guildMemberAdd hatası:', err); }
});

// ======================= BUTONLAR =======================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    try {
        const id = interaction.customId;
        const parts = id.split('_');

        // ---------- İnaktif kullanıcı (DM) ----------
        if (id.startsWith('inactive_')) {
            const secim = parts[1];
            const hedefId = parts[2];
            if (secim === 'taniyorum') return interaction.update({ content: 'Anlaşıldı!', components: [] });
            if (secim === 'eminim') return interaction.update({ content: 'Tamamdır!', components: [] });
            if (secim === 'supheli') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`supheli_sure_evet_${hedefId}`).setLabel('EVET').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`supheli_sure_hayir_${hedefId}`).setLabel('HAYIR').setStyle(ButtonStyle.Secondary)
                );
                return interaction.update({ content: 'Şüpheli olarak görüyorsanız kullanıcıya süre vermeme izin verin.', components: [row] });
            }
            return;
        }

        if (id.startsWith('supheli_sure_')) {
            const karar = parts[2];
            const hedefId = parts[3];
            const guild = anaSunucu();
            if (karar === 'hayir') return interaction.update({ content: 'Anladım!', components: [] });
            if (karar === 'evet') {
                const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
                if (hedefUye) {
                    let rol = guild.roles.cache.find(r => r.name === '1');
                    if (!rol) rol = await guild.roles.create({ name: '1', color: '#ffa500', permissions: [] });
                    await hedefUye.roles.add(rol).catch(() => {});

                    setTimeout(async () => {
                        const g = anaSunucu();
                        const guncel = g ? await g.members.fetch(hedefId).catch(() => null) : null;
                        if (!guncel || getSicil(hedefId).mesajSayisi > 0) return;
                        const sahip = await getSahipUser();
                        if (!sahip) return;
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`kickban_kick_${hedefId}`).setLabel('KİCKLE').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`kickban_ban_${hedefId}`).setLabel('BANLA').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId(`kickban_bos_${hedefId}`).setLabel('BAŞINI BOŞ BIRAK').setStyle(ButtonStyle.Success)
                        );
                        await sahip.send({ content: `Verilen süre doldu.\nKullanıcı ID: \`${hedefId}\``, components: [row] }).catch(() => {});
                    }, 86400000);
                }
                return interaction.update({ content: '✅ Kullanıcıya 1 günlük deneme süresi ("1" rolü) verildi.', components: [] });
            }
            return;
        }

        if (id.startsWith('kickban_')) {
            const aksiyon = parts[1];
            const hedefId = parts[2];
            if (aksiyon === 'bos') return interaction.update({ content: 'Başı boş bırakıldı.', components: [] });
            const guild = anaSunucu();
            const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
            if (!hedefUye) return interaction.update({ content: 'Kullanıcı sunucuda yok.', components: [] });
            if (aksiyon === 'kick') {
                await hedefUye.kick('Süre doldu, aktiflik sağlanmadı.');
                return interaction.update({ content: 'Kullanıcı kicklendi.', components: [] });
            }
            if (aksiyon === 'ban') {
                await hedefUye.ban({ reason: 'Süre doldu, aktiflik sağlanmadı.' });
                return interaction.update({ content: 'Kullanıcı banlandı.', components: [] });
            }
            return;
        }

        // ---------- Anti-nuke (DM) ----------
        if (id.startsWith('mass_islem_') || id.startsWith('mass_bos_')) {
            const aksiyon = parts[1];
            const hedefId = parts[2];
            const bekleyen = bekleyenNuke.get(hedefId);
            if (bekleyen) { clearTimeout(bekleyen.zamanlayici); bekleyenNuke.delete(hedefId); }
            if (aksiyon === 'bos') return interaction.update({ content: 'Boş verildi.', components: [] });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`mahkeme_baslat_${hedefId}`).setLabel('MAHKEME').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`direk_ban_${hedefId}`).setLabel('BANLA').setStyle(ButtonStyle.Danger)
            );
            return interaction.update({ content: 'İşlem seçin:', components: [row] });
        }

        if (id.startsWith('mahkeme_baslat_')) {
            const hedefId = parts[2];
            const guild = anaSunucu();
            const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
            if (!hedefUye) return interaction.update({ content: '❌ Üye sunucuda bulunamadı.', components: [] });
            const kanal = await mahkemeAc(guild, hedefUye, `<@${interaction.user.id}>`);
            return interaction.update({ content: `⚖️ Mahkeme kanalı açıldı: ${kanal}`, components: [] });
        }

        if (id.startsWith('direk_ban_')) {
            const hedefId = parts[2];
            const guild = anaSunucu();
            const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
            if (hedefUye) await hedefUye.ban({ reason: 'Mass-delete güvenliği.' });
            return interaction.update({ content: '🔨 Kullanıcı banlandı.', components: [] });
        }

        // ---------- Şikayet doğru / yanlış ----------
        if (id.startsWith('sikayet_evet_') || id.startsWith('sikayet_hayir_')) {
            if (!(await butonYetkisi(interaction))) {
                return interaction.reply({ content: '❌ Bu butonlara yalnızca **çorum** rolüne sahip kişiler basabilir!', ephemeral: true });
            }
            const karar = parts[1];
            const sikayetEdenId = parts[2];
            const hedefId = parts[3];
            const guild = interaction.guild;

            if (karar === 'hayir') {
                const eden = await guild.members.fetch(sikayetEdenId).catch(() => null);
                if (eden) {
                    getSicil(eden.id).uyarilar.push({ sebep: 'Sahte şikayet', tarih: new Date().toLocaleString('tr-TR'), yetkili: 'Lexo (şikayet reddi)' });
                    const [i1, i2, i3] = await yetkiliIsimleri();
                    const metin =
                        `⚠️ ${eden}\n\n` +
                        `ŞİKAYETİNİZ GEÇERSİZ KILINDI.\n` +
                        `Sahte şikayet yaptığınızı düşünüyoruz, yanlış düşünüyorsak "çorum" rolüne sahip biriyle iletişime geçin.\n` +
                        `Eğer yetkili bulamadıysanız:\n${i1}\n${i2}\n${i3}\nkişilere DM'den acil şekilde ulaşın.`;
                    // Herkese açık olmaması için önce DM; olmazsa chat'e yazıp kısa süre sonra siler
                    const dm = await eden.send(metin).catch(() => null);
                    if (!dm) {
                        const chat = guild.channels.cache.find(c => ['chat', 'sohbet', 'genel'].includes(c.name.toLowerCase()));
                        if (chat) {
                            const m = await chat.send(metin).catch(() => null);
                            if (m) setTimeout(() => m.delete().catch(() => {}), 30000);
                        }
                    }
                }
                return interaction.update({ content: '❌ Şikayet geçersiz kılındı ve şikayet eden uyarıldı.', components: [] });
            }

            if (karar === 'evet') {
                const hedefUye = await guild.members.fetch(hedefId).catch(() => null);
                if (!hedefUye) return interaction.update({ content: '❌ Şikayet edilen kullanıcı bulunamadı.', components: [] });
                const kanal = await mahkemeAc(guild, hedefUye, `<@${interaction.user.id}>`);
                await kanal.send('Şikayeti doğruladınız.\nKanıtları elinizde tutun.');
                return interaction.update({ content: `✅ Şikayet doğrulandı ve mahkeme kanalı açıldı: ${kanal}`, components: [] });
            }
            return;
        }

        // ---------- Mahkeme paneli ----------
        if (id.startsWith('mk_')) {
            if (!(await butonYetkisi(interaction))) return interaction.reply({ content: '❌ Yetkiniz yok!', ephemeral: true });
            const aksiyon = parts[1];
            const hedefId = parts[2];
            const guild = interaction.guild;
            const hedefUye = await guild.members.fetch(hedefId).catch(() => null);
            const sicil = getSicil(hedefId);
            const kanal = interaction.channel;
            const imza = `${interaction.user.tag} (${interaction.user.id})`;

            if (!hedefUye) return interaction.update({ content: '❌ Sanık sunucuda bulunamadı.', components: [] });

            if (aksiyon === 'ban') {
                sicil.mahkemeKararlari.push(`BAN - karar veren: ${imza}`);
                await interaction.update({ content: '🔨 Karar: BAN. Kanal 10 sn içinde kapanacak.', components: [] });
                await hedefUye.ban({ reason: 'Mahkeme kararı.' }).catch(() => {});
            } else if (aksiyon === 'kick') {
                sicil.mahkemeKararlari.push(`KICK - karar veren: ${imza}`);
                await interaction.update({ content: '👢 Karar: KICK. Kanal 10 sn içinde kapanacak.', components: [] });
                await hedefUye.kick('Mahkeme kararı.').catch(() => {});
            } else if (aksiyon === 'yetki') {
                sicil.mahkemeKararlari.push(`YETKİSİ ÇEKİLDİ (+1 uyarı, hayatsız rolüne döndü) - karar veren: ${imza}`);
                sicil.uyarilar.push({ sebep: 'Mahkeme: yetkisi çekildi', tarih: new Date().toLocaleString('tr-TR'), yetkili: interaction.user.tag });
                const hayatsiz = guild.roles.cache.find(r => r.name.toLowerCase() === 'hayatsız');
                const roller = hedefUye.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => r.id);
                await hedefUye.roles.remove(roller).catch(() => {});
                if (hayatsiz) await hedefUye.roles.add(hayatsiz).catch(() => {});
                await interaction.update({ content: '📉 Karar: Yetkisi çekildi, en başa döndü. Kanal 10 sn içinde kapanacak.', components: [] });
            } else return;

            mahkemeKanallari.delete(kanal.id);
            setTimeout(() => kanal.delete().catch(() => {}), 10000);
            return;
        }

        // ---------- Küfür log paneli ----------
        if (id.startsWith('kufur_')) {
            if (!(await butonYetkisi(interaction))) {
                return interaction.reply({ content: '❌ Bu butonlara yalnızca **çorum** rolüne sahip olanlar basabilir!', ephemeral: true });
            }
            const islem = parts[1];
            const hedefId = parts[2];
            const guild = interaction.guild;
            const hedefUye = await guild.members.fetch(hedefId).catch(() => null);
            const sicil = getSicil(hedefId);

            if (islem === 'uyar') {
                sicil.uyarilar.push({ sebep: 'Küfür tespiti', tarih: new Date().toLocaleString('tr-TR'), yetkili: interaction.user.tag });
                sicil.kufurUyariSayisi++;
                return interaction.update({ content: `⚠️ Kullanıcı uyarıldı ve siciline işlendi.`, components: [] });
            }
            if (!hedefUye) return interaction.update({ content: '❌ Üye sunucuda bulunamadı.', components: [] });
            if (islem === 'ban') {
                await hedefUye.ban({ reason: 'Küfür log paneli.' });
                return interaction.update({ content: '🔨 Banlandı!', components: [] });
            }
            if (islem === 'kick') {
                await hedefUye.kick('Küfür log paneli.');
                return interaction.update({ content: '👢 Atıldı!', components: [] });
            }
            if (islem === 'mute') {
                sicil.susturmaSayisi++;
                getSicil(interaction.user.id).mutelemeSayisi++;
                await hedefUye.timeout(3 * 60 * 1000, 'Küfür susturması.');
                return interaction.update({ content: '🔇 3 dakika susturuldu!', components: [] });
            }
            if (islem === 'mahkeme') {
                const kanal = await mahkemeAc(guild, hedefUye, `<@${interaction.user.id}>`);
                return interaction.update({ content: `⚖️ Mahkeme kanalı açıldı: ${kanal}`, components: [] });
            }
            return;
        }

        // ---------- Kural kabul ----------
        if (id.startsWith('kabul_et_')) {
            if (interaction.user.id !== parts[2]) return interaction.reply({ content: '❌ Başkasının yerine basamazsın.', ephemeral: true });
            await interaction.deferUpdate();
            const hayatsiz = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'hayatsız');
            if (hayatsiz) await interaction.member.roles.add(hayatsiz).catch(() => {});
            await interaction.followUp({ content: '✅ Kuralları kabul ettin!', ephemeral: true });
            return;
        }

        // ---------- Sicil butonları ----------
        if (id.startsWith('sicil_')) {
            if (!(await butonYetkisi(interaction))) return interaction.reply({ content: '❌ Yetkiniz yok!', ephemeral: true });
            const aksiyon = parts[1];
            const hedefId = parts[2];
            const guild = interaction.guild || anaSunucu();
            const sicil = getSicil(hedefId);

            if (aksiyon === 'gizle') {
                sicil.gizliMi = true;
                return interaction.update({ content: '🔒 Sicil gizlendi.', components: [] });
            }
            if (aksiyon === 'temizle') {
                sicilVeritabani.set(hedefId, yeniSicil());
                return interaction.update({ content: '🧹 Sicil temizlendi!', components: [] });
            }
            if (aksiyon === 'islem') {
                const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
                if (!hedefUye) return interaction.reply({ content: '❌ Üye bulunamadı.', ephemeral: true });
                await hedefUye.ban({ reason: 'Kırmızı sicil.' });
                return interaction.update({ content: '🚨 Kullanıcı banlandı.', components: [] });
            }
        }
    } catch (err) {
        console.error('interaction hatası:', err);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: '❌ Bir hata oluştu (botun yetkilerini kontrol edin).', ephemeral: true }).catch(() => {});
        }
    }
});

// ======================= YARDIM METNİ =======================
function yardimMetni() {
    return [
        '📖 **LEXO BOT - TÜM KOMUTLAR**',
        '(Not: Botta `!` ile başlayan komut yoktur, tüm komutlar `.` ile başlar.)',
        '',
        '━━━━━━━━ 🔒 DM KOMUTLARI (sadece cikomiko0787) ━━━━━━━━',
        '',
        '**.yardım**',
        'Şu an okuduğun menü. Botun tüm komutlarını ve ne işe yaradıklarını uzun uzun anlatır. Sadece cikomiko0787 bota özel mesajdan yazarsa çalışır.',
        '',
        '**.sicil <Discord ID>**',
        'Verdiğin Discord ID\'sine sahip kullanıcının detaylı sicil dosyasını DM\'den gönderir: kaç kere uyarıldı, susturuldu, banlandı, kicklendi, mahkemeye çıkarıldı, hangi rolleri aldı/kaybetti, hangi ses kanallarına kaç kere girdi, sunucuya giriş tarihi, kaç kişiyi şikayet etti, mute/unmute/nuke/mesaj silme/takma ad/@everyone sayıları, küfürden kaç kere uyarıldı ve mahkemede yazdıkları. Sicil rengi (beyaz, yeşil, turuncu, kırmızı, siyah) toplam cezaya göre otomatik belirlenir. Altındaki butonlarla "gerekli işlemleri uygula" (ban), "sicili temizle" ve "sicili gizle" yapabilirsin. Başka biri bu komutu kullanamaz.',
        '',
        '**.mahkemearşiv** (veya `.mahkemearşiv <ID>`)',
        'Bot önce "Kimin mahkeme arşivini görmek istersiniz?" diye sorar, sen Discord ID\'sini yazarsın. Bot da şunları gönderir: mahkemeye giriş saati, mahkemede yazdığı her şey, doğrulanmış karar ve kararı veren kişinin adı + ID\'si, dilediği özür sayısı, görüştüğü yetkililer ve mahkemede kaç kere chat yaptığı.',
        '',
        '━━━━━━━━ 🎮 EĞLENCE KOMUTLARI (sadece #eğlence kanalında) ━━━━━━━━',
        '',
        '**.zeka**',
        'Sunucudaki botlar hariç herkesin arasından rastgele birini seçer ve "Sunucunun en zeki elemanı" ilan eder.',
        '',
        '**.zekam** veya **.zekam @kullanıcı**',
        'Etiketlenen kişinin (etiket yoksa yazanın) IQ\'sunu 0 ile 500 arasında rastgele bir sayıyla ölçer. Üstte IQ değeri, solda profil fotoğrafı ve kullanıcı adı, altta beyin görseli olan bir kart atar.',
        '',
        '**.ship @kullanıcı**',
        'Komutu yazan kişi ile etiketlenen kişi arasında 0%-100% arası rastgele aşk uyumu hesaplar. Sağda yazanın, solda etiketlenenin profili, ortada aşk yüzdesi görünür.',
        '',
        '**.kapış @kullanıcı1 @kullanıcı2**',
        'İki kişiyi boks ringinde kapıştırır ve rastgele bir galip ilan eder.',
        '',
        '━━━━━━━━ 🛡️ YÖNETİM KOMUTLARI (sunucuda) ━━━━━━━━',
        '',
        '**.yavaş <0-5>**',
        'Bulunduğun kanalın yavaş modunu saniye olarak ayarlar (0 = kapatır). Sadece çorum, chatyt✅, 📿 rolü veya yönetici kullanabilir.',
        '',
        '**.sesegir <ses kanalı adı>**',
        'Botu yazdığın isimdeki ses kanalına sokar. Sadece çorum rolü veya yönetici kullanabilir.',
        '',
        '**.mute @kullanıcı**',
        'Etiketlenen kişiyi 3 dakika susturur (timeout) ve sicilindeki susturulma sayısını 1 artırır. Susturan kişinin "kaç kişiyi mutelediği" sayısı da artar. Yetki: çorum, chatyt✅ veya yönetici.',
        '',
        '**.unmute @kullanıcı**',
        'Etiketlenen kişinin susturmasını kaldırır; yapan kişinin "kaç kişiyi unmute yaptığı" sayısı artar. Yetki: çorum, chatyt✅ veya yönetici.',
        '',
        '**.nuke**',
        'Bulunduğun kanalı onay butonuyla sıfırlar (kanalı klonlayıp eskisini siler). Nuke atan kişinin sicilindeki sayı artar. Yetki: çorum, nuke✅ veya yönetici.',
        '',
        '━━━━━━━━ 📌 OTOMATİK SİSTEMLER ━━━━━━━━',
        '',
        '**#log kanalında şikayet:** cikomiko0787 `ŞİKAYETEDENID şikayet ettiği HEDEFID` yazarsa bot "Bu şikayet doğru mu?" diye sorar. EVET (sadece çorum rolü basabilir) → şikayet edilen kişinin rolleri alınır ve özel mahkeme kanalı açılır. HAYIR → şikayet eden sahte şikayetten uyarılır ve bilgilendirilir.',
        '**Küfür filtresi:** Küfür eden mesaj silinir, #log kanalına bilgileriyle düşer; altında UYAR / MAHKEME / MUTE AT / BANLA / KİCKLE butonları çıkar (sadece çorum basabilir).',
        '**Mahkeme:** Kanalda BANLA / KİCKLE / YETKİSİNİ ÇEK butonları vardır. Sağ çıkan kişinin yetkisi çekilir ve hayatsız rolüne döner.',
        '**Anti-nuke:** Biri kanal veya rol silerse cikomiko0787\'ye acil DM gider. 7 saniye içinde cevap verilmezse kişinin tüm yetkileri çekilir, 1 gün timeout yer ve silinen kanal/rol geri getirilir.',
        '**3 gün inaktiflik:** Yeni gelip 3 gün boyunca hiç yazmayan kişi için cikomiko0787\'ye DM gelir (tanıyorum / gerçek / şüpheli). Şüpheliyse "1" rolüyle 1 gün süre verilir; süre dolunca KİCKLE / BANLA / BAŞINI BOŞ BIRAK seçenekleri sunulur.'
    ].join('\n');
}

// ======================= MESAJLAR =======================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    const msgContent = message.content || '';

    // ---------- DM ----------
    if (!message.guild) {
        const argsDM = msgContent.trim().split(/ +/);
        const cmdDM = (argsDM.shift() || '').toLowerCase();
        const ciko = cikoMu(message.author);

        if (cmdDM === '.yardım' || cmdDM === '.yardim') {
            if (!ciko) return message.reply('❌ Bu komutu sadece sunucu sahibi cikomiko0787 kullanabilir!');
            await uzunGonder(message.channel, yardimMetni());
            return;
        }

        if (cmdDM === '.sicil') {
            if (!ciko) return message.reply('❌ Bu komutu sadece cikomiko0787 kullanabilir!');
            const hedefId = argsDM[0];
            if (!hedefId) return message.reply('❌ Lütfen Discord ID yazın!');
            try {
                const hedefUser = await client.users.fetch(hedefId);
                const guild = anaSunucu();
                const hedefMember = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
                return gosterSicil(message, hedefUser, hedefMember);
            } catch (e) {
                return message.reply('❌ Kullanıcı bulunamadı!');
            }
        }

        if (cmdDM === '.mahkemearşiv' || cmdDM === '.mahkemearşivi' || cmdDM === '.mahkemearsiv') {
            if (!ciko) return message.reply('❌ Bu komutu sadece cikomiko0787 kullanabilir!');

            const goster = async hedefId => {
                const sicil = sicilVeritabani.get(hedefId);
                if (!sicil) return message.channel.send('❌ Bu ID\'ye ait kayıtlı mahkeme arşivi bulunamadı.');
                let tag = hedefId;
                try { tag = (await client.users.fetch(hedefId)).tag; } catch (e) {}
                const metin =
                    `📜 **MAHKEME ARŞİVİ - ${tag}**\n\n` +
                    `• Mahkemeye giriş saati: ${sicil.mahkemeGirisSaati || 'Bilinmiyor'}\n` +
                    `• Mahkemede neler yazdığı:\n${sicil.mahkemeSozleri.join('\n') || 'Konuşma kaydı yok.'}\n\n` +
                    `• Doğrulanmış karar ve kararı veren kişi (isim + ID): ${sicil.mahkemeKararlari.join(' | ') || 'Karar yok.'}\n` +
                    `• Mahkemede dilediği özür sayısı: **${sicil.ozurSayisi}**\n` +
                    `• Görüştüğü yetkililer: ${sicil.gorusulenYetkililer.join(', ') || 'Bilinmiyor'}\n` +
                    `• Mahkemede kaç kere chat yaptığı: **${sicil.mahkemeChatSayisi}**`;
                await uzunGonder(message.channel, metin);
            };

            if (argsDM[0]) return goster(argsDM[0]);

            await message.reply('Kimin mahkeme arşivini görmek istersiniz?');
            const collector = message.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, time: 60000, max: 1 });
            collector.on('collect', async m => { await goster(m.content.trim()); });
            return;
        }
        return;
    }

    // ---------- SUNUCU ----------
    if (!message.member) return;
    const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
    const cikoMesaji = cikoMu(message.author);
    const kanalAdi = message.channel.name.toLowerCase();

    // Küfür filtresi
    if (!adminMi && !cikoMesaji && kufurVarMi(msgContent)) {
        getSicil(message.author.id).kufurSayisi++;
        try { await message.delete(); } catch (e) {}

        const logKanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
        if (logKanal) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`kufur_uyar_${message.author.id}`).setLabel('UYAR').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`kufur_mahkeme_${message.author.id}`).setLabel('MAHKEME').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`kufur_mute_${message.author.id}`).setLabel('MUTE AT').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`kufur_ban_${message.author.id}`).setLabel('BANLA').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`kufur_kick_${message.author.id}`).setLabel('KİCKLE').setStyle(ButtonStyle.Secondary)
            );
            await logKanal.send({
                content: `🚨 **Küfür Tespiti!**\n` +
                         `• Kullanıcı: ${message.author} (${message.author.tag})\n` +
                         `• Discord ID: \`${message.author.id}\`\n` +
                         `• Kanal: ${message.channel}\n` +
                         `• Zaman: ${new Date().toLocaleString('tr-TR')}\n` +
                         `• Küfür: ||${msgContent}||`,
                components: [row]
            });
        }
        return;
    }

    const sicil = getSicil(message.author.id);
    sicil.mesajSayisi++;
    if (msgContent.includes('@everyone')) sicil.everyoneSayisi++;

    // Mahkeme kanalı kayıtları
    if (mahkemeKanallari.has(message.channel.id)) {
        const sanikId = mahkemeKanallari.get(message.channel.id);
        const sanikSicil = getSicil(sanikId);
        if (message.author.id === sanikId) {
            sanikSicil.mahkemeSozleri.push(`[${new Date().toLocaleTimeString('tr-TR')}] ${message.author.tag}: ${msgContent}`);
            sanikSicil.mahkemeChatSayisi++;
            if (/(özür|ozur|pardon|af edin|affedin|kusura bakma)/i.test(msgContent.toLocaleLowerCase('tr-TR'))) sanikSicil.ozurSayisi++;
        } else if (yetkiliMi(message.member)) {
            const etiket = `${message.author.tag} (${message.author.id})`;
            if (!sanikSicil.gorusulenYetkililer.includes(etiket)) sanikSicil.gorusulenYetkililer.push(etiket);
        }
    }

    // Şikayet kontrolü (#log kanalında cikomiko0787 yazarsa)
    if (cikoMesaji && kanalAdi === 'log') {
        const eslesme = msgContent.toLocaleLowerCase('tr-TR').match(/(\d{5,22})\s*şikayet\s+ettiği\s*(\d{5,22})/);
        if (eslesme) {
            const [, sikayetEdenId, hedefId] = eslesme;
            getSicil(sikayetEdenId).sikayetSayisi++;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sikayet_evet_${sikayetEdenId}_${hedefId}`).setLabel('EVET').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`sikayet_hayir_${sikayetEdenId}_${hedefId}`).setLabel('HAYIR').setStyle(ButtonStyle.Danger)
            );
            return message.reply({ content: 'Bu şikayet doğru mu?', components: [row] });
        }
    }

    // Komutlar
    if (!msgContent.startsWith('.')) return;
    const args = msgContent.trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    const eglenceKomutlari = ['.zeka', '.zekam', '.ship', '.kapış', '.kapis'];
    if (eglenceKomutlari.includes(cmd) && kanalAdi !== 'eğlence' && kanalAdi !== 'eglence') {
        return message.reply('❌ Bu komutlar sadece **#eğlence** kanalında kullanılabilir!');
    }

    // ----- Eğlence -----
    if (cmd === '.zeka') {
        await message.guild.members.fetch().catch(() => {});
        const uyeler = [...message.guild.members.cache.filter(m => !m.user.bot).values()];
        if (!uyeler.length) return message.reply('❌ Kimse bulunamadı!');
        const secilen = uyeler[Math.floor(Math.random() * uyeler.length)];
        return message.channel.send(`👑 Sunucunun en zeki elemanı: ${secilen}`);
    }

    if (cmd === '.zekam') {
        const hedef = message.mentions.users.first() || message.author;
        const iq = cikoMu(hedef) ? 700 : Math.floor(Math.random() * 501); // 0-500
        const embed = new EmbedBuilder()
            .setColor('#2ed573')
            .setAuthor({ name: hedef.username, iconURL: hedef.displayAvatarURL() })
            .setTitle(`🧠 IQ: ${iq}`)
            .setDescription(`📊 **${hedef.username}** adlı kişinin zeka seviyesi: \`${iq} IQ\``)
            .setImage(BEYIN_GORSELI);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === '.ship') {
        const hedef = message.mentions.users.first();
        if (!hedef) return message.reply('❌ Lütfen shiplemek için bir kullanıcı etiketle! Örnek: `.ship @kullanici`');
        const yuzde = Math.floor(Math.random() * 101);
        const dolu = Math.round(yuzde / 10);
        const cubuk = '❤️'.repeat(dolu) + '🖤'.repeat(10 - dolu);
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setTitle('💖 Aşk Testi (.ship) 💕')
            .setAuthor({ name: hedef.username, iconURL: hedef.displayAvatarURL() })          // sol: etiketlenen
            .setThumbnail(message.author.displayAvatarURL())                                  // sağ: yazan
            .setDescription(`💘 **${message.author.username}** ❤️ **${hedef.username}**\n\n${cubuk}\n\n✨ **Uyum Yüzdesi:** \`%${yuzde}\` ✨`);
        return message.channel.send({ embeds: [embed] });
    }

    if (cmd === '.kapış' || cmd === '.kapis') {
        const etiketlenenler = [...message.mentions.users.values()];
        if (etiketlenenler.length < 2) return message.reply('❌ Lütfen iki kullanıcı etiketleyin! Örnek: `.kapış @kullanici1 @kullanici2`');
        const kazanan = etiketlenenler[Math.floor(Math.random() * 2)];
        const embed = new EmbedBuilder()
            .setColor('#ffa502')
            .setTitle('🥊 BOKS RİNGİ KAPIŞMASI 🥊')
            .setDescription(`${etiketlenenler[0]} 🆚 ${etiketlenenler[1]}\n\nBu kavganın galibi net **${kazanan}**'dir, çok iyi dövüşüyor maşAllah. 🏆`)
            .setImage(KAPIS_GORSELI);
        return message.channel.send({ embeds: [embed] });
    }

    // ----- Yönetim -----
    if (cmd === '.yavaş' || cmd === '.yavas') {
        const yetkili = corumVarmi || adminMi || message.member.roles.cache.some(r => ['chatyt✅', '📿'].includes(r.name.toLowerCase()));
        if (!yetkili) return message.reply('❌ Yetkiniz yok!');
        const sure = parseInt(args[0]);
        if (isNaN(sure) || sure < 0 || sure > 5) return message.reply('❌ 0 ile 5 arasında girin!');
        await message.channel.setRateLimitPerUser(sure);
        return message.reply(sure === 0 ? '✅ Yavaş mod kaldırıldı.' : `✅ Yavaş mod ${sure} saniye yapıldı.`);
    }

    if (cmd === '.sesegir') {
        if (!adminMi && !corumVarmi) return message.reply('❌ Yetkiniz yok!');
        const ad = args.join(' ').trim();
        const kanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === ad.toLowerCase() && c.type === ChannelType.GuildVoice);
        if (!kanal) return message.reply('❌ Bulunamadı!');
        try {
            joinVoiceChannel({ channelId: kanal.id, guildId: message.guild.id, adapterCreator: message.guild.voiceAdapterCreator });
            return message.channel.send('✅ Sese girildi.');
        } catch (e) { return message.reply('❌ Sese girilemedi.'); }
    }

    if (cmd === '.mute' || cmd === '.unmute') {
        const chatyt = message.member.roles.cache.some(r => r.name.toLowerCase() === 'chatyt✅');
        if (!(adminMi || corumVarmi || chatyt)) return message.reply('❌ Yetkiniz yok!');
        const hedef = message.mentions.members.first();
        if (!hedef) return message.reply('❌ Kullanıcı etiketleyin!');
        try {
            if (cmd === '.mute') {
                getSicil(hedef.id).susturmaSayisi++;
                sicil.mutelemeSayisi++;
                await hedef.timeout(3 * 60 * 1000, 'Mutelendi');
                return message.channel.send(`✅ ${hedef.user.username} 3 dakika susturuldu.`);
            }
            sicil.unmuteSayisi++;
            await hedef.timeout(null, 'Açıldı');
            return message.channel.send(`✅ ${hedef.user.username} susturması kaldırıldı.`);
        } catch (err) {
            console.error(err);
            return message.reply('❌ İşlem yapılamadı (botun yetkisini kontrol edin).');
        }
    }

    if (cmd === '.nuke') {
        const nukeYetkisi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'nuke✅');
        if (!(adminMi || corumVarmi || nukeYetkisi)) return message.reply('❌ Yetkiniz yok!');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nuke_evet').setLabel('Evet, Sıfırla').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('nuke_hayir').setLabel('İptal').setStyle(ButtonStyle.Secondary)
        );
        const onay = await message.channel.send({ content: `⚠️ ${message.author}, bu kanalı sıfırlamak istediğine emin misin?`, components: [row] });
        const collector = onay.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 20000 });
        collector.on('collect', async i => {
            if (i.customId === 'nuke_evet') {
                await i.update({ content: '🔥 Kanal nuke\'leniyor...', components: [] });
                try {
                    sicil.nukeSayisi++;
                    const yeni = await message.channel.clone({ position: message.channel.position });
                    await message.channel.delete();
                    await yeni.send(`✅ Kanal ${message.author} tarafından sıfırlandı.`);
                } catch (err) { console.error(err); }
            } else {
                await i.update({ content: '❌ Nuke iptal edildi.', components: [] });
            }
            collector.stop();
        });
        return;
    }
});

// ======================= SİCİL GÖSTERME =======================
async function gosterSicil(message, hedefUser, hedefMember) {
    const sicil = getSicil(hedefUser.id);
    const guild = anaSunucu();

    let mevcutRoller = 'Rolü yok';
    if (hedefMember && guild) {
        mevcutRoller = hedefMember.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).join(', ') || 'Rolü yok';
    }

    let renkBaslik = 'BEYAZ\nHarika tertemiz bir sicil';
    let embedRenk = 0xFFFFFF;
    const toplamCeza = sicil.uyarilar.length + sicil.mahkemeSayisi + sicil.susturmaSayisi + sicil.banSayisi;
    if (toplamCeza >= 8) { renkBaslik = 'SİYAH SİCİL\nAcil ban gerekir.'; embedRenk = 0x000000; }
    else if (toplamCeza >= 5) { renkBaslik = 'KIRMIZI\nYönetici gözetiminde'; embedRenk = 0xFF0000; }
    else if (toplamCeza >= 3) { renkBaslik = 'TURUNCU\nDüzeltilmesi gerek.'; embedRenk = 0xFFA500; }
    else if (toplamCeza >= 1) { renkBaslik = 'YEŞİL\nGüzel bir sicil'; embedRenk = 0x008000; }

    const giris = hedefMember && hedefMember.joinedAt ? hedefMember.joinedAt.toLocaleString('tr-TR') : 'Bilinmiyor';
    const sozler = sicil.mahkemeSozleri.slice(-10).join('\n') || 'Kayıt yok';

    let aciklama =
        `**SİCİL DURUMU:**\n${renkBaslik}\n\n` +
        `• Discord ID: \`${hedefUser.id}\`\n` +
        `• Mevcut Rolleri: **${mevcutRoller}**\n` +
        `• Bir yetkili tarafından kaç kere uyarıldığı: **${sicil.uyarilar.length}**\n` +
        `• Sunucuda kaç kere susturulduğu: **${sicil.susturmaSayisi}**\n` +
        `• Kaç tane rol aldığı: **${sicil.alinanRoller.length}** (${sicil.alinanRoller.join(', ') || 'Yok'})\n` +
        `• Kaç kere banlandı: **${sicil.banSayisi}**\n` +
        `• Kaç kere kicklendi: **${sicil.kickSayisi}**\n` +
        `• Kaç kere mahkemeye çıkarıldı: **${sicil.mahkemeSayisi}**\n` +
        `• Mahkemede adına verilen kararlar: ${sicil.mahkemeKararlari.join(', ') || 'Yok'}\n` +
        `• Kaç rolü alındığı: **${sicil.cekilenRoller.length}** (${sicil.cekilenRoller.join(', ') || 'Yok'})\n` +
        `• Sese giriş sayısı ve kanalları: **${sicil.sesGirisSayisi}** (${sicil.sesGirisSesleri.join(', ') || 'Yok'})\n` +
        `• Sunucuya giriş tarihi: ${giris}\n` +
        `• Kaç kişiyi şikayet ettiği: **${sicil.sikayetSayisi}**\n` +
        `• Kaç kişiyi mutelediği: **${sicil.mutelemeSayisi}**\n` +
        `• Kaç kişiyi unmute yaptığı: **${sicil.unmuteSayisi}**\n` +
        `• Kaç kez Nuke attığı: **${sicil.nukeSayisi}**\n` +
        `• Kaç kere üye mesajı sildiği: **${sicil.mesajSilmeSayisi}**\n` +
        `• Takma ad verme sayısı: **${sicil.takmaAdSayisi}**\n` +
        `• @everyone tagı atma sayısı: **${sicil.everyoneSayisi}**\n` +
        `• Küfürden dolayı uyarıldığı: **${sicil.kufurUyariSayisi}**\n` +
        `• Mahkemede neler dedi (son 10):\n${sozler}`;
    if (aciklama.length > 4000) aciklama = aciklama.slice(0, 3990) + '…';

    const embed = new EmbedBuilder()
        .setTitle(`📜 ${hedefUser.tag} - DETAYLI SİCİL DOSYASI`)
        .setColor(embedRenk)
        .setDescription(aciklama);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sicil_islem_${hedefUser.id}`).setLabel('GEREKLİ İŞLEMLERİ UYGULA').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`sicil_temizle_${hedefUser.id}`).setLabel('SİCİLİ TEMİZLE').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sicil_gizle_${hedefUser.id}`).setLabel('SİCİLİ GİZLE').setStyle(ButtonStyle.Secondary)
    );
    return message.channel.send({ embeds: [embed], components: [row] });
}

// ======================= KEEP-ALIVE =======================
http.createServer((req, res) => { res.writeHead(200); res.end('Lexo Gelişmiş Sistem Aktif!\n'); }).listen(process.env.PORT || 3000);

client.on('error', e => console.error('Client hatası:', e));
process.on('unhandledRejection', e => console.error('Yakalanmayan hata:', e));

client.login(process.env.DISCORD_TOKEN);
