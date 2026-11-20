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
const mahkemeMesajlari = new Map(); 
const saklananMahkemeler = new Map(); 
const sicilVeritabani = new Map(); 
const aktifSikayetler = new Map(); 
const sonGirisler = [];
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

client.on('guildMemberAdd', async member => {
    try {
        const kurallarKanal = member.guild.channels.cache.find(c => c.name === 'kurallar');
        if (kurallarKanal) {
            const embed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('📜 Sunucu Kurallarına Hoş Geldin!')
                .setDescription('Sunucumuzun tamamını görebilmek ve sohbet edebilmek için lütfen aşağıdaki **✅ Kabul Ediyorum** butonuna tıkla.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`kabul_et_${member.id}`).setLabel('✅ Kabul Ediyorum').setStyle(ButtonStyle.Success)
            );

            await kurallarKanal.send({ content: `${member}`, embeds: [embed], components: [row] });
        }

        const simdi = Date.now();
        sonGirisler.push(simdi);
        const guncelGirisler = sonGirisler.filter(zaman => simdi - zaman < 10000);
        sonGirisler.length = 0;
        sonGirisler.push(...guncelGirisler);

        if (guncelGirisler.length > 3 && !antiNukeAktifMi) {
            antiNukeAktifMi = true;
            const sahip = member.guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');

            if (sahip) {
                const antinukeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('antinuke_evet').setLabel('EVET').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('antinuke_hayir').setLabel('HAYIR').setStyle(ButtonStyle.Secondary)
                );

                const dmMsg = await sahip.send({
                    content: `Sunucuya 3 kişiden fazla kişi girdi, bot olma ihtimali var efendim.\n\nAcil durum başlatılsın mı?`,
                    components: [antinukeRow]
                }).catch(() => null);

                if (dmMsg) {
                    setTimeout(async () => {
                        if (antiNukeAktifMi) {
                            antiNukeAktifMi = false;
                            for (const zId of guncelGirisler) {
                                try {
                                    const u = member.guild.members.cache.get(member.id);
                                    if (u) await u.ban({ reason: 'Anti-Nuke: Sahip 7 saniye içinde yanıt vermedi.' });
                                } catch (e) {}
                            }
                            await sahip.send('⚠️ 7 saniye içinde yanıt verilmediği için anti-nuke protokolü devreye girdi.').catch(() => {});
                        }
                    }, 7000);
                }
            }
        }
    } catch (err) {
        console.error('guildMemberAdd hatası:', err);
    }
});

client.on('guildMemberRemove', async member => {
    try {
        const chatKanali = member.guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
        if (chatKanali) await chatKanali.send(`@${member.user.username} sunucudan ayrıldı 🙁`);
    } catch (err) {}
});

client.on('channelDelete', async channel => {
    const guild = channel.guild;
    const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
    if (!sahip) return;

    try {
        const auditLogs = await guild.fetchAuditLogs({ type: 10, limit: 1 });
        const deletionLog = auditLogs.entries.first();
        if (!deletionLog) return;
        const { executor } = deletionLog;
        const executorMember = await guild.members.fetch(executor.id).catch(() => null);
        if (!executorMember || executorMember.user.bot) return;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mass_ban_${executorMember.id}`).setLabel('BU KULLANICIYI BANLA').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mass_kick_${executorMember.id}`).setLabel('BU KULLANICIYI KİCKLE').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`mass_bos_${executorMember.id}`).setLabel('BAŞI BOŞ BIRAK').setStyle(ButtonStyle.Success)
        );

        await sahip.send({
            content: `KULLANICI ${executorMember.user.tag} SUNUCUDA 1 KANAL SİLDİ.\nSilme tarihi: ${new Date().toLocaleString()}`,
            components: [row]
        });
    } catch (e) {}
});

client.on('roleDelete', async role => {
    const guild = role.guild;
    const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
    if (!sahip) return;

    try {
        const auditLogs = await guild.fetchAuditLogs({ type: 32, limit: 1 });
        const deletionLog = auditLogs.entries.first();
        if (!deletionLog) return;
        const { executor } = deletionLog;
        const executorMember = await guild.members.fetch(executor.id).catch(() => null);
        if (!executorMember || executorMember.user.bot) return;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mass_ban_${executorMember.id}`).setLabel('BU KULLANICIYI BANLA').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mass_kick_${executorMember.id}`).setLabel('BU KULLANICIYI KİCKLE').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`mass_bos_${executorMember.id}`).setLabel('BAŞI BOŞ BIRAK').setStyle(ButtonStyle.Success)
        );

        await sahip.send({
            content: `KULLANICI ${executorMember.user.tag} SUNUCUDA 1 ROL SİLDİ.\nSilme tarihi: ${new Date().toLocaleString()}`,
            components: [row]
        });
    } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'antinuke_evet' || interaction.customId === 'antinuke_hayir') {
        antiNukeAktifMi = false;
        if (interaction.customId === 'antinuke_hayir') {
            return interaction.update({ content: '❌ Acil durum iptal edildi.', components: [] });
        }
        await interaction.update({ content: '🚨 Acil durum başlatıldı! Şüpheli kanalı kuruluyor...', components: [] });
        const guild = client.guilds.cache.first();
        if (!guild) return;

        try {
            let supheliRol = guild.roles.cache.find(r => r.name.toLowerCase() === 'şüpheli');
            if (!supheliRol) supheliRol = await guild.roles.create({ name: 'Şüpheli', color: '#ff4757', permissions: [] });

            const corumRolu = guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
            const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');

            await guild.channels.create({
                name: 'şüpheli-mahzeni',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: supheliRol.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    ...(corumRolu ? [{ id: corumRolu.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : []),
                    ...(sahip ? [{ id: sahip.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : []),
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });
        } catch (e) {}
        return;
    }

    if (interaction.customId.startsWith('mass_ban_') || interaction.customId.startsWith('mass_kick_') || interaction.customId.startsWith('mass_bos_')) {
        const [_, aksiyon, hedefId] = interaction.customId.split('_');
        const guild = client.guilds.cache.first();
        const hedefUye = await guild.members.fetch(hedefId).catch(() => null);

        if (aksiyon === 'bos') return interaction.update({ content: `✅ İşlem yapılmadı.`, components: [] });
        if (!hedefUye) return interaction.update({ content: '❌ Kullanıcı bulunamadı.', components: [] });

        if (aksiyon === 'ban') {
            await hedefUye.ban({ reason: 'Mass-Delete koruması.' });
            return interaction.update({ content: `🔨 Banlandı!`, components: [] });
        }
        if (aksiyon === 'kick') {
            await hedefUye.kick('Mass-Delete koruması.');
            return interaction.update({ content: `👢 Atıldı!`, components: [] });
        }
    }

    if (interaction.customId.startsWith('kabul_et_')) {
        const hedefUserId = interaction.customId.split('_')[2];
        if (interaction.user.id !== hedefUserId) return interaction.reply({ content: '❌ Başkasının yerine basamazsın.', ephemeral: true });

        await interaction.deferUpdate();
        const hayatsizRolu = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'hayatsız'); 
        if (hayatsizRolu) await interaction.member.roles.add(hayatsizRolu);
        await interaction.followUp({ content: '✅ Kuralları kabul ettin!', ephemeral: true });
        return;
    }

    if (interaction.customId === 'mahkeme_sakla' || interaction.customId === 'mahkeme_sil') {
        return interaction.update({ content: 'İşlem başarılı.', components: [] });
    }

    if (interaction.customId.startsWith('sicil_islem_') || interaction.customId.startsWith('sicil_temizle_') || interaction.customId.startsWith('sicil_gizle_')) {
        const parts = interaction.customId.split('_');
        const aksiyon = parts[1];
        const hedefId = parts[2];
        const guild = interaction.guild;
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        const corumVarmi = member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = member && member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!corumVarmi && !adminMi) return interaction.reply({ content: '❌ Yetkiniz yok!', ephemeral: true });

        const hedefSicil = getSicil(hedefId);
        if (aksiyon === 'gizle') {
            hedefSicil.gizliMi = true;
            return interaction.update({ content: `🔒 Sicil gizlendi.`, components: [] });
        }
        if (aksiyon === 'temizle') {
            sicilVeritabani.set(hedefId, { mahkemeSayisi: 0, uyarilar: [], sikayetSayisi: 0, susturmaSayisi: 0, banSayisi: 0, kickSayisi: 0, alinanRoller: [], cekilenRoller: [], sesGirisSayisi: 0, mesajSayisi: 0, kufurSayisi: 0, eglenceKomutlari: {}, gizliMi: false });
            return interaction.update({ content: `🧹 Sicil temizlendi!`, components: [] });
        }
        if (aksiyon === 'islem') {
            const hedefUye = await guild.members.fetch(hedefId).catch(() => null);
            if (!hedefUye) return interaction.reply({ content: '❌ Üye bulunamadı.', ephemeral: true });
            await hedefUye.ban({ reason: 'Kırmızı sicil.' });
            return interaction.update({ content: `🚨 Kullanıcı banlandı.`, components: [] });
        }
    }

    const [islem, hedefId] = interaction.customId.split('_');
    if (!['ban', 'kick', 'mute', 'mahkeme'].includes(islem)) return;

    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    const corumVarmi = member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
    const adminMi = member && member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!corumVarmi && !adminMi) return interaction.reply({ content: '❌ Bu butonları yalnızca çorum rolü sahipleri kullanabilir!', ephemeral: true });

    const hedefUye = await guild.members.fetch(hedefId).catch(() => null);
    if (!hedefUye) return interaction.reply({ content: '❌ Üye bulunamadı.', ephemeral: true });

    if (islem === 'ban') {
        await hedefUye.ban({ reason: 'Log paneli.' });
        await interaction.update({ content: `🔨 Banlandı!`, components: [] });
    } else if (islem === 'kick') {
        await hedefUye.kick('Log paneli.');
        await interaction.update({ content: `👢 Atıldı!`, components: [] });
    } else if (islem === 'mute') {
        await hedefUye.timeout(3 * 60 * 1000, 'Log paneli.');
        await interaction.update({ content: `🔇 Susturuldu!`, components: [] });
    } else if (islem === 'mahkeme') {
        const corumRolu = guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        const mahkemeKanali = await guild.channels.create({
            name: `mahkeme-${hedefUye.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: hedefUye.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ...(corumRolu ? [{ id: corumRolu.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
            ]
        });
        const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
        if (sahip) await mahkemeKanali.permissionOverwrites.create(sahip.id, { ViewChannel: true, SendMessages: true });
        mahkemeMesajlari.set(mahkemeKanali.id, []);
        await interaction.update({ content: `⚖️ Mahkeme kanalı açıldı: ${mahkemeKanali}`, components: [] });
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.member || newState.member.user.bot || !newState.channelId) return;
    const member = newState.member;
    getSicil(member.id).sesGirisSayisi++;
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator) && member.roles.cache.size <= 1) {
        await member.voice.disconnect('Kurallar onaylanmadı.');
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (!message.guild) {
        let corumVarMiDM = false;
        for (const [_, guild] of client.guilds.cache) {
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum')) { corumVarMiDM = true; break; }
        }
        if (!corumVarMiDM) return message.reply('❌ Çorum rolü gerekli!');

        const argsDM = message.content.trim().split(/ +/);
        const cmdDM = argsDM.shift().toLowerCase();
        if (cmdDM === '.sicil') {
            const hedefId = argsDM[0];
            if (!hedefId) return message.reply('❌ Discord ID yazmalısın!');
            try {
                const hedefUser = await client.users.fetch(hedefId);
                return gosterSicil(message, hedefUser, true);
            } catch (e) { return message.reply('❌ Kullanıcı bulunamadı!'); }
        }
        return;
    }

    if (message.channel.name === 'şüpheli-mahzeni') {
        const yazi = message.content;
        const hasNoktalama = /[.!?,;:]/.test(yazi);
        const logKanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
        if (logKanal) {
            logKanal.send(`📊 **Şüpheli Analizi:**\nKullanıcı: ${message.author} (\`${message.author.id}\`)\nNoktalama: ${hasNoktalama ? 'Var' : 'Yok'}\nMesaj: "${yazi}"`);
        }
    }

    if (message.content === '!Kanalsil' && message.channel.name === 'şüpheli-mahzeni') {
        if (message.author.username.toLowerCase() === 'cikomiko0787' || message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await message.channel.delete().catch(() => {});
            return;
        }
    }

    if (message.content.startsWith('.şüphelideğil')) {
        if (message.author.username.toLowerCase() !== 'cikomiko0787') return message.reply('❌ Sadece sunucu sahibi kullanabilir!');
        const hedefUye = message.mentions.members.first();
        if (!hedefUye) return message.reply('❌ Üye etiketle!');
        const supheliRol = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'şüpheli');
        if (supheliRol) await hedefUye.roles.remove(supheliRol).catch(() => {});
        return message.reply(`✅ Şüpheliden çıkarıldı.`);
    }

    if (message.channel.name.startsWith('mahkeme-')) {
        const kayitlar = mahkemeMesajlari.get(message.channel.id) || [];
        kayitlar.push(`[${new Date().toLocaleString()}] ${message.author.tag}: ${message.content}`);
        mahkemeMesajlari.set(message.channel.id, kayitlar);
    }

    if (message.content.toLowerCase() === '.bitir' && message.channel.name.startsWith('mahkeme-')) {
        const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isSahip = message.author.username.toLowerCase() === 'cikomiko0787';

        if (adminMi || corumVarmi || isSahip) {
            const konusmalar = mahkemeMesajlari.get(message.channel.id) || [];
            const logChannel = message.guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
            if (logChannel) {
                logChannel.send(`MAHKEME RAPORU:\n${konusmalar.join('\n')}`);
            }
            mahkemeMesajlari.delete(message.channel.id);
            setTimeout(() => message.channel.delete().catch(() => {}), 2000);
            return;
        }
    }

    if (message.content.toLowerCase() === 'sa') await message.channel.send('as hoşgeldin bra');

    const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const rolVarmi = message.member.roles.cache.size > 1;

    if (!adminMi && !rolVarmi) {
        const komutMu = message.content.startsWith('!roller') || message.content.startsWith('!kurallar') || message.content.startsWith('.şikayet') || message.content.startsWith('.sikayet');
        if (!komutMu) {
            await message.delete().catch(() => {});
            return;
        }
    }

    getSicil(message.author.id).mesajSayisi++;

    const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');

    // Komutlar
    if (message.content.startsWith('.yavaş')) {
        if (!corumVarmi && !message.member.roles.cache.some(r => r.name.toLowerCase() === 'chatyt✅' || r.name.toLowerCase() === '📿') && !adminMi) return message.reply('❌ Yetkiniz yok!');
        const sure = parseInt(message.content.trim().split(/ +/)[1]);
        if (isNaN(sure) || sure < 0 || sure > 5) return message.reply('❌ 0 ile 5 arasında girin!');
        await message.channel.setRateLimitPerUser(sure);
        return message.reply(sure === 0 ? '✅ Yavaş mod kaldırıldı.' : `✅ Yavaş mod ${sure} saniye yapıldı.`);
    }

    if (message.content.startsWith('.uyar')) {
        if (!corumVarmi && !adminMi) return message.reply('❌ Çorum rolü gerekli!');
        const hedefUye = message.mentions.members.first();
        const sebep = message.content.split(' ').slice(2).join(' ');
        if (!hedefUye || !sebep) return message.reply('❌ Kullanıcı ve sebep belirtin!');
        getSicil(hedefUye.id).uyarilar.push({ sebep, tarih: new Date().toLocaleString() });
        return message.reply({ content: `Etiketlenen kullanıcı başarılı şekilde uyarıldı.`, allowedMentions: { repliedUser: true } });
    }

    if (message.content.startsWith('.şikayetliyim') || message.content.startsWith('.sikayetliyim')) {
        const hedefUye = message.mentions.users.first();
        if (!hedefUye) return message.reply('❌ Kullanıcı etiketle!');
        getSicil(hedefUye.id).sikayetSayisi++;
        return message.reply({ content: `Lütfen herhangi bir yöneticiye kanıt atın.`, allowedMentions: { repliedUser: true } });
    }

    if (message.content.startsWith('.sikayetdoğru')) {
        if (!corumVarmi && !adminMi) return message.reply('❌ Yetkiniz yok!');
        return message.reply(`✅ Şikayet sicile işlendi.`);
    }

    if (message.content.startsWith('.sicil')) {
        if (message.channel.name.toLowerCase() !== 'log' && !corumVarmi && !adminMi) return message.reply('❌ Sadece log kanalında kullanılabilir!');
        const hedefId = message.content.trim().split(/ +/)[1];
        if (!hedefId) return message.reply('❌ Discord ID yazın!');
        try {
            const hedefUser = await client.users.fetch(hedefId);
            return gosterSicil(message, hedefUser, false);
        } catch (e) { return message.reply('❌ Bulunamadı!'); }
    }

    if (message.content.startsWith('.kayıtmahkeme')) {
        if (message.channel.name.toLowerCase() !== 'log' || (!corumVarmi && !adminMi)) return message.reply('❌ Yetkiniz yok!');
        const saklanan = saklananMahkemeler.get('son_mahkeme');
        if (!saklanan) return message.reply('❌ Kayıt yok!');
        return message.channel.send(saklanan);
    }

    if (message.content.startsWith('.yardım')) {
        if (message.channel.name.toLowerCase() !== 'log' || (!corumVarmi && !adminMi)) return message.reply('❌ Yetkiniz yok!');
        return message.channel.send(`Lexo Komut Listesi Aktif!`);
    }

    if (message.content.startsWith('.zekam')) {
        if (message.channel.name.toLowerCase() !== 'eğlence' && message.channel.name.toLowerCase() !== 'eglence') return message.reply('❌ Sadece #eğlence kanalında!');
        const hedefUser = message.mentions.users.first() || message.author;
        const iq = (hedefUser.username.toLowerCase() === 'cikomiko0787') ? 700 : Math.floor(Math.random() * 150);
        return message.reply(`🧠 ${hedefUser} - **${iq} IQ**`);
    }

    if (message.content.startsWith('.zeka')) {
        if (message.channel.name.toLowerCase() !== 'eğlence' && message.channel.name.toLowerCase() !== 'eglence') return message.reply('❌ Sadece #eğlence kanalında!');
        await message.guild.members.fetch();
        const gercek = message.guild.members.cache.filter(m => !m.user.bot).random();
        return message.channel.send(`👑 Sunucunun en zekisi: ${gercek}`);
    }

    if (message.content.startsWith('.ship')) {
        if (message.channel.name.toLowerCase() !== 'eğlence' && message.channel.name.toLowerCase() !== 'eglence') return message.reply('❌ Sadece #eğlence kanalında!');
        const hedef = message.mentions.users.first();
        if (!hedef) return message.reply('❌ Kullanıcı etiketle!');
        return message.channel.send(`💖 Uyum: %${Math.floor(Math.random() * 101)}`);
    }

    if (message.content.startsWith('!roller')) {
        if (!corumVarmi && !adminMi) return message.reply('❌ Yetkiniz yok!');
        return message.channel.send(`🏅 Aktif roller ve ödüller sistemi.`);
    }

    if (message.content.startsWith('!kurallar')) {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`kabul_et_${message.author.id}`).setLabel('✅ Kabul Ediyorum').setStyle(ButtonStyle.Success));
        return message.channel.send({ content: `📜 Kurallar`, components: [row] });
    }

    if (message.content.startsWith('.sesegir')) {
        if (!adminMi && !rolVarmi) return message.reply('❌ Yetkiniz yok!');
        const kanalAdi = message.content.slice('.sesegir'.length).trim();
        const hedefKanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === kanalAdi.toLowerCase() && c.type === ChannelType.GuildVoice);
        if (!hedefKanal) return message.reply('❌ Bulunamadı!');
        joinVoiceChannel({ channelId: hedefKanal.id, guildId: message.guild.id, adapterCreator: message.guild.voiceAdapterCreator });
        return message.channel.send('✅ Sese girildi.');
    }

    if (message.content.startsWith('.mute')) {
        if (!corumVarmi && !message.member.roles.cache.some(r => r.name.toLowerCase() === 'chatyt✅') && !adminMi) return message.reply('❌ Yetkiniz yok!');
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Üye etiketle!');
        await target.timeout(3 * 60 * 1000, 'Mute');
        return message.channel.send(`✅ ${target.user.tag} susturuldu.`);
    }

    if (message.content.startsWith('.unmute')) {
        if (!corumVarmi && !message.member.roles.cache.some(r => r.name.toLowerCase() === 'chatyt✅') && !adminMi) return message.reply('❌ Yetkiniz yok!');
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Üye etiketle!');
        await target.timeout(null, 'Unmute');
        return message.channel.send(`✅ ${target.user.tag} açıldı.`);
    }

    if (message.content.startsWith('.nuke')) {
        if (!corumVarmi && !message.member.roles.cache.some(r => r.name.toLowerCase() === 'nuke✅') && !adminMi) return message.reply('❌ Yetkiniz yok!');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nuke_evet').setLabel('Evet, Sıfırla').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('nuke_hayir').setLabel('İptal').setStyle(ButtonStyle.Secondary)
        );
        const msg = await message.channel.send({ content: `⚠️ Emin misin?`, components: [row] });
        const filter = i => i.user.id === message.author.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 15000 });
        collector.on('collect', async i => {
            if (i.customId === 'nuke_evet') {
                const newCh = await message.channel.clone();
                await message.channel.delete();
                await newCh.send('✅ Kanal sıfırlandı.');
            } else {
                await i.update({ content: 'İptal.', components: [] });
            }
        });
    }
});

async function gosterSicil(message, hedefUser, isDM) {
    const sicil = getSicil(hedefUser.id);
    if (sicil.gizliMi && !isDM) return message.reply('Bu kullanıcının sicili gizlidir.');

    let renkBaslik = "BEYAZ\nHarika tertemiz bir sicil";
    let embedRenk = 0xFFFFFF;
    const toplamCeza = sicil.uyarilar.length + sicil.mahkemeSayisi + sicil.susturmaSayisi + sicil.banSayisi;

    if (toplamCeza >= 8) { renkBaslik = "SİYAH SİCİL\nAcil ban gerekir."; embedRenk = 0x000000; }
    else if (toplamCeza >= 5) { renkBaslik = "KIRMIZI\nYönetici gözetiminde"; embedRenk = 0xFF0000; }
    else if (toplamCeza >= 3) { renkBaslik = "TURUNCU\nDüzeltilmesi gerek."; embedRenk = 0xFFA500; }
    else if (toplamCeza >= 1) { renkBaslik = "YEŞİL\nGüzel bir sicil"; embedRenk = 0x008000; }

    const embed = new EmbedBuilder()
        .setTitle(`📜 ${hedefUser.tag} - SİCİL DOSYASI`)
        .setColor(embedRenk)
        .setDescription(
            `**SİCİL DURUMU:**\n${renkBaslik}\n\n` +
            `• Discord ID: \`${hedefUser.id}\`\n` +
            `• Mahkeme: **${sicil.mahkemeSayisi}** | Uyarı: **${sicil.uyarilar.length}** | Ban: **${sicil.banSayisi}**`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sicil_islem_${hedefUser.id}`).setLabel('GEREKLİ İŞLEMLERİ UYGULA').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`sicil_temizle_${hedefUser.id}`).setLabel('SİCİLİ TEMİZLE').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sicil_gizle_${hedefUser.id}`).setLabel('SİCİLİ GİZLE').setStyle(ButtonStyle.Secondary)
    );

    const targetChannel = isDM ? message.author : message.channel;
    return targetChannel.send({ embeds: [embed], components: [row] });
}

const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('Lexo Aktif!\n'); }).listen(process.env.PORT || 3000);

client.login(process.env.DISCORD_TOKEN);
