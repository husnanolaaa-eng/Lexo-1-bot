const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    ChannelType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    EmbedBuilder 
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
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
const mahkemeMesajlari = new Map(); // channelId -> mesajlar dizisi
const saklananMahkemeler = new Map(); // saklanan dosyalar

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Güvenlik Sistemleri - Uluslararası Koruma');
});

// --- YENİ ÜYE KATILIMI ---
client.on('guildMemberAdd', async member => {
    try {
        const kurallarKanal = member.guild.channels.cache.find(c => c.name === 'kurallar');
        if (!kurallarKanal) return;

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

// --- BUTON ETKİLEŞİMLERİ ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // 1. Kuralları Kabul Et Butonu
    if (interaction.customId.startsWith('kabul_et_')) {
        const hedefUserId = interaction.customId.split('_')[2];

        if (interaction.user.id !== hedefUserId) {
            return interaction.reply({ content: '❌ Birinin adına karar vermeyin.', ephemeral: true });
        }

        try {
            await interaction.deferUpdate();
            
            const hayatsizRolu = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'hayatsız'); 
            if (hayatsizRolu) {
                await interaction.member.roles.add(hayatsizRolu);
            }
            
            await interaction.followUp({ content: '✅ Kuralları kabul ettin, "hayatsız" rolü verildi ve sunucu kilidi açıldı!', ephemeral: true });

            const chatKanali = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
            if (chatKanali) {
                await chatKanali.send(`🎉 ${interaction.user} Hoşgeldin!`);
            }
        } catch (err) {
            console.error('Kabul et buton hatası:', err);
        }
        return;
    }

    // 2. Mahkeme Arşiv Butonları (Sakla / Sil)
    if (interaction.customId === 'mahkeme_sakla') {
        await interaction.update({ content: 'MAHKEME SAKLANDI.', components: [] });
        return;
    }
    if (interaction.customId === 'mahkeme_sil') {
        await interaction.update({ content: 'Başarılı şekilde silindi.', components: [] });
        return;
    }

    // --- LOG KANALI CEZA BUTONLARI ---
    const [islem, hedefId] = interaction.customId.split('_');
    if (!['ban', 'kick', 'mute', 'mahkeme'].includes(islem)) return;

    try {
        const guild = interaction.guild;
        const hedefUye = await guild.members.fetch(hedefId).catch(() => null);

        if (!hedefUye) {
            return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı veya ayrılmış.', ephemeral: true });
        }

        if (islem === 'ban') {
            await hedefUye.ban({ reason: 'Küfür ve kural ihlali sebebiyle log paneli üzerinden banlandı.' });
            await interaction.update({ content: `🔨 **${hedefUye.user.tag}** sunucudan banlandı! (İşlemi Yapan: ${interaction.user})`, components: [] });
        } 
        else if (islem === 'kick') {
            await hedefUye.kick('Küfür sebebiyle log paneli üzerinden atıldı.');
            await interaction.update({ content: `👢 **${hedefUye.user.tag}** sunucudan atıldı! (İşlemi Yapan: ${interaction.user})`, components: [] });
        } 
        else if (islem === 'mute') {
            await hedefUye.timeout(3 * 60 * 1000, 'Küfür sebebiyle log paneli üzerinden susturuldu.');
            await interaction.update({ content: `🔇 **${hedefUye.user.tag}** 3 dakika süreyle susturuldu! (İşlemi Yapan: ${interaction.user})`, components: [] });

            setTimeout(async () => {
                try {
                    await hedefUye.timeout(null, 'Mute süresi doldu.');
                    const sahip = guild.members.cache.find(m => m.user.username.toLowerCase() === 'cikomiko0787');
                    if (sahip) {
                        await sahip.send(`@${hedefUye.user.tag} kullanıcısının küfür sebebiyle atılan mute kaldırıldı.`);
                    }
                } catch (e) {
                    console.error('Mute otomatik açılma / DM hatası:', e);
                }
            }, 3 * 60 * 1000);
        } 
        else if (islem === 'mahkeme') {
            const eskiRoller = hedefUye.roles.cache.map(r => r.id).filter(id => id !== guild.id);
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

            // Bu mahkeme için sohbet geçmişi kaydı başlat
            mahkemeMesajlari.set(mahkemeKanali.id, []);

            await mahkemeKanali.send(`⚖️ **MAHKEME BAŞLATILDI!**\nSanık: ${hedefUye}\n\nKuralları ihlal eden bu kullanıcı ile sunucu sahibi @cikomiko0787 buradan görüşebilir.\nMahkemeyi bitirmek ve kanalı silmek için yetkili **.bitir** yazmalıdır.`);
            await interaction.update({ content: `⚖️ **${hedefUye.user.tag}** için mahkeme kanalı açıldı: ${mahkemeKanali} (İşlemi Yapan: ${interaction.user})`, components: [] });
        }
    } catch (err) {
        console.error('Buton işlem hatası:', err);
        await interaction.reply({ content: '❌ İşlem gerçekleştirilirken bir hata oluştu!', ephemeral: true });
    }
});

// --- SES KANALI GİRİŞ KONTROLÜ ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!newState.member || newState.member.user.bot) return;
        if (!newState.channelId) return;

        const member = newState.member;
        const adminMi = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const rolVarmi = member.roles.cache.size > 1;

        if (!adminMi && !rolVarmi) {
            await member.voice.disconnect('Kurallar onaylanmadı.');
            const genelKanal = newState.guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
            if (genelKanal) {
                await genelKanal.send(`⚠️ ${member}, kurallar’ı onaylamadığınız için sunucuda herhangi bir eylem yapmanız yasaktır.`);
            }
        }
    } catch (err) {
        console.error('Ses kontrol hatası:', err);
    }
});

client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    // --- MAHKEME KANALINDAKİ MESAJLARI KAYDETME ---
    if (message.channel.name.startsWith('mahkeme-')) {
        const kayitlar = mahkemeMesajlari.get(message.channel.id) || [];
        kayitlar.push(`[${new Date().toLocaleString()}] ${message.author.tag}: ${message.content}`);
        mahkemeMesajlari.set(message.channel.id, kayitlar);
    }

    // --- MAHKEME KANALINDA .bitir KOMUTU ---
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
                    const mahkemeMetni = `MAHKEME GEÇMİŞİ\n\nŞU ${tarih} TARİHİNDE AÇILAN MAHKEME KANALINDA ŞU MESAJLAR YAZILDI:\n\n${formatliMesajlar}\n\nTÜRKÇE DİL KONUŞULMUŞTUR`;
                    
                    // Veriyi saklanan mahkemelere kaydet
                    saklananMahkemeler.set('son_mahkeme', mahkemeMetni);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('mahkeme_sakla').setLabel('BU MAHKEMEYİ SAKLA').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('mahkeme_sil').setLabel('BU MAHKEME DOSYASINI SİL').setStyle(ButtonStyle.Danger)
                    );

                    await logChannel.send({ content: mahkemeMetni, components: [row] });
                }

                mahkemeMesajlari.delete(message.channel.id);
                await message.channel.send('⚖️ Mahkeme sona erdi, log kanalına rapor gönderildi ve kanal birazdan siliniyor...');
                setTimeout(async () => {
                    await message.channel.delete().catch(() => {});
                }, 3000);
            } catch (err) {
                console.error('Mahkeme bitir hatası:', err);
            }
            return;
        } else {
            return message.reply('❌ Bu komutu sadece sunucu sahibi veya "çorum" rolüne sahip kişiler kullanabilir!');
        }
    }

    // --- "sa" KONTROLÜ ---
    if (message.content.toLowerCase() === 'sa') {
        await message.channel.send('as hoşgeldin bra');
    }

    const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const rolVarmi = message.member.roles.cache.size > 1;

    // --- ROLÜ OLMAYANLAR İÇİN GENEL MESAJ ENGELİ ---
    if (!adminMi && !rolVarmi) {
        const komutMu = message.content.startsWith('!roller') || message.content.startsWith('!kurallar') || message.content.startsWith('.şikayet') || message.content.startsWith('.sikayet');
        if (!komutMu) {
            try {
                await message.delete();
                await message.channel.send(`⚠️ ${message.author}, kurallar’ı onaylamadığınız için sunucuda herhangi bir eylem yapmanız yasaktır.`);
            } catch (err) {
                console.error('Rol yok mesaj silme hatası:', err);
            }
            return;
        }
    }

    // --- LİNK KORUMASI ---
    const linkKumesi = /(https?:\/\/|discord\.gg|discord\.com\/invite)/i;
    if (linkKumesi.test(message.content)) {
        const yetkiliMi = adminMi || message.member.roles.cache.some(r => ['nuke✅', 'chatyt✅', 'çorum', 'hayatsız'].includes(r.name));
        
        if (!yetkiliMi) {
            try {
                await message.delete();
                await message.channel.send(`❌ ${message.author}, bu sunucuda link ve davet paylaşımı yasaktır!`);
            } catch (err) {
                console.error('Link silme hatası:', err);
            }
            return;
        }
    }

    const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');

    // --- EMOJİ SPAM KORUMASI ---
    const emojiSayisi = (message.content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || []).length;
    if (!adminMi && !corumVarmi && (emojiSayisi > 5 || message.stickers.size > 0)) {
        const userId = message.author.id;
        const simdi = Date.now();
        if (!emojiSpamKontrol.has(userId)) emojiSpamKontrol.set(userId, []);
        let eKayitlari = emojiSpamKontrol.get(userId);
        eKayitlari.push(simdi);
        eKayitlari = eKayitlari.filter(z => simdi - z < 10000);
        emojiSpamKontrol.set(userId, eKayitlari);

        if (eKayitlari.length >= 3) {
            try {
                await message.delete();
                if (!uyariTakip.has(userId)) {
                    uyariTakip.set(userId, true);
                    await message.channel.send(`⚠️ ${message.author}, Flood dan spam yasaktır bir dahaki seferde mute yersiniz.`);
                } else {
                    await message.member.timeout(3 * 60 * 1000, 'Emoji spam');
                    await message.channel.send(`⚠️ ${message.author}, spam yapmaya devam ettiği için 3 dakika süreyle susturuldu!`);
                    uyariTakip.delete(userId);
                }
                emojiSpamKontrol.set(userId, []);
            } catch (err) {
                console.error('Emoji spam hatası:', err);
            }
            return;
        }
    }

    // --- SPAM / FLOOD KORUMASI ---
    const userId = message.author.id;
    const simdi = Date.now();
    
    if (!adminMi && !corumVarmi) {
        if (!spamKontrol.has(userId)) spamKontrol.set(userId, []);
        let kullaniciMesajlari = spamKontrol.get(userId);
        kullaniciMesajlari.push(simdi);
        kullaniciMesajlari = kullaniciMesajlari.filter(zaman => simdi - zaman < 5000);
        spamKontrol.set(userId, kullaniciMesajlari);

        if (kullaniciMesajlari.length >= 4) {
            try {
                await message.delete().catch(() => {});
                if (!uyariTakip.has(userId)) {
                    uyariTakip.set(userId, true);
                    await message.channel.send(`⚠️ ${message.author}, Flood ve spam yasaktır bir dahaki seferde mute yersiniz.`);
                } else {
                    await message.member.timeout(3 * 60 * 1000, 'Flood');
                    await message.channel.send(`⚠️ ${message.author}, uyarıya rağmen spam/flood yaptığı için 3 dakika süreyle susturuldu!`);
                    uyariTakip.delete(userId);
                }
                spamKontrol.set(userId, []);
            } catch (err) {
                console.error('Flood mute hatası:', err);
            }
            return;
        }
    }

    // --- KÜFÜR FİLTRESİ ---
    const komutMu = message.content.startsWith('.sesegir') || message.content.startsWith('.mute') || 
                    message.content.startsWith('.unmute') || message.content.startsWith('.nuke') || 
                    message.content.startsWith('!roller') || message.content.startsWith('!kurallar') ||
                    message.content.startsWith('.şikayet') || message.content.startsWith('.sikayet') ||
                    message.content.startsWith('.ship') || message.content.startsWith('.zekam') || 
                    message.content.startsWith('.zeka') || message.content.startsWith('.kayıtmahkeme') ||
                    message.content.startsWith('.bangeçmişi') || message.content.startsWith('.kickgeçmişi') ||
                    message.content.startsWith('.susturmalar') || message.content.startsWith('.yardım') ||
                    message.content.startsWith('.bitir');

    if (!komutMu && !adminMi) {
        const kelimeler = message.content.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
            .split(/\s+/);

        let isProfane = false;

        for (let kelime of kelimeler) {
            let temizKelime = kelime
                .replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o')
                .replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/9/g, 'g')
                .replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i')
                .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/i̇/g, 'i')
                .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');

            if (blacklist.some(yasakli => temizKelime === yasakli || temizKelime.includes(yasakli))) {
                isProfane = true;
                break;
            }
        }

        if (isProfane) {
            try {
                await message.delete();
                await message.channel.send(`⚠️ ${message.author}, küfür etmek yasaktır!`);
                
                const logChannel = message.guild.channels.cache.find(c => c.name === 'log');
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚨 Küfür Yakalandı!')
                        .addFields(
                            { name: '👤 Kullanıcı', value: `${message.author} (${message.author.tag})`, inline: true },
                            { name: '🆔 Kullanıcı ID', value: `${message.author.id}`, inline: true },
                            { name: '📂 Kanal', value: `${message.channel}`, inline: true },
                            { name: '💬 Edilen Küfür / Mesaj', value: `\`${message.content}\`` }
                        )
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`ban_${message.author.id}`).setLabel('BANLA').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`kick_${message.author.id}`).setLabel('KİCKLE').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`mute_${message.author.id}`).setLabel('MUTE AT').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`mahkeme_${message.author.id}`).setLabel('MAHKEME').setStyle(ButtonStyle.Success)
                    );

                    await logChannel.send({ embeds: [embed], components: [row] });
                }
            } catch (err) {
                console.error('Küfür log hatası:', err);
            }
            return; 
        }
    }

    // --- KOMUTLAR ---

    // --- .kayıtmahkeme KOMUTU (Sadece log kanalında ve Çorum rollüler için) ---
    if (message.content.startsWith('.kayıtmahkeme')) {
        if (message.channel.name.toLowerCase() !== 'log') {
            return message.reply('❌ Bu komut sadece **#log** kanalında kullanılabilir!');
        }
        const corumV = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adm = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!corumV && !adm) {
            return message.reply('❌ Bu komutu sadece "çorum" rolüne sahip yetkililer kullanabilir!');
        }

        const saklanan = saklananMahkemeler.get('son_mahkeme');
        if (!saklanan) {
            return message.reply('❌ Saklanmış veya kayıtlı bir mahkeme dosyası bulunamadı!');
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mahkeme_sakla').setLabel('BU MAHKEMEYİ SAKLA').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('mahkeme_sil').setLabel('BU MAHKEME DOSYASINI SİL').setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({ content: saklanan, components: [row] });
        return;
    }

    // --- .yardım KOMUTU (Sadece log kanalında ve Çorum rollüler için) ---
    if (message.content.startsWith('.yardım')) {
        if (message.channel.name.toLowerCase() !== 'log') {
            return message.reply('❌ Bu komut sadece **#log** kanalında kullanılabilir!');
        }
        const corumV = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
        const adm = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!corumV && !adm) {
            return message.reply('❌ Bu komutu sadece "çorum" rolüne sahip yetkililer kullanabilir!');
        }

        await message.channel.send(
            `Tabii efendim!\n\n` +
            `**Noktalı (.) ve Ünlemli (!) Başlayan Tüm Komutlar:**\n` +
            `• \`!roller\` - Aktif üye ödüllerini ve kurallarını listeler (Çorum özel).\n` +
            `• \`!kurallar\` - Sunucu kurallarını ve onay butonunu gönderir.\n` +
            `• \`.sesegir <kanal>\` - Botu ses kanalına sokar.\n` +
            `• \`.mute @kullanici\` - Belirtilen üyeyi susturur.\n` +
            `• \`.unmute @kullanici\` - Üyenin susturmasını kaldırır.\n` +
            `• \`.nuke\` - Kanalı sıfırlar (Onay butonlu).\n` +
            `• \`.şikayet / .sikayet\` - Şikayet bilgisi verir.\n` +
            `• \`.ship @kullanici\` - Aşk testi yapar (Sadece #eğlence kanalında).\n` +
            `• \`.zekam\` - IQ testi yapar (Sadece #eğlence kanalında).\n` +
            `• \`.zeka\` - Sunucunun en zeki elemanını seçer (Sadece #eğlence kanalında).\n` +
            `• \`.kayıtmahkeme\` - Saklanan mahkeme dosyasını getirir (Sadece #log kanalında).\n` +
            `• \`.bangeçmişi\` - Ban kayıtlarını gösterir.\n` +
            `• \`.kickgeçmişi\` - Kick kayıtlarını gösterir.\n` +
            `• \`.susturmalar\` - Susturma kayıtlarını gösterir.\n` +
            `• \`.yardım\` - Bu yardım menüsünü gösterir (Sadece #log kanalında).`
        );
        return;
    }

    // Diğer geçmiş komutları placeholder yanıtları
    if (message.content.startsWith('.bangeçmişi') || message.content.startsWith('.kickgeçmişi') || message.content.startsWith('.susturmalar')) {
        await message.reply('📂 Sunucu geçmiş kayıtları sistemi aktif.');
        return;
    }

    // --- .zekam KOMUTU (Özel Kişi Torpilleri ve Şakaları Dahil) ---
    if (message.content.startsWith('.zekam')) {
        if (message.channel.name.toLowerCase() !== 'eğlence' && message.channel.name.toLowerCase() !== 'eglence') {
            return message.reply('❌ Bu komut sadece **#eğlence** kanalında kullanılabilir!');
        }
        try {
            const targetUser = message.mentions.users.first() || message.author;
            const usernameLower = message.author.username.toLowerCase();

            let iqPuani;
            let durumMesaji = "";
            let ozelBaslik = "🧠 IQ TESTİ 🧠";
            let embedRenk = '#2ed573';

            // cikomiko0787 için %30 ihtimalle %700 IQ ve mor renkli MASTERMIND!
            if (usernameLower === 'cikomiko0787' && Math.random() < 0.30) {
                iqPuani = 700;
                durumMesaji = `🔮 MASTERMIND!`;
                ozelBaslik = "🧠 MASTERMIND IQ TESTİ 🧠";
                embedRenk = '#9b59b6'; // Mor renk
            } 
            // mvn_zuid010 için sıkılıkla 0, 1, 2 veya bazen rastgele 100 üstü IQ
            else if (usernameLower === 'mvn_zuid010') {
                const ihtimal = Math.random();
                if (ihtimal < 0.85) {
                    iqPuani = Math.floor(Math.random() * 3); // 0, 1 veya 2
                } else {
                    iqPuani = Math.floor(Math.random() * 50) + 101; // 100 ile 150 arası
                }
                embedRenk = iqPuani >= 80 ? '#2ed573' : '#ff4757';
                durumMesaji = iqPuani >= 80 ? `✨ Zeka fışkırıyor maşAllah mübarek!` : `💀 Beynin yok sanırım.`;
            } 
            // Normal kullanıcılar için standart akış
            else {
                iqPuani = Math.floor(Math.random() * 151);
                embedRenk = iqPuani >= 80 ? '#2ed573' : '#ff4757';
                durumMesaji = iqPuani >= 80 ? `✨ Zeka fışkırıyor maşAllah mübarek!` : `💀 Beynin yok sanırım.`;
            }

            const zekamEmbed = new EmbedBuilder()
                .setColor(embedRenk)
                .setTitle(ozelBaslik)
                .setDescription(`📊 **${targetUser.username}** adlı kişinin IQ Seviyesi: \`${iqPuani}\``)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setImage('https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=600&auto=format&fit=crop')
                .setFooter({ text: 'Lexo IQ Ölçüm Sistemi 🧬' });

            await message.reply({ content: `${targetUser} ${durumMesaji}`, embeds: [zekamEmbed] });
        } catch (err) {
            console.error('Zekam komut hatası:', err);
            message.reply('❌ IQ testi yapılırken bir hata oluştu!');
        }
        return;
    }

    // --- .zeka KOMUTU (Sadece eğlence kanalında, gerçek üyeler arasından rastgele seçim) ---
    if (message.content.startsWith('.zeka')) {
        if (message.channel.name.toLowerCase() !== 'eğlence' && message.channel.name.toLowerCase() !== 'eglence') {
            return message.reply('❌ Bu komut sadece **#eğlence** kanalında kullanılabilir!');
        }
        try {
            // Sunucudaki üyeleri önbelleğe alıp bot olmayanları filtreleyelim
            await message.guild.members.fetch();
            const gercekUyeler = message.guild.members.cache.filter(member => !member.user.bot);

            if (gercekUyeler.size === 0) {
                return message.reply('❌ Sunucuda seçilebilecek gerçek üye bulunamadı!');
            }

            // Rastgele bir gerçek üye seç
            const rastgeleUyeArray = Array.from(gercekUyeler.values());
            const secilenUye = rastgeleUyeArray[Math.floor(Math.random() * rastgeleUyeArray.length)];

            const zekaEmbed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('👑 SUNUCUNUN EN ZEKİ ELEMANI!')
                .setDescription(`Sunucunun en zekisi ${secilenUye}'dır. Helal olsun ona!\n\n**MAŞALLAH.**`)
                .setThumbnail(secilenUye.user.displayAvatarURL({ dynamic: true }))
                .setImage('https://images.unsplash.com/photo-1567427017947-545c5f2d16ad?q=80&w=600&auto=format&fit=crop') // Başarı/Kupa temalı görsel
                .setFooter({ text: 'Lexo Zeka Ligi 🏆' });

            await message.channel.send({ embeds: [zekaEmbed] });
        } catch (err) {
            console.error('Zeka komut hatası:', err);
            message.reply('❌ Zeka seçimi yapılırken bir hata oluştu!');
        }
        return;
    }

    // --- .ship KOMUTU (Sadece eğlence kanalında) ---
    if (message.content.startsWith('.ship')) {
        if (message.channel.name.toLowerCase() !== 'eğlence' && message.channel.name.toLowerCase() !== 'eglence') {
            return message.reply('❌ Bu komut sadece **#eğlence** kanalında kullanılabilir!');
        }
        try {
            const targetUser = message.mentions.users.first();
            if (!targetUser) return message.reply('❌ Lütfen shiplemek için bir kullanıcı etiketle! Örnek: `.ship @kullanici`');

            const yuzde = Math.floor(Math.random() * 101);
            const user1 = message.author;
            const user2 = targetUser;

            const shipEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('💖 Aşk Testi (.ship) 💕')
                .setDescription(`💘 **${user1.username}** ❤️ **${user2.username}**\n\n✨ **Uyum Yüzdesi:** \`%${yuzde}\` ✨`)
                .setThumbnail(user1.displayAvatarURL({ dynamic: true }))
                .setImage(user2.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Lexo Aşk Ölçer Sistemi 💘' });

            await message.channel.send({ embeds: [shipEmbed] });
        } catch (err) {
            console.error('Ship komut hatası:', err);
        }
        return;
    }

    // --- !roller KOMUTU ---
    if (message.content.startsWith('!roller')) {
        try {
            await message.delete().catch(() => {});

            const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');
            const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);

            if (!corumVarmi && !adminMi) {
                return message.reply('❌ Bu komutu sadece "çorum" rolüne sahip yetkililer kullanabilir!');
            }

            const rollerEmbed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setTitle('🏅 AKTİF ÜYE ÖDÜLLERİ VE YETKİ KURALLARI')
                .setDescription('Sunucumuzda 1.000 mesaj gönderen üyelere **nuke✅**, 2.000 mesaj gönderen üyelere ise **chatyt✅** rolü verilecektir. (Şimdilik.)\n\n---')
                .addFields(
                    { 
                        name: '🔇 chatyt✅', 
                        value: 'Bu role sahip olan üyeler, diğer üyeleri etiketleyerek susturma yetkisine sahiptir.\n' +
                               '• Susturmak için: `.mute @kullanici`\n' +
                               '• Susturmayı kaldırmak için: `.unmute @kullanici`'
                    },
                    { 
                        name: '💥 nuke✅', 
                        value: 'Bu role sahip olan üyeler, yetkili oldukları kanallardaki mesajları silebilir (.nuke).'
                    }
                )
                .setFooter({ text: 'Lexo Güvenlik ve Bilgilendirme Sistemi' })
                .setTimestamp();

            await message.channel.send({ embeds: [rollerEmbed] });
        } catch (err) { 
            console.error('Roller komut hatası:', err); 
        }
        return;
    }

    if (message.content.startsWith('!kurallar')) {
        try {
            await message.delete().catch(() => {});
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`kabul_et_${message.author.id}`).setLabel('✅ Kabul Ediyorum').setStyle(ButtonStyle.Success)
            );
            await message.channel.send({ content: `📜 **SUNUCU KURALLARI**\n1. Saygı göster.\n2. Küfür etme.\n3. Reklam yapma.`, components: [row] });
        } catch (err) { console.error(err); }
        return;
    }

    // --- ŞİKAYET KOMUTU ---
    if (message.content.startsWith('.şikayet') || message.content.startsWith('.sikayet')) {
        try {
            await message.delete().catch(() => {});
            await message.channel.send(`Sunucumuzla ilgili herhangi bir şikâyetiniz varsa @cikomiko0787 kullanıcısına DM üzerinden ulaşarak şikâyetinizi iletebilirsiniz.`);
        } catch (err) { console.error(err); }
        return;
    }

    if (message.content.startsWith('.sesegir')) {
        try {
            if (!adminMi && !rolVarmi) return message.reply('❌ Kuralları onaylamadığınız için sese giremezsiniz.');
            const kanalAdi = message.content.slice('.sesegir'.length).trim();
            if (!kanalAdi) return message.reply('❌ Kanal adı yazın!');

            const hedefKanal = message.guild.channels.cache.find(c => c.name.toLowerCase() === kanalAdi.toLowerCase() && c.type === ChannelType.GuildVoice);
            if (!hedefKanal) return message.reply('❌ Kanal bulunamadı!');

            joinVoiceChannel({
                channelId: hedefKanal.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfMute: false,
                selfDeaf: false
            });
            await message.channel.send('✅ Sese girildi.');
        } catch (err) { console.error(err); }
        return;
    }

    if (message.content.startsWith('.mute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        const yetki = adminMi || (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetki) return message.reply('❌ Yetkiniz yok!');
        const targetUser = message.mentions.members.first();
        if (!targetUser) return message.reply('❌ Kullanıcı etiketleyin!');

        try {
            await targetUser.timeout(3 * 60 * 1000, 'Mutelendi');
            await message.channel.send(`✅ ${targetUser.user.username} susturuldu.`);
        } catch (err) { console.error(err); }
        return;
    }

    if (message.content.startsWith('.unmute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        const yetki = adminMi || (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetki) return message.reply('❌ Yetkiniz yok!');
        const targetUser = message.mentions.members.first();
        if (!targetUser) return message.reply('❌ Kullanıcı etiketleyin!');

        try {
            await targetUser.timeout(null, 'Açıldı');
            await message.channel.send(`✅ ${targetUser.user.username} açıldı.`);
        } catch (err) { console.error(err); }
        return;
    }

    // --- NUKE SİSTEMİ (.nuke - Onay Butonlu) ---
    if (message.content.startsWith('.nuke')) {
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

// --- KEEP-ALIVE SUNUCUSU ---
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Lexo Bot Aktif!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[+] Keep-alive ${PORT} portunda.`);
});

client.login(process.env.DISCORD_TOKEN);
