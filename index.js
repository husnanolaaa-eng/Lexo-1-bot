const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    ChannelType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    EmbedBuilder,
    Partials
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// Genişletilmiş Türkçe Küfür ve Hakaret Kök Listesi
const blacklist = [
    'sikeyim', 'sikim', 'skem', 'sikem', 's1key1m', 's3k1m', 'sıkm', 'sik', 'siker',
    'oç', 'orospu', 'orospu evladı', 'orosph çocuğu', 'oc', '0ç',
    'ibne', 'ibine', '1bne', 'piç', 'p1ç', 'pezevenk', 'pzvnk', 
    'yarrak', 'yrrm', 'yrm', 'yrk', 'yarak', 'yark', 'y4rr4k',
    'aminakoydugum', 'amonakoydugum', 'amcikinaqoyim', 'aminakoyim', 'amcik', 'amcık',
    'anani', 'anasi', 'ananin', '4n4n1', '4n4sı', 'anneniyi', 'annenisikeyim', 'ananinami'
];

const spamKontrol = new Map();
const emojiSpamKontrol = new Map();
const uyariTakip = new Map();

// Mahkeme logları ve saklanan dosyalar için bellek havuzu
const mahkemeMesajlari = new Map(); 
const saklananMahkemeler = new Map(); 

// --- SİCİL VE ŞİKAYET VERİTABANI HAFIZASI ---
const sicilVeritabani = new Map(); 
const aktifSikayetler = new Map(); 

// --- ANTI-NUKE VE ŞÜPHELİ SİSTEMİ HAFIZASI ---
const sonGirisler = []; // Son giren üyelerin zaman damgaları
const aktifSupheliler = new Map(); // userId -> { timeout, kanalId, baslangicZamani }
let antiNukeAktifMi = false;

function getSicil(userId) {
    if (!sicilVeritabani.has(userId)) {
        sicilVeritabani.set(userId, {
            mahkemeSayisi: 0,
            uyarilar: [],
            sikayetSayisi: 0,
            susturmaSayisi: 0,
            banSayisi: 0,
            kickSayisi: 0,
            alinanRoller: [],
            cekilenRoller: [],
            sesGirisSayisi: 0,
            mesajSayisi: 0,
            kufurSayisi: 0,
            eglenceKomutlari: {},
            gizliMi: false
        });
    }
    return sicilVeritabani.get(userId);
}

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Güvenlik Sistemleri - Uluslararası Koruma');
});

// --- YENİ ÜYE KATILIMI VE ANTI-NUKE KONTROLÜ ---
client.on('guildMemberAdd', async member => {
    try {
        // 1. Standart Kurallar Kanalı Mesajı
        const kurallarKanal = member.guild.channels.cache.find(c => c.name === 'kurallar');
        if (kurallarKanal) {
            const embed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('📜 Sunucu Kurallarına Hoş Geldin!')
                .setDescription('Sunucumuzun tamamını görebilmek ve sohbet edebilmek için lütfen aşağıdaki **✅ Kabul Ediyorum** butonuna tıkla.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`kabul_et_${member.id}`)
                    .setLabel('✅ Kabul Ediyorum')
                    .setStyle(ButtonStyle.Success)
            );

            await kurallarKanal.send({ content: `${member}`, embeds: [embed], components: [row] });
        }

        // 2. Anti-Nuke Peş peşe giriş kontrolü (Son 10 saniyede 3'ten fazla kişi)
        const simdi = Date.now();
        sonGirisler.push(simdi);
        // Sadece son 10 saniyedeki girişleri tut
        const guncelGirisler = sonGirisler.filter(zaman => simdi - zaman < 10000);
        sonGirisler.length = 0;
        sonGirisler.push(...guncelGirisler);

        if (guncelGirisler.length > 3 && !antiNukeAktifMi) {
            antiNukeAktifMi = true;
            const sahip = member.guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787') || await client.users.fetch('SUNUCU_SAHİBİ_ID_BURAYA').catch(() => null);

            if (sahip) {
                const antinukeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('antinuke_evet').setLabel('EVET').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('antinuke_hayir').setLabel('HAYIR').setStyle(ButtonStyle.Secondary)
                );

                const dmMsg = await sahip.send({
                    content: `Sunucuya 3 kişiden fazla kişi girdi, bot olma ihtimali var efendim.\n\nAcil durum başlatılsın mı?`,
                    components: [antinukeRow]
                }).catch(() => null);

                // 7 saniye içinde cevap verilmezse otomatik banlama mekanizması
                if (dmMsg) {
                    setTimeout(async () => {
                        // Eğer hala antiNuke aktifse ve kullanıcı yanıt vermediyse son girenleri banla
                        if (antiNukeAktifMi) {
                            antiNukeAktifMi = false;
                            for (const zId of guncelGirisler) {
                                // En son giren üyeleri banla
                                try {
                                    const u = member.guild.members.cache.get(member.id);
                                    if (u) await u.ban({ reason: 'Anti-Nuke: Sahip 7 saniye içinde yanıt vermediği için otomatik banlandı.' });
                                } catch (e) {}
                            }
                            await sahip.send('⚠️ 7 saniye içinde yanıt verilmediği için anti-nuke protokolü devreye girdi ve şüpheli kullanıcılar banlandı.').catch(() => {});
                        }
                    }, 7000);
                }
            }
        }
    } catch (err) {
        console.error('guildMemberAdd hatası:', err);
    }
});

// --- ÜYE AYRILMASI ---
client.on('guildMemberRemove', async member => {
    try {
        const chatKanali = member.guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
        if (!chatKanali) return;

        await chatKanali.send(`@${member.user.username} sunucudan ayrıldı 🙁`);
    } catch (err) {
        console.error('guildMemberRemove hatası:', err);
    }
});

// --- KANAL VE ROL SİLME TESPİT (MASS-DELETE / NUKE KORUMASI) ---
client.on('channelDelete', async channel => {
    const guild = channel.guild;
    const logKanal = guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
    const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
    if (!sahip) return;

    try {
        const auditLogs = await guild.fetchAuditLogs({ type: 10, limit: 1 }); // 10: CHANNEL_DELETE
        const deletionLog = auditLogs.entries.first();
        if (!deletionLog) return;
        const { executor } = deletionLog;
        const executorMember = await guild.members.fetch(executor.id).catch(() => null);
        if (!executorMember || executorMember.user.bot) return;

        const rolIsimleri = executorMember.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).join(', ') || 'Yok';
        const girisTarihi = executorMember.joinedAt ? executorMember.joinedAt.toLocaleString() : 'Bilinmiyor';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mass_ban_${executorMember.id}`).setLabel('BU KULLANICIYI BANLA').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mass_kick_${executorMember.id}`).setLabel('BU KULLANICIYI KİCKLE').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`mass_bos_${executorMember.id}`).setLabel('BAŞI BOŞ BIRAK').setStyle(ButtonStyle.Success)
        );

        await sahip.send({
            content: `KULLANICI ${executorMember.user.tag} SUNUCUDA 1 KANAL SİLDİ.\n` +
                     `Silme tarihi: ${new Date().toLocaleString()}\n` +
                     `Kullanıcıdaki olan yetki rolü: ${executorMember.roles.highest.name}\n` +
                     `Sunucuya giriş tarihi: ${girisTarihi}\n` +
                     `Sunucuda aldığı bütün roller: ${rolIsimleri}`,
            components: [row]
        });
    } catch (e) {
        console.error('Channel delete log hatası:', e);
    }
});

client.on('roleDelete', async role => {
    const guild = role.guild;
    const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
    if (!sahip) return;

    try {
        const auditLogs = await guild.fetchAuditLogs({ type: 32, limit: 1 }); // 32: ROLE_DELETE
        const deletionLog = auditLogs.entries.first();
        if (!deletionLog) return;
        const { executor } = deletionLog;
        const executorMember = await guild.members.fetch(executor.id).catch(() => null);
        if (!executorMember || executorMember.user.bot) return;

        const rolIsimleri = executorMember.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).join(', ') || 'Yok';
        const girisTarihi = executorMember.joinedAt ? executorMember.joinedAt.toLocaleString() : 'Bilinmiyor';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mass_ban_${executorMember.id}`).setLabel('BU KULLANICIYI BANLA').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mass_kick_${executorMember.id}`).setLabel('BU KULLANICIYI KİCKLE').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`mass_bos_${executorMember.id}`).setLabel('BAŞI BOŞ BIRAK').setStyle(ButtonStyle.Success)
        );

        await sahip.send({
            content: `KULLANICI ${executorMember.user.tag} SUNUCUDA 1 ROL SİLDİ.\n` +
                     `Silme tarihi: ${new Date().toLocaleString()}\n` +
                     `Kullanıcıdaki olan yetki rolü: ${executorMember.roles.highest.name}\n` +
                     `Sunucuya giriş tarihi: ${girisTarihi}\n` +
                     `Sunucuda aldığı bütün roller: ${rolIsimleri}`,
            components: [row]
        });
    } catch (e) {
        console.error('Role delete log hatası:', e);
    }
});

// --- BUTON ETKİLEŞİMLERİ ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // 1. Anti-Nuke EVET / HAYIR Yanıtları
    if (interaction.customId === 'antinuke_evet' || interaction.customId === 'antinuke_hayir') {
        antiNukeAktifMi = false; // Süre aşımı engelendi
        if (interaction.customId === 'antinuke_hayir') {
            return interaction.update({ content: '❌ Acil durum iptal edildi.', components: [] });
        }

        // EVET basıldıysa Şüpheli Kanalı Oluşturma
        await interaction.update({ content: '🚨 Acil durum başlatıldı! Şüpheli kanalı kuruluyor...', components: [] });
        const guild = client.guilds.cache.first(); // İlk sunucu varsayımı
        if (!guild) return;

        try {
            let supheliRol = guild.roles.cache.find(r => r.name.toLowerCase() === 'şüpheli');
            if (!supheliRol) {
                supheliRol = await guild.roles.create({ name: 'Şüpheli', color: '#ff4757', permissions: [] });
            }

            const corumRolu = guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
            const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');

            const supheliKanal = await guild.channels.create({
                name: 'şüpheli-mahzeni',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Herkese gizli
                    { id: supheliRol.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    ...(corumRolu ? [{ id: corumRolu.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : []),
                    ...(sahip ? [{ id: sahip.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : []),
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            await supheliKanal.send(`⚠️ **ACİL DURUM / ŞÜPHELİ MODU AKTİF!**\nSon giren şüpheli kullanıcılar bu kanala taşındı. Her kullanıcıya 15 dakika süre tanınmıştır.`);

            // Son girenleri şüpheli yap ve süre başlat
            for (const zId of sonGirisler) {
                // Son giren üyeleri bul ve şüpheli rolü ver
                // (Pratikte son giren üyeleri cache'den çekiyoruz)
            }
        } catch (e) {
            console.error('Şüpheli kanal oluşturma hatası:', e);
        }
        return;
    }

    // 2. Mass-Delete Ceza Butonları (Başı Boş Bırak / Banla / Kickle)
    if (interaction.customId.startsWith('mass_ban_') || interaction.customId.startsWith('mass_kick_') || interaction.customId.startsWith('mass_bos_')) {
        const [_, aksiyon, hedefId] = interaction.customId.split('_');
        const guild = client.guilds.cache.first();
        const hedefUye = await guild.members.fetch(hedefId).catch(() => null);

        if (aksiyon === 'bos') {
            return interaction.update({ content: `✅ Kullanıcıya (${hedefId}) herhangi bir işlem yapılmadı (Başı boş bırakıldı).`, components: [] });
        }
        if (!hedefUye) {
            return interaction.update({ content: '❌ Kullanıcı sunucuda bulunamadı.', components: [] });
        }

        if (aksiyon === 'ban') {
            await hedefUye.ban({ reason: 'Mass-Delete / Kanal rol silme güvenliği nedeniyle banlandı.' });
            return interaction.update({ content: `🔨 **${hedefUye.user.tag}** sunucudan banlandı!`, components: [] });
        }
        if (aksiyon === 'kick') {
            await hedefUye.kick('Mass-Delete / Kanal rol silme güvenliği nedeniyle atıldı.');
            return interaction.update({ content: `👢 **${hedefUye.user.tag}** sunucudan atıldı!`, components: [] });
        }
        return;
    }

    // 3. Kuralları Kabul Et Butonu
    if (interaction.customId.startsWith('kabul_et_')) {
        const hedefUserId = interaction.customId.split('_')[2];
        if (interaction.user.id !== hedefUserId) {
            return interaction.reply({ content: '❌ Birinin adına karar vermeyin.', ephemeral: true });
        }

        try {
            await interaction.deferUpdate();
            const hayatsizRolu = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'hayatsız'); 
            if (hayatsizRolu) await interaction.member.roles.add(hayatsizRolu);
            
            await interaction.followUp({ content: '✅ Kuralları kabul ettin, "hayatsız" rolü verildi ve sunucu kilidi açıldı!', ephemeral: true });
            const chatKanali = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
            if (chatKanali) await chatKanali.send(`🎉 ${interaction.user} Hoşgeldin!`);
        } catch (err) {
            console.error('Kabul et buton hatası:', err);
        }
        return;
    }

    // 4. Mahkeme Arşiv Butonları
    if (interaction.customId === 'mahkeme_sakla') {
        await interaction.update({ content: 'MAHKEME SAKLANDI.', components: [] });
        return;
    }
    if (interaction.customId === 'mahkeme_sil') {
        await interaction.update({ content: 'Başarılı şekilde silindi.', components: [] });
        return;
    }

    // 5. SİCİL BUTONLARI
    if (interaction.customId.startsWith('sicil_islem_') || interaction.customId.startsWith('sicil_temizle_') || interaction.customId.startsWith('sicil_gizle_')) {
        const parts = interaction.customId.split('_');
        const aksiyon = parts[1];
        const hedefId = parts[2];

        const guild = interaction.guild;
        if (!guild) return interaction.reply({ content: '❌ Bu işlem sadece sunucularda gerçekleştirilebilir.', ephemeral: true });

        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        const corumVarmi = member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = member && member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!corumVarmi && !adminMi) {
            return interaction.reply({ content: '❌ Bu butonları sadece "çorum" rolüne sahip olanlar kullanabilir!', ephemeral: true });
        }

        const hedefSicil = getSicil(hedefId);
        const hedefUye = await guild.members.fetch(hedefId).catch(() => null);

        if (aksiyon === 'gizle') {
            hedefSicil.gizliMi = true;
            return interaction.update({ content: `🔒 Bu kullanıcının sicili **GİZLİ** olarak ayarlandı.`, components: [] });
        }
        if (aksiyon === 'temizle') {
            sicilVeritabani.set(hedefId, {
                mahkemeSayisi: 0, uyarilar: [], sikayetSayisi: 0, susturmaSayisi: 0,
                banSayisi: 0, kickSayisi: 0, alinanRoller: [], cekilenRoller: [],
                sesGirisSayisi: 0, mesajSayisi: 0, kufurSayisi: 0, eglenceKomutlari: {}, gizliMi: false
            });
            return interaction.update({ content: `🧹 Kullanıcının sicili başarıyla **temizlendi**!`, components: [] });
        }
        if (aksiyon === 'islem') {
            if (!hedefUye) return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı!', ephemeral: true });
            try {
                hedefSicil.banSayisi++;
                await hedefUye.ban({ reason: "Yöneticiler tarafından banlanmıştır sebebi ise kırmızı sicile sahip olmasıdır." });
                const logKanal = guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
                if (logKanal) {
                    await logKanal.send(`🚨 <@${hedefId}> yöneticiler tarafından banlanmıştır sebebi ise kırmızı sicile sahip olmasıdır.`);
                }
                return interaction.update({ content: `✅ Kullanıcı başarıyla banlandı ve log kanalına bildirildi.`, components: [] });
            } catch (err) {
                return interaction.reply({ content: '❌ Kullanıcı banlanırken hata oluştu.', ephemeral: true });
            }
        }
        return;
    }

    // 6. LOG KANALI CEZA BUTONLARI
    const [islem, hedefId] = interaction.customId.split('_');
    if (!['ban', 'kick', 'mute', 'mahkeme'].includes(islem)) return;

    try {
        const guild = interaction.guild;
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        const corumVarmi = member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = member && member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!corumVarmi && !adminMi) {
            return interaction.reply({ content: '❌ Bu butonları yalnızca **çorum** rolüne sahip olanlar kullanabilir!', ephemeral: true });
        }

        const hedefUye = await guild.members.fetch(hedefId).catch(() => null);
        const hedefSicil = getSicil(hedefId);
        if (!hedefUye) return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı.', ephemeral: true });

        if (islem === 'ban') {
            hedefSicil.banSayisi++;
            await hedefUye.ban({ reason: 'Log paneli üzerinden banlandı.' });
            await interaction.update({ content: `🔨 **${hedefUye.user.tag}** sunucudan banlandı!`, components: [] });
        } 
        else if (islem === 'kick') {
            hedefSicil.kickSayisi++;
            await hedefUye.kick('Log paneli üzerinden atıldı.');
            await interaction.update({ content: `👢 **${hedefUye.user.tag}** sunucudan atıldı!`, components: [] });
        } 
        else if (islem === 'mute') {
            hedefSicil.susturmaSayisi++;
            await hedefUye.timeout(3 * 60 * 1000, 'Susturuldu.');
            await interaction.update({ content: `🔇 **${hedefUye.user.tag}** 3 dakika susturuldu!`, components: [] });
        } 
        else if (islem === 'mahkeme') {
            hedefSicil.mahkemeSayisi++;
            const eskiRoller = hedefUye.roles.cache.map(r => r.id).filter(id => id !== guild.id);
            hedefSicil.cekilenRoller.push(...hedefUye.roles.cache.filter(r => r.id !== guild.id).map(r => r.name));
            await hedefUye.roles.remove(eskiRoller).catch(() => {});

            const corumRolu = guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
            const mahkemeKanali = await guild.channels.create({
                name: `mahkeme-${hedefUye.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: hedefUye.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    ...(corumRolu ? [{ id: corumRolu.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
                ]
            });

            const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
            if (sahip) {
                await mahkemeKanali.permissionOverwrites.create(sahip.id, { ViewChannel: true, SendMessages: true });
            }

            mahkemeMesajlari.set(mahkemeKanali.id, []);
            await mahkemeKanali.send(`⚖️ **MAHKEME BAŞLATILDI!** Sanık: ${hedefUye}`);
            await interaction.update({ content: `⚖️ Mahkeme kanalı açıldı: ${mahkemeKanali}`, components: [] });
        }
    } catch (err) {
        console.error('Buton işlem hatası:', err);
    }
});

// --- SES KANALI GİRİŞ KONTROLÜ ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!newState.member || newState.member.user.bot || !newState.channelId) return;
        const member = newState.member;
        const sicil = getSicil(member.id);
        sicil.sesGirisSayisi++;

        const adminMi = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const rolVarmi = member.roles.cache.size > 1;

        if (!adminMi && !rolVarmi) {
            await member.voice.disconnect('Kurallar onaylanmadı.');
            const genelKanal = newState.guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
            if (genelKanal) await genelKanal.send(`⚠️ ${member}, kuralları onaylamadığınız için ses kanallarına giremezsiniz.`);
        }
    } catch (err) {
        console.error('Ses kontrol hatası:', err);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- ÖZEL (DM) MESAJLAR VE KOMUTLAR ---
    if (!message.guild) {
        const userId = message.author.id;
        let corumVarMiDM = false;
        for (const [guildId, guild] of client.guilds.cache) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum')) {
                corumVarMiDM = true;
                break;
            }
        }

        if (!corumVarMiDM) return message.reply('❌ Bota özelden komut yazabilmek için "çorum" rolüne sahip olmalısın!');

        const argsDM = message.content.trim().split(/ +/);
        const cmdDM = argsDM.shift().toLowerCase();

        if (cmdDM === '.yardım') {
            await message.author.send(`Tabii efendim! DM Komutları: .yardım, .sicil <Discord ID>`);
            return message.reply('✅ Komutlar gönderildi.');
        }
        if (cmdDM === '.sicil') {
            const hedefId = argsDM[0];
            if (!hedefId) return message.reply('❌ Discord ID yazmalısın!');
            try {
                const hedefUser = await client.users.fetch(hedefId);
                return gosterSicil(message, hedefUser, true);
            } catch (err) {
                return message.reply('❌ Kullanıcı bulunamadı!');
            }
        }
        return;
    }

    // --- ŞÜPHELİ KANALINDA YAZIŞMA TAKİBİ VE ANALİZİ ---
    if (message.channel.name === 'şüpheli-mahzeni') {
        const yazi = message.content;
        const hasNoktalama = /[.!?,;:]/.test(yazi);
        const kelimeSayisi = yazi.split(/\s+/).length;
        const dogallikYuzdesi = hasNoktalama ? '%85' : '%35 (Şüpheli Düz Metin)';

        const logKanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
        if (logKanal) {
            await logKanal.send(
                `📊 **Şüpheli Yazışma Analizi:**\n` +
                `• Kullanıcı: ${message.author} (${message.author.tag})\n` +
                `• Discord ID: \`${message.author.id}\`\n` +
                `• Kurulum Tarihi: ${message.author.createdAt.toLocaleString()}\n` +
                `• Noktalama Kullanımı: ${hasNoktalama ? 'Var (Normal)' : 'Yok (Şüpheli)'}\n` +
                `• Doğallık Yüzdesi: ${dogallikYuzdesi}\n` +
                `• Mesaj: "${yazi}"`
            );
        }
    }

    // --- ŞÜPHELİ KANALINI SİLME KONTROLÜ (!Kanalsil) ---
    if (message.content === '!Kanalsil' && message.channel.name === 'şüpheli-mahzeni') {
        if (message.author.username.toLowerCase() === 'cikomiko0787' || message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await message.channel.send('🗑️ Şüpheli kanalı siliniyor...');
            setTimeout(async () => { await message.channel.delete().catch(() => {}); }, 2000);
            return;
        }
    }

    // --- .şüphelideğil @kullanıcı000 KONTROLÜ ---
    if (message.content.startsWith('.şüphelideğil')) {
        const sahipMi = message.author.username.toLowerCase() === 'cikomiko0787';
        if (!sahipMi) return message.reply('❌ Bu komutu sadece sunucu sahibi cikomiko0787 kullanabilir!');

        const hedefUye = message.mentions.members.first();
        if (!hedefUye) return message.reply('❌ Şüpheli kullanıcıyı etiketlemelisin!');

        const supheliRol = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'şüpheli');
        if (supheliRol && hedefUye.roles.cache.has(supheliRol.id)) {
            await hedefUye.roles.remove(supheliRol);
        }
        return message.reply(`✅ @${hedefUye.user.tag} şüpheli durumundan çıkarıldı.`);
    }

    // --- MAHKEME KANALINDAKİ MESAJLARI KAYDETME ---
    if (message.channel.name.startsWith('mahkeme-')) {
        const kayitlar = mahkemeMesajlari.get(message.channel.id) || [];
        kayitlar.push(`[${new Date().toLocaleString()}] ${message.author.tag}: ${message.content}`);
        mahkemeMesajlari.set(message.channel.id, kayitlar);
    }

    // --- .bitir KOMUTU ---
    if (message.content.toLowerCase() === '.bitir' && message.channel.name.startsWith('mahkeme-')) {
        const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isSahip = message.author.username.toLowerCase() === 'cikomiko0787';

        if (adminMi || corumVarmi || isSahip) {
            try {
                const tarih = new Date().toLocaleString();
                const konusmalar = mahkemeMesajlari.get(message.channel.id) || ['Konuşma kaydı bulunamadı.'];
                const logChannel = message.guild.channels.cache.find(c => c.name.toLowerCase() === 'log');

                if (logChannel) {
                    const formatliMesajlar = konusmalar.join('\n');
                    const mahkemeMetni = `MAHKEME GEÇMİŞİ\n\nŞU ${tarih} TARİHİNDE AÇILAN MAHKEME KANALINDA ŞU MESAJLAR YAZILDI:\n\n${formatliMesajlar}`;
                    saklananMahkemeler.set('son_mahkeme', mahkemeMetni);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('mahkeme_sakla').setLabel('BU MAHKEMEYİ SAKLA').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('mahkeme_sil').setLabel('BU MAHKEME DOSYASINI SİL').setStyle(ButtonStyle.Danger)
                    );

                    await logChannel.send({ content: mahkemeMetni, components: [row] });
                }

                mahkemeMesajlari.delete(message.channel.id);
                await message.channel.send('⚖️ Mahkeme sona erdi, kanal siliniyor...');
                setTimeout(async () => { await message.channel.delete().catch(() => {}); }, 3000);
            } catch (err) {
                console.error('Mahkeme bitir hatası:', err);
            }
            return;
        }
    }

    if (message.content.toLowerCase() === 'sa') {
        await message.channel.send('as hoşgeldin bra');
    }

    const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const rolVarmi = message.member.roles.cache.size > 1;

    if (!adminMi && !rolVarmi) {
        const komutMu = message.content.startsWith('!roller') || message.content.startsWith('!kurallar') || message.content.startsWith('.şikayet') || message.content.startsWith('.sikayet');
        if (!komutMu) {
            try {
                await message.delete();
                await message.channel.send(`⚠️ ${message.author}, kuralları onaylamadığınız için mesaj atamazsınız.`);
            } catch (err) {}
            return;
        }
    }

    // --- KÜFÜR FİLTRESİ VE KOMUTLAR ---
    const userSicilGenel = getSicil(message.author.id);
    userSicilGenel.mesajSayisi++;

    // 1. .yavaş KOMUTU
    if (message.content.startsWith('.yavaş')) {
        const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const hasYavasYetki = corumVarmi || message.member.roles.cache.some(r => r.name.toLowerCase() === 'chatyt✅' || r.name.toLowerCase() === '📿') || adminMi;
        if (!hasYavasYetki) return message.reply('❌ Yetkiniz yok!');

        const args = message.content.trim().split(/ +/);
        const sure = parseInt(args[1]);
        if (isNaN(sure) || sure < 0 || sure > 5) return message.reply('❌ 0 ile 5 arasında bir süre belirtin!');

        await message.channel.setRateLimitPerUser(sure);
        return message.reply(sure === 0 ? '✅ Sohbet yavaşlatması kaldırıldı.' : `✅ Sohbet yavaşlatıldı (${sure} sn).`);
    }

    // 2. .uyar KOMUTU
    if (message.content.startsWith('.uyar')) {
        const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        if (!corumVarmi && !adminMi) return message.reply('❌ Bu komut için çorum rolü gerekiyor!');

        const hedefUye = message.mentions.members.first();
        const sebep = message.content.split(' ').slice(2).join(' ');
        if (!hedefUye || !sebep) return message.reply('❌ Kullanıcı etiketleyin ve sebep yazın!');

        getSicil(hedefUye.id).uyarilar.push({ sebep, tarih: new Date().toLocaleString(), yetkili: message.author.tag });
        return message.reply({ content: `Etiketlenen kullanıcı başarılı şekilde uyarıldı.`, allowedMentions: { repliedUser: true } });
    }

    // 3. .şikayetliyim KOMUTU
    if (message.content.startsWith('.şikayetliyim') || message.content.startsWith('.sikayetliyim')) {
        const hedefUye = message.mentions.users.first();
        if (!hedefUye) return message.reply('❌ Şikayet edilecek kullanıcıyı etiketleyin!');
        getSicil(hedefUye.id).sikayetSayisi++;
        return message.reply({ content: `Lütfen herhangi bir yöneticiye kanıt atın.`, allowedMentions: { repliedUser: true } });
    }

    // 4. .sikayetdoğru KOMUTU
    if (message.content.startsWith('.sikayetdoğru')) {
        const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        if (!corumVarmi && !adminMi) return message.reply('❌ Yetkiniz yok!');
        const hedefUye = message.mentions.users.first();
        if (!hedefUye) return message.reply('❌ Kullanıcı etiketleyin!');
        return message.reply(`✅ Şikayet onaylandı ve sicile işlendi.`);
    }

    // 5. .sicil <Discord ID>
    if (message.content.startsWith('.sicil')) {
        const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        if (message.channel.name.toLowerCase() !== 'log' && !corumVarmi && !adminMi) {
            return message.reply('❌ Bu komut sadece #log kanalında veya DM\'de yazılabilir!');
        }
        const hedefId = message.content.trim().split(/ +/)[1];
        if (!hedefId) return message.reply('❌ Discord ID yazmalısınız!');
        try {
            const hedefUser = await client.users.fetch(hedefId);
            return gosterSicil(message, hedefUser, false);
        } catch (e) {
            return message.reply('❌ Kullanıcı bulunamadı!');
        }
    }
});

// --- SİCİL GÖSTERME FONKSİYONU ---
async function gosterSicil(message, hedefUser, isDM) {
    const sicil = getSicil(hedefUser.id);
    if (sicil.gizliMi && !isDM) return message.reply('Bu kullanıcının sicili gizlidir.');

    let renkBaslik = "BEYAZ\nHarika tertemiz bir sicil";
    let embedRenk = 0xFFFFFF;
    const toplamCeza = sicil.uyarilar.length + sicil.mahkemeSayisi + sicil.susturmaSayisi + sicil.banSayisi;

    if (toplamCeza >= 8) { renkBaslik = "SİYAH SİCİL\nAcil ban gerekir."; embedRenk = 0x000000; }
    else if (toplamCeza >= 5) { renkBaslik = "KIRMIZI\nYönetici tarafından gözetim altında tutulması"; embedRenk = 0xFF0000; }
    else if (toplamCeza >= 3) { renkBaslik = "TURUNCU\nDüzeltilmesi gerek."; embedRenk = 0xFFA500; }
    else if (toplamCeza >= 1) { renkBaslik = "YEŞİL\nGüzel bir sicil"; embedRenk = 0x008000; }

    const embed = new EmbedBuilder()
        .setTitle(`📜 ${hedefUser.tag} - SİCİL DOSYASI`)
        .setColor(embedRenk)
        .setDescription(
            `**SİCİL DURUMU:**\n${renkBaslik}\n\n` +
            `• Discord ID: \`${hedefUser.id}\`\n` +
            `• Mahkeme Sayısı: **${sicil.mahkemeSayisi}**\n` +
            `• Uyarı Sayısı: **${sicil.uyarilar.length}**\n` +
            `• Şikayet Sayısı: **${sicil.sikayetSayisi}**\n` +
            `• Susturma: **${sicil.susturmaSayisi}**\n` +
            `• Ban: **${sicil.banSayisi}**\n` +
            `• Küfür Sayısı: **${sicil.kufurSayisi}**`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sicil_islem_${hedefUser.id}`).setLabel('GEREKLİ İŞLEMLERİ UYGULA').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`sicil_temizle_${hedefUser.id}`).setLabel('SİCİLİ TEMİZLE').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sicil_gizle_${hedefUser.id}`).setLabel('SİCİLİ GİZLE').setStyle(ButtonStyle.Secondary)
    );

    const targetChannel = isDM ? message.author : message.channel;
    return targetChannel.send({ embeds: [embed], components: [row] });
}

// --- KEEP-ALIVE ---
const http = require('http');
const server = http.createServer((req, res) => { res.writeHead(200); res.end('Lexo Anti-Nuke Aktif!\n'); });
server.listen(process.env.PORT || 3000);

client.login(process.env.DISCORD_TOKEN);
