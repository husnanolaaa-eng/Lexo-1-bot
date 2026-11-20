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
const mahkemeMesajlari = new Map(); 
const saklananMahkemeler = new Map(); 
const sicilVeritabani = new Map(); 
const aktifSikayetler = new Map(); 
const katilimZamanlari = new Map();

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
            sesGirisSesleri: [],
            sesGirisSayisi: 0,
            mesajSayisi: 0,
            kufurSayisi: 0,
            unmuteSayisi: 0,
            nukeSayisi: 0,
            mesajSilmeSayisi: 0,
            takmaAdSayisi: 0,
            everyoneSayisi: 0,
            kufurUyariSayisi: 0,
            mahkemeSozleri: [],
            mahkemeKararlari: [],
            ozurSayisi: 0,
            gorusulenYetkililer: [],
            eglenceKomutlari: {},
            gizliMi: false
        });
    }
    return sicilVeritabani.get(userId);
}

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Gelişmiş Güvenlik Sistemleri');

    // 3 Gün İnaktiflik (Zombi Hesap) Kontrolü
    setInterval(async () => {
        const simdi = Date.now();
        for (const [userId, katilimZamani] of katilimZamanlari.entries()) {
            if (simdi - katilimZamani > 259200000) {
                const guild = client.guilds.cache.first();
                if (!guild) continue;
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                const sicil = getSicil(userId);
                if (sicil.mesajSayisi === 0) {
                    katilimZamanlari.delete(userId);
                    const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
                    if (sahip) {
                        const inactiveRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`inactive_taniyorum_${userId}`).setLabel('Bu kullanıcıyı tanıyorum').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`inactive_eminim_${userId}`).setLabel('Bilmiyorum ama gerçek').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(`inactive_supheli_${userId}`).setLabel('Bilmiyorum ve emin değilim').setStyle(ButtonStyle.Danger)
                        );
                        await sahip.send({
                            content: `KULLANICI:\nDISCORD ID: \`${userId}\` (${member.user.tag})\n\n3 gün boyunca sunucuda herhangi bir aktiflik sağlamadı.`,
                            components: [inactiveRow]
                        }).catch(() => {});
                    }
                }
            }
        }
    }, 3600000);
});

client.on('guildMemberAdd', async member => {
    try {
        katilimZamanlari.set(member.id, Date.now());
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
    } catch (err) {
        console.error('guildMemberAdd hatası:', err);
    }
});

// Kanal ve Rol Silme Koruması (Mass-Delete)
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
            new ButtonBuilder().setCustomId(`mass_islem_${executorMember.id}`).setLabel('GEREKLİ İŞLEMLERİ BAŞLAT').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mass_bos_${executorMember.id}`).setLabel('BOŞ VER').setStyle(ButtonStyle.Secondary)
        );

        const dmMsg = await sahip.send({
            content: `ACİL!🚨\n\nKullanıcı ismi: ${executorMember.user.tag}\nDiscord id: \`${executorMember.id}\`\n\nBu kişi 1 rol 1 kanal sildi.`,
            components: [row]
        }).catch(() => null);

        if (dmMsg) {
            setTimeout(async () => {
                try {
                    await executorMember.timeout(24 * 60 * 60 * 1000, 'Acil Anti-Nuke: 7 saniyede yanıt verilmedi.');
                    await sahip.send(`⚠️ 7 saniye içinde yanıt verilmediği için <@${executorMember.id}> kullanıcısının yetkileri askıya alındı ve 1 gün süreyle susturuldu.`);
                } catch(e){}
            }, 7000);
        }
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
            new ButtonBuilder().setCustomId(`mass_islem_${executorMember.id}`).setLabel('GEREKLİ İŞLEMLERİ BAŞLAT').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mass_bos_${executorMember.id}`).setLabel('BOŞ VER').setStyle(ButtonStyle.Secondary)
        );

        await sahip.send({
            content: `ACİL!🚨\n\nKullanıcı ismi: ${executorMember.user.tag}\nDiscord id: \`${executorMember.id}\`\n\nBu kişi 1 rol sildi.`,
            components: [row]
        });
    } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('inactive_')) {
        const [_, secim, hedefId] = interaction.customId.split('_');
        if (secim === 'taniyorum' || secim === 'eminim') {
            return interaction.update({ content: 'Anlaşıldı!', components: [] });
        }
        if (secim === 'supheli') {
            const evetHayirRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`supheli_sure_evet_${hedefId}`).setLabel('EVET').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`supheli_sure_hayir_${hedefId}`).setLabel('HAYIR').setStyle(ButtonStyle.Secondary)
            );
            return interaction.update({ content: `Şüpheli olarak görüyorsanız kullanıcıya süre verme izin verin.`, components: [evetHayirRow] });
        }
        return;
    }

    if (interaction.customId.startsWith('supheli_sure_')) {
        const parts = interaction.customId.split('_');
        const karar = parts[2];
        const hedefId = parts[3];
        const guild = client.guilds.cache.first();

        if (karar === 'hayir') return interaction.update({ content: 'Anladım!', components: [] });
        if (karar === 'evet') {
            const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
            if (hedefUye) {
                let supheliRol = guild.roles.cache.find(r => r.name.toLowerCase() === '1');
                if (!supheliRol) supheliRol = await guild.roles.create({ name: '1', color: '#ffa500', permissions: [] });
                await hedefUye.roles.add(supheliRol).catch(() => {});

                setTimeout(async () => {
                    const guncelUye = await guild.members.fetch(hedefId).catch(() => null);
                    if (guncelUye && guncelUye.roles.cache.has(supheliRol.id)) {
                        const sicil = getSicil(hedefId);
                        if (sicil.mesajSayisi === 0) {
                            const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
                            if (sahip) {
                                const kickBanRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId(`kickban_kick_${hedefId}`).setLabel('KİCKLE').setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder().setCustomId(`kickban_ban_${hedefId}`).setLabel('BANLA').setStyle(ButtonStyle.Danger),
                                    new ButtonBuilder().setCustomId(`kickban_bos_${hedefId}`).setLabel('BAŞINI BOŞ BIRAK').setStyle(ButtonStyle.Success)
                                );
                                await sahip.send({ content: `Verilen süre doldu.\nKullanıcı ID: \`${hedefId}\``, components: [kickBanRow] }).catch(() => {});
                            }
                        }
                    }
                }, 86400000);
            }
            return interaction.update({ content: '✅ Kullanıcıya 1 günlük deneme süresi (1 rolü) verildi.', components: [] });
        }
    }

    if (interaction.customId.startsWith('kickban_')) {
        const [_, aksiyon, hedefId] = interaction.customId.split('_');
        if (aksiyon === 'bos') return interaction.update({ content: 'Başı boş bırakıldı.', components: [] });
        const guild = client.guilds.cache.first();
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
    }

    if (interaction.customId.startsWith('mass_islem_') || interaction.customId.startsWith('mass_bos_')) {
        const [_, aksiyon, hedefId] = interaction.customId.split('_');
        if (aksiyon === 'bos') return interaction.update({ content: 'Boş verildi.', components: [] });
        
        const mahkemeBanRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mahkeme_baslat_${hedefId}`).setLabel('MAHKEME').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`direk_ban_${hedefId}`).setLabel('BANLA').setStyle(ButtonStyle.Danger)
        );
        return interaction.update({ content: `İşlem seçin:`, components: [mahkemeBanRow] });
    }

    if (interaction.customId.startsWith('direk_ban_')) {
        const hedefId = interaction.customId.split('_')[2];
        const guild = client.guilds.cache.first();
        const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
        if (hedefUye) await hedefUye.ban({ reason: 'Mass-delete güvenliği.' });
        return interaction.update({ content: '🔨 Kullanıcı banlandı.', components: [] });
    }

    // ŞİKAYET DOĞRU / YANLIŞ BUTONLARI (SADECE ÇORUM ROLÜ)
    if (interaction.customId.startsWith('sikayet_evet_') || interaction.customId.startsWith('sikayet_hayir_')) {
        const parts = interaction.customId.split('_');
        const karar = parts[1];
        const sikayetEdenId = parts[2];
        const hedefId = parts[3];

        const guild = interaction.guild;
        const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
        const corumVarmi = member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = member && member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!corumVarmi && !adminMi) {
            return interaction.reply({ content: '❌ Bu butonlara yalnızca **çorum** rolüne sahip kişiler basabilir!', ephemeral: true });
        }

        if (karar === 'hayir') {
            const sikayetEdenUye = guild ? await guild.members.fetch(sikayetEdenId).catch(() => null) : null;
            if (sikayetEdenUye) {
                let dCiko = "cikomiko0787", dMvn = "mvn_zuid010", d4w = "4w7j";
                guild.members.cache.forEach(m => {
                    const uname = m.user.username;
                    if (uname.includes("cikomiko0787")) dCiko = uname;
                    if (uname.includes("mvn_zuid010")) dMvn = uname;
                    if (uname.includes("4w7j")) d4w = uname;
                });
                const chatKanal = guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
                if (chatKanal) {
                    await chatKanal.send(
                        `⚠️ ${sikayetEdenUye}\n\n` +
                        `ŞİKAYETİNİZ GEÇERSİZ KILINDI.\n` +
                        `Sahte şikayet yaptığınızı düşünüyoruz yanlış düşünüyorsak “çorum” rolüne sahip biriyle iletişime geçin.\n` +
                        `Eğer yetkili bulamadıysanız ${dCiko}\n${dMvn}\n${d4w}\nkişilere DM’den acil şekilde ulaşın.`
                    );
                }
            }
            return interaction.update({ content: '❌ Şikayet geçersiz kılındı ve şikayet eden uyarıldı.', components: [] });
        }

        if (karar === 'evet') {
            const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
            if (!hedefUye) return interaction.update({ content: '❌ Şikayet edilen kullanıcı bulunamadı.', components: [] });

            const sicil = getSicil(hedefId);
            sicil.mahkemeSayisi++;

            const eskiRoller = hedefUye.roles.cache.map(r => r.id).filter(id => id !== guild.id);
            sicil.cekilenRoller.push(...hedefUye.roles.cache.filter(r => r.id !== guild.id).map(r => r.name));
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
            if (sahip) await mahkemeKanali.permissionOverwrites.create(sahip.id, { ViewChannel: true, SendMessages: true });

            mahkemeMesajlari.set(mahkemeKanali.id, []);
            await mahkemeKanali.send(`Şikayet onaylandı!\nKanıtları elinizde tutun.\n\n⚖️ **MAHKEME BAŞLATILDI!** Sanık: ${hedefUye}`);
            return interaction.update({ content: `✅ Şikayet doğrulandı ve mahkeme kanalı açıldı: ${mahkemeKanali}`, components: [] });
        }
    }

    if (['ban', 'kick', 'mute', 'mahkeme', 'uyar'].includes(interaction.customId.split('_')[0])) {
        const parts = interaction.customId.split('_');
        const islem = parts[0];
        const hedefId = parts[1];

        const guild = interaction.guild;
        const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
        const corumVarmi = member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = member && member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!corumVarmi && !adminMi) return interaction.reply({ content: '❌ Bu butonlara yalnızca **çorum** rolüne sahip olanlar basabilir!', ephemeral: true });

        const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
        const hedefSicil = getSicil(hedefId);

        if (islem === 'uyar') {
            hedefSicil.uyarilar.push({ sebep: 'Küfür tespiti', tarih: new Date().toLocaleString(), yetkili: interaction.user.tag });
            return interaction.update({ content: `⚠️ Kullanıcı uyarıldı ve siciline işlendi.`, components: [] });
        }
        if (!hedefUye) return interaction.update({ content: '❌ Üye sunucuda bulunamadı.', components: [] });

        if (islem === 'ban') {
            hedefSicil.banSayisi++;
            await hedefUye.ban({ reason: 'Küfür log paneli.' });
            return interaction.update({ content: `🔨 Banlandı!`, components: [] });
        }
        if (islem === 'kick') {
            hedefSicil.kickSayisi++;
            await hedefUye.kick('Küfür log paneli.');
            return interaction.update({ content: `👢 Atıldı!`, components: [] });
        }
        if (islem === 'mute') {
            hedefSicil.susturmaSayisi++;
            await hedefUye.timeout(3 * 60 * 1000, 'Küfür susturması.');
            return interaction.update({ content: `🔇 3 dakika susturuldu!`, components: [] });
        }
        if (islem === 'mahkeme') {
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
            if (sahip) await mahkemeKanali.permissionOverwrites.create(sahip.id, { ViewChannel: true, SendMessages: true });

            mahkemeMesajlari.set(mahkemeKanali.id, []);
            return interaction.update({ content: `⚖️ Mahkeme kanalı açıldı: ${mahkemeKanali}`, components: [] });
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
        const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
        const corumVarmi = member && member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adminMi = member && member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!corumVarmi && !adminMi) return interaction.reply({ content: '❌ Yetkiniz yok!', ephemeral: true });

        const hedefSicil = getSicil(hedefId);
        if (aksiyon === 'gizle') {
            hedefSicil.gizliMi = true;
            return interaction.update({ content: `🔒 Sicil gizlendi.`, components: [] });
        }
        if (aksiyon === 'temizle') {
            sicilVeritabani.set(hedefId, {
                mahkemeSayisi: 0, uyarilar: [], sikayetSayisi: 0, susturmaSayisi: 0,
                banSayisi: 0, kickSayisi: 0, alinanRoller: [], cekilenRoller: [],
                sesGirisSesleri: [], sesGirisSayisi: 0, mesajSayisi: 0, kufurSayisi: 0,
                unmuteSayisi: 0, nukeSayisi: 0, mesajSilmeSayisi: 0, takmaAdSayisi: 0,
                everyoneSayisi: 0, kufurUyariSayisi: 0, mahkemeSozleri: [], mahkemeKararlari: [],
                ozurSayisi: 0, gorusulenYetkililer: [], eglenceKomutlari: {}, gizliMi: false
            });
            return interaction.update({ content: `🧹 Sicil temizlendi!`, components: [] });
        }
        if (aksiyon === 'islem') {
            const hedefUye = guild ? await guild.members.fetch(hedefId).catch(() => null) : null;
            if (!hedefUye) return interaction.reply({ content: '❌ Üye bulunamadı.', ephemeral: true });
            await hedefUye.ban({ reason: 'Kırmızı sicil.' });
            return interaction.update({ content: `🚨 Kullanıcı banlandı.`, components: [] });
        }
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.member || newState.member.user.bot || !newState.channelId) return;
    const member = newState.member;
    const sicil = getSicil(member.id);
    sicil.sesGirisSayisi++;
    if (newState.channel && !sicil.sesGirisSesleri.includes(newState.channel.name)) {
        sicil.sesGirisSesleri.push(newState.channel.name);
    }
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator) && member.roles.cache.size <= 1) {
        await member.voice.disconnect('Kurallar onaylanmadı.');
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const msgContent = message.content || '';

    // --- ÖZEL (DM) MESAJLAR ---
    if (!message.guild) {
        const userId = message.author.id;
        const isCiko = message.author.username.toLowerCase().includes('cikomiko0787');

        const argsDM = msgContent.trim().split(/ +/);
        const cmdDM = argsDM.shift().toLowerCase();

        if (cmdDM === '.yardım') {
            if (!isCiko) return message.reply('❌ Bu komutu sadece sunucu sahibi cikomiko0787 kullanabilir!');
            await message.author.send(
                `Tabii efendim! İşte Lexo Botunun DM üzerinden ve sunucuda kullanabileceğiniz tüm . ve ! komutları ile detaylı açıklamaları:\n\n` +
                `• \`.sicil <Discord ID>\`: Sunucudaki bir kullanıcının; kaç kez uyarıldığını, susturulduğunu, banlandığını, kicklendiğini, mahkemeye çıktığını, alınan/çekilen rollerini, sese girişlerini, şikayetlerini ve tüm sicil dökümünü renkli ve interaktif butonlarla listeler.\n` +
                `• \`.mahkemearşiv\`: Sunucu sahibinin özelden yazarak belirli bir kullanıcının mahkeme arşivini detaylıca incelemesini sağlar.\n` +
                `• \`.yavaş [0-5]\`: Bulunduğunuz sohbet kanalını belirtilen saniye kadar yavaşlatır.\n` +
                `• \`.uyar @kullanıcı [sebep]\`: Bir kullanıcıyı belirttiğiniz sebeple uyarır ve doğrudan siciline işler.\n` +
                `• \`.sesegir <kanal_adı>\`: Botun belirttiğiniz isimdeki ses kanalına giriş yapmasını sağlar.\n` +
                `• \`.mute @kullanıcı\`: Belirtilen üyeyi 3 dakika süreyle susturur.\n` +
                `• \`.unmute @kullanıcı\`: Susturulan üyenin cezasını erkenden kaldırır.\n` +
                `• \`.nuke\`: Bulunulan kanalı tamamen sıfırlar ve klonunu oluşturur.\n` +
                `• \`.zeka\`, \`.zekam\`, \`.ship\`: #eğlence kanalında çalışan eğlence komutları.\n` +
                `• \`!kurallar\`, \`!roller\`: Kuralları ve rollerin açıklamasını gösterir.`
            );
            return message.reply('✅ Detaylı yardım menüsü DM olarak gönderildi.');
        }

        if (cmdDM === '.sicil') {
            if (!isCiko) return message.reply('❌ Bu komutu sadece cikomiko0787 kullanabilir!');
            const hedefId = argsDM[0];
            if (!hedefId) return message.reply('❌ Lütfen Discord ID yazın!');
            try {
                const hedefUser = await client.users.fetch(hedefId);
                return gosterSicil(message, hedefUser, true);
            } catch (e) {
                return message.reply('❌ Kullanıcı bulunamadı!');
            }
        }

        if (cmdDM === '.mahkemearşiv' || cmdDM === '.mahkemearşivi') {
            if (!isCiko) return message.reply('❌ Bu komutu sadece cikomiko0787 kullanabilir!');
            
            await message.reply("Kimin mahkeme arşivini görmek istersiniz?");
            
            const filter = m => m.author.id === userId;
            const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async m => {
                const targetId = m.content.trim();
                const sicil = sicilVeritabani.get(targetId);
                if (!sicil) return m.reply('❌ Bu ID\'ye ait kayıtlı mahkeme arşivi bulunamadı.');

                let targetUser;
                try { targetUser = await client.users.fetch(targetId); } catch(e){ targetUser = { tag: targetId }; }

                const konusmalar = sicil.mahkemeSozleri.join('\n') || 'Konuşma kaydı yok.';
                const kararlar = sicil.mahkemeKararlari.join(', ') || 'Karar yok.';
                const yetkililer = sicil.gorusulenYetkililer.join(', ') || 'Bilinmiyor';

                await m.reply(
                    `📜 **MAHKEME ARŞİVİ - ${targetUser.tag || targetId}**\n\n` +
                    `• Mahkemeye giriş saati: ${sicil.mahkemeGirisSaati || 'Bilinmiyor'}\n` +
                    `• Mahkemede neler yazdığı:\n${konusmasizFormat(konusmalar)}\n` +
                    `• Doğrulanmış karar ve kararı veren kişi: ${kararlar}\n` +
                    `• Mahkemede dilediği özür sayısı: **${sicil.ozurSayisi}**\n` +
                    `• Görüştüğü yetkililer: ${yetkililer}\n` +
                    `• Mahkemede kaç kere chat yaptığı: **${sicil.mahkemeChatSayisi || 0}**`
                );
            });
            return;
        }
        return;
    }

    // --- KÜFÜR FİLTRESİ VE LOG KANALI ---
    const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');

    const kelimeler = msgContent.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ").split(/\s+/);
    let isProfane = false;
    for (let kelime of kelimeler) {
        let temizKelime = kelime.replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o').replace(/5/g, 's');
        if (blacklist.some(y => temizKelime === y || temizKelime.includes(y))) { isProfane = true; break; }
    }

    if (isProfane && !adminMi) {
        const sicil = getSicil(message.author.id);
        sicil.kufurSayisi++;
        try { await message.delete(); } catch(e){}

        const logKanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
        if (logKanal) {
            const kufurRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`uyar_${message.author.id}`).setLabel('UYAR').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mahkeme_${message.author.id}`).setLabel('MAHKEME').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`mute_${message.author.id}`).setLabel('MUTE AT').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`ban_${message.author.id}`).setLabel('BANLA').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`kick_${message.author.id}`).setLabel('KİCKLE').setStyle(ButtonStyle.Secondary)
            );

            await logKanal.send({
                content: `🚨 **Küfür Tespiti!**\n` +
                         `• Kullanıcı: ${message.author} (${message.author.tag})\n` +
                         `• Discord ID: \`${message.author.id}\`\n` +
                         `• Kanal: ${message.channel}\n` +
                         `• Zaman: ${new Date().toLocaleString()}\n` +
                         `• Küfür: ||${msgContent}||`,
                components: [kufurRow]
            });
        }
        return;
    }

    getSicil(message.author.id).mesajSayisi++;

    if (message.channel.name.startsWith('mahkeme-')) {
        const sicil = getSicil(message.author.id);
        sicil.mahkemeSozleri.push(`[${new Date().toLocaleTimeString()}] ${message.author.tag}: ${msgContent}`);
        sicil.mahkemeChatSayisi = (sicil.mahkemeChatSayisi || 0) + 1;
    }

    // --- ŞİKAYET KONTROLÜ (cikomiko0787 log kanalına yazar) ---
    const isCikoMessage = message.author.username.toLowerCase().includes('cikomiko0787');
    if (isCikoMessage && message.channel.name.toLowerCase() === 'log') {
        if (msgContent.includes('şikayet ettiği')) {
            const parcalar = msgContent.split(/şike?yet ettiği/i);
            const sikayetEdenId = parcalar[0].trim();
            const hedefId = parcalar[1].trim();

            if (sikayetEdenId && hedefId) {
                const evetHayirRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sikayet_evet_${sikayetEdenId}_${hedefId}`).setLabel('EVET').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`sikayet_hayir_${sikayetEdenId}_${hedefId}`).setLabel('HAYIR').setStyle(ButtonStyle.Danger)
                );

                return message.reply({ content: `Bu şikayet doğru mu?`, components: [evetHayirRow] });
            }
        }
    }

    // --- EĞLENCE KOMUTLARI ---
    if (msgContent.startsWith('.zeka') || msgContent.startsWith('.zekam') || msgContent.startsWith('.ship')) {
        if (message.channel.name.toLowerCase() !== 'eğlence' && message.channel.name.toLowerCase() !== 'eglence') {
            return message.reply('❌ Bu komutlar sadece **#eğlence** kanalında kullanılabilir!');
        }
    }

    if (msgContent.startsWith('.zeka')) {
        await message.guild.members.fetch();
        const gercek = message.guild.members.cache.filter(m => !m.user.bot).random();
        return message.channel.send(`👑 Sunucunun en zekisi: ${gercek}`);
    }

    if (msgContent.startsWith('.zekam')) {
        const hedefUser = message.mentions.users.first() || message.author;
        const iq = (hedefUser.username.toLowerCase().includes('cikomiko0787')) ? 700 : Math.floor(Math.random() * 150);
        
        const embed = new EmbedBuilder()
            .setColor('#2ed573')
            .setTitle('🧠 IQ TESTİ')
            .setDescription(`📊 **${hedefUser.username}** adlı kişinin zeka seviyesi: \`${iq} IQ\``)
            .setThumbnail(hedefUser.displayAvatarURL({ dynamic: true }))
            .setImage('https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=600&auto=format&fit=crop');

        return message.reply({ embeds: [embed] });
    }

    if (msgContent.startsWith('.ship')) {
        const hedef = message.mentions.users.first();
        if (!hedef) return message.reply('❌ Lütfen shiplemek için bir kullanıcı etiketle! Örnek: `.ship @kullanici`');

        const yuzde = Math.floor(Math.random() * 101);
        const user1 = message.author;
        const user2 = hedef;

        const shipEmbed = new EmbedBuilder()
            .setColor('#ff4757')
            .setTitle('💖 Aşk Testi (.ship) 💕')
            .setDescription(`💘 **${user1.username}** ❤️ **${user2.username}**\n\n✨ **Uyum Yüzdesi:** \`%${yuzde}\` ✨`)
            .setThumbnail(user1.displayAvatarURL({ dynamic: true }))
            .setImage(user2.displayAvatarURL({ dynamic: true }));

        return message.channel.send({ embeds: [shipEmbed] });
    }

    // --- YÖNETİM VE YETKİ KOMUTLARI (.yavaş, .sesegir, .mute, .unmute, .nuke, .uyar, .sicil) ---
    if (msgContent.startsWith('.yavaş')) {
        if (!corumVarmi && !message.member.roles.cache.some(r => r.name.toLowerCase() === 'chatyt✅' || r.name.toLowerCase() === '📿') && !adminMi) return message.reply('❌ Yetkiniz yok!');
        const sure = parseInt(msgContent.trim().split(/ +/)[1]);
        if (isNaN(sure) || sure < 0 || sure > 5) return message.reply('❌ 0 ile 5 arasında girin!');
        await message.channel.setRateLimitPerUser(sure);
        return message.reply(sure === 0 ? '✅ Yavaş mod kaldırıldı.' : `✅ Yavaş mod ${sure} saniye yapıldı.`);
    }

    if (msgContent.startsWith('.sesegir')) {
        if (!adminMi && !rolVarmi) return message.reply('❌ Yetkiniz yok!');
        const kanalAdi = msgContent.slice('.sesegir'.length).trim();
        const hedefKanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === kanalAdi.toLowerCase() && c.type === ChannelType.GuildVoice);
        if (!hedefKanal) return message.reply('❌ Bulunamadı!');
        joinVoiceChannel({ channelId: hedefKanal.id, guildId: message.guild.id, adapterCreator: message.guild.voiceAdapterCreator });
        return message.channel.send('✅ Sese girildi.');
    }

    if (msgContent.startsWith('.mute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        const yetki = adminMi || (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetki) return message.reply('❌ Yetkiniz yok!');
        const targetUser = message.mentions.members.first();
        if (!targetUser) return message.reply('❌ Kullanıcı etiketleyin!');

        try {
            getSicil(targetUser.id).susturmaSayisi++;
            await targetUser.timeout(3 * 60 * 1000, 'Mutelendi');
            return message.channel.send(`✅ ${targetUser.user.username} susturuldu.`);
        } catch (err) { console.error(err); }
    }

    if (msgContent.startsWith('.unmute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        const yetki = adminMi || (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetki) return message.reply('❌ Yetkiniz yok!');
        const targetUser = message.mentions.members.first();
        if (!targetUser) return message.reply('❌ Kullanıcı etiketleyin!');

        try {
            getSicil(targetUser.id).unmuteSayisi++;
            await targetUser.timeout(null, 'Açıldı');
            return message.channel.send(`✅ ${targetUser.user.username} susturması kaldırıldı.`);
        } catch (err) { console.error(err); }
    }

    if (msgContent.startsWith('.nuke')) {
        const nukeRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'nuke✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        const yetki = adminMi || (nukeRolu && message.member.roles.cache.has(nukeRolu.id)) || (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetki) return message.reply('❌ Yetkiniz yok!');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nuke_evet').setLabel('Evet, Sıfırla').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('nuke_hayir').setLabel('İptal').setStyle(ButtonStyle.Secondary)
        );

        const confirmMsg = await message.channel.send({
            content: `⚠️ ${message.author}, bu kanalı sıfırlamak istediğine emin misin?`,
            components: [row]
        });

        const filter = i => i.user.id === message.author.id;
        const collector = confirmMsg.createMessageComponentCollector({ filter, time: 20000 });

        collector.on('collect', async i => {
            if (i.customId === 'nuke_evet') {
                await i.update({ content: '🔥 Kanal nuke’leniyor...', components: [] });
                try {
                    getSicil(message.author.id).nukeSayisi++;
                    const position = message.channel.position;
                    const newChannel = await message.channel.clone({ position: position });
                    await message.channel.delete();
                    await newChannel.send(`✅ Kanal ${message.author} tarafından sıfırlandı.`);
                } catch (err) {
                    console.error(err);
                }
            } else {
                await i.update({ content: '❌ Nuke iptal edildi.', components: [] });
            }
        });
        return;
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
        .setTitle(`📜 ${hedefUser.tag} - DETAYLI SİCİL DOSYASI`)
        .setColor(embedRenk)
        .setDescription(
            `**SİCİL DURUMU:**\n${renkBaslik}\n\n` +
            `• Discord ID: \`${hedefUser.id}\`\n` +
            `• Bir yetkili tarafından kaç kere uyarıldığı: **${sicil.uyarilar.length}**\n` +
            `• Sunucuda kaç kere susturulduğu: **${sicil.susturmaSayisi}**\n` +
            `• Kaç tane rol aldığı: **${sicil.alinanRoller.length}** (${sicil.alinanRoller.join(', ') || 'Yok'})\n` +
            `• Kaç kere banlandı: **${sicil.banSayisi}**\n` +
            `• Kaç kere kicklendi: **${sicil.kickSayisi}**\n` +
            `• Kaç kere mahkemeye çıkarıldı: **${sicil.mahkemeSayisi}**\n` +
            `• Mahkemede adına verilen kararlar: ${sicil.mahkemeKararlari.join(', ') || 'Yok'}\n` +
            `• Kaç rolleri alındığı: **${sicil.cekilenRoller.length}** (${sicil.cekilenRoller.join(', ') || 'Yok'})\n` +
            `• Sese giriş sayısı ve kanalları: **${sicil.sesGirisSayisi}** (${sicil.sesGirisSesleri.join(', ') || 'Yok'})\n` +
            `• Sunucuya giriş tarihi: ${hedefUser.createdAt.toLocaleDateString()}\n` +
            `• Kaç kişiyi şikayet ettiği: **${sicil.sikayetSayisi}**\n` +
            `• Kaç kişiyi mutelediği: **${sicil.mutelemeSayisi || 0}**\n` +
            `• Kaç kişiyi unmute yaptığı: **${sicil.unmuteSayisi}**\n` +
            `• Kaç kez Nuke attığı: **${sicil.nukeSayisi}**\n` +
            `• Kaç kere üye mesajı sildiği: **${sicil.mesajSilmeSayisi}**\n` +
            `• Takma ad verme sayısı: **${sicil.takmaAdSayisi}**\n` +
            `• Everyone tagı atma sayısı: **${sicil.everyoneSayisi}**\n` +
            `• Küfürden dolayı uyarıldığı: **${sicil.kufurUyariSayisi || 0}**\n` +
            `• Mahkemede neler dedi:\n${sicil.mahkemeSozleri.join('\n') || 'Kayıt yok'}`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sicil_islem_${hedefUser.id}`).setLabel('GEREKLİ İŞLEMLERİ UYGULA').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`sicil_temizle_${hedefUser.id}`).setLabel('SİCİLİ TEMİZLE').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sicil_gizle_${hedefUser.id}`).setLabel('SİCİLİ GİZLE').setStyle(ButtonStyle.Secondary)
    );

    const targetChannel = isDM ? message.author : message.channel;
    return targetChannel.send({ embeds: [embed], components: [row] });
}

function konusmasizFormat(metin) { return metin; }

// --- KEEP-ALIVE ---
const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('Lexo Gelişmiş Sistem Aktif!\n'); }).listen(process.env.PORT || 3000);

client.login(process.env.DISCORD_TOKEN);
