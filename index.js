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
const { joinVoiceChannel } = require('@discordjs/voice'); // Ses kanalı için gerekli

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // Ses kanalları için gerekli niyet
    ]
});

// Yasaklı Kelimeler Listesi
const blacklist = ['oç', 'sg', 'prn', ' amk ', 'aq']; 

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Güvenlik Sistemleri');

    // --- SES KASIYORUZ KANALINA GİRİŞ VE KENDİNİ MUTELEME ---
    // Sunucudaki "SES KASIYORUZ" adlı ses kanalını bulup otomatik girer ve kendini muteler
    const sesKanalimiz = client.channels.cache.find(c => c.name === 'SES KASIYORUZ' && c.type === ChannelType.GuildVoice);
    if (sesKanalimiz) {
        try {
            const connection = joinVoiceChannel({
                channelId: sesKanalimiz.id,
                guildId: sesKanalimiz.guild.id,
                adapterCreator: sesKanalimiz.guild.voiceAdapterCreator,
                selfMute: true, // Kendini susturur (mute)
                selfDeaf: false
            });
            console.log('[+] Bot "SES KASIYORUZ" kanalına katıldı ve sesini kapattı.');
        } catch (err) {
            console.error('Ses kanalına bağlanma hatası:', err);
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- 1. KANAL DIŞI "s?u" ENGELLEYİCİ VE STATBOT TEMİZLİĞİ ---
    if (message.content.startsWith('s?u')) {
        if (message.channel.name !== 'bot-komut') {
            try {
                // Kullanıcının mesajını ve hemen ardından gelecek Statbot cevabını yakalamak için kısa süreli mesaj dinleyici
                const channel = message.channel;
                const authorId = message.author.id;

                await message.delete().catch(() => {});

                // Statbot'un vereceği yanıtı yakalamak için 3 saniyelik collector
                const filterStat = m => m.author.bot && (m.content.includes(authorId) || m.embeds.length > 0);
                const collectorStat = channel.createMessageCollector({ filter: filterStat, time: 3000, max: 1 });

                collectorStat.on('collect', async statMsg => {
                    await statMsg.delete().catch(() => {});
                });

                await channel.send(`${message.author}, Lütfen Bot-Komuta gidiniz.`);
            } catch (err) {
                console.error('s?u engelleme hatası:', err);
            }
            return;
        }
    }

    // --- 2. ÖZEL ETİKET YANITI (@Lexocan 1) ---
    // Not: Botun kendi kullanıcı adı veya etiketlenme durumunu kontrol eder
    if (message.mentions.has(client.user) && message.content.includes('1')) {
        return message.reply('Buyrun?');
    }

    // --- 3. KÜFÜR VE ARGO FİLTRESİ ---
    const contentLower = message.content.toLowerCase();
    const isProfane = blacklist.some(word => contentLower.includes(word));

    if (isProfane) {
        try {
            await message.delete();
            const logChannel = message.guild.channels.cache.find(c => c.name === 'log');
            if (logChannel) {
                await logChannel.send(`⚠️ **Yasaklı Kelime Yakalandı!**\nÜye: ${message.author} (${message.author.tag})\nKanal: ${message.channel}\nMesaj: \`${message.content}\``);
            }
        } catch (err) {
            console.error('Küfür filtreleme hatası:', err);
        }
        return; 
    }

    // --- 4. UNMUTE KOMUTU (.unmute) ---
    if (message.content.startsWith('.unmute')) {
        const targetUser = message.mentions.members.first();

        if (!targetUser) {
            return message.reply('❌ Lütfen susturması kaldırılacak kişiyi etiketle! Örnek: `.unmute @kullanici`');
        }

        try {
            // Zaman aşımı (Timeout) cezasını kaldırır
            if (targetUser.communicationDisabledUntilTimestamp) {
                await targetUser.timeout(null, 'Unmute komutu ile açıldı.');
            }

            // Eğer "Mahkûm" rolü varsa onu da sökebiliriz
            let mahkumRole = message.guild.roles.cache.find(r => r.name === 'Mahkûm');
            if (mahkumRole && targetUser.roles.cache.has(mahkumRole.id)) {
                await targetUser.roles.remove(mahkumRole);
            }

            await message.channel.send(`Lexoda (${targetUser}'sün) susturulması başarıyla kaldırıldı!`);
        } catch (err) {
            console.error('Unmute hatası:', err);
            message.reply('❌ Kullanıcının susturması kaldırılırken bir hata oluştu (Yetkim yetmiyor olabilir).');
        }
    }

    // --- 5. KURALLAR KOMUTU (.kurallar) ---
    if (message.content.startsWith('.kurallar')) {
        try {
            await message.delete().catch(() => {});

            const kuralEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('📜 Sunucu Kuralları')
                .setDescription('Sunucumuzun huzuru ve düzeni için aşağıdaki kurallara uymanız gerekmektedir.')
                .addFields(
                    { name: '1️⃣ Saygı ve Sevgi', value: 'Üyeler arasında küfür, hakaret, aşağılama ve nefret söylemi kesinlikle yasaktır.' },
                    { name: '2️⃣ Reklam ve Link', value: 'İzinsiz sunucu reklamı, DM üzerinden reklam ve her türlü zararlı link/dosya paylaşımı yasaktır.' },
                    { name: '3️⃣ Spam ve Flood', value: 'Sohbet kanalını gereksiz yere kirletmek, üst üste aynı mesajı atmak veya caps lock açarak yazmak yasaktır.' },
                    { name: '4️⃣ Yetkili Kararları', value: 'Yetkililerin uyarılarına ve yönlendirmelerine karşı gelmek yasaktır.' }
                )
                .setFooter({ text: 'Lexo Güvenlik Sistemleri', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await message.channel.send({ embeds: [kuralEmbed] });
        } catch (err) {
            console.error('Kurallar komutu hatası:', err);
        }
    }

    // --- 6. NUKE SİSTEMİ (Kişi Kilidi ile Güvenli) ---
    if (message.content.startsWith('.nuke')) {
        const komutuYazan = message.author;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('nuke_evet')
                .setLabel('Evet, Sıfırla')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('nuke_hayir')
                .setLabel('İptal')
                .setStyle(ButtonStyle.Secondary)
        );

        const confirmMsg = await message.channel.send({
            content: `⚠️ ${komutuYazan}, bu kanalı tamamen sıfırlamak (nuke) istediğine emin misin?`,
            components: [row]
        });

        const filter = i => i.user.id === komutuYazan.id;
        const collector = confirmMsg.createMessageComponentCollector({ filter, time: 20000 });

        collector.on('collect', async i => {
            if (i.customId === 'nuke_evet') {
                await i.update({ content: '🔥 Kanal nuke’leniyor...', components: [] });
                try {
                    const position = message.channel.position;
                    const newChannel = await message.channel.clone({ position: position });
                    await message.channel.delete();
                    await newChannel.send(`✅ Kanal ${komutuYazan} tarafından başarıyla sıfırlandı.`);
                } catch (err) {
                    console.error('Nuke hatası:', err);
                }
            } else {
                await i.update({ content: '❌ Nuke işlemi iptal edildi.', components: [] });
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                await confirmMsg.edit({ content: '⏱️ Süre bitti, nuke iptal edildi.', components: [] }).catch(() => {});
            }
        });
    }

    // --- 7. MAHKEME SİSTEMİ ---
    if (message.content.startsWith('.mahkeme')) {
        const targetUser = message.mentions.members.first();

        if (!targetUser) {
            return message.reply('❌ Lütfen mahkemeye çıkarılacak kişiyi etiketle! Örnek: `.mahkeme @kullanici`');
        }

        try {
            let mahkumRole = message.guild.roles.cache.find(r => r.name === 'Mahkûm');
            if (!mahkumRole) {
                mahkumRole = await message.guild.roles.create({
                    name: 'Mahkûm',
                    color: '#2f3136',
                    permissions: []
                });
            }

            await targetUser.roles.add(mahkumRole);

            const courtChannel = await message.guild.channels.create({
                name: `mahkeme-${targetUser.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: message.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: targetUser.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: message.author.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages]
                    }
                ]
            });

            await courtChannel.send(`⚖️ ${targetUser}, mahkeme salonuna hoş geldin. ${message.author} hakemliğinde duruşma başladı. Duruşmayı bitirmek için yetkili **.bitir** yazabilir.`);

            const autoDeleteTimer = setTimeout(async () => {
                if (courtChannel.guild) {
                    await targetUser.roles.remove(mahkumRole).catch(() => {});
                    await courtChannel.delete().catch(() => {});
                }
            }, 3600000); // 1 Saat

            const filterBitir = m => m.content === '.bitir' && (m.author.id === message.author.id || m.member.permissions.has(PermissionsBitField.Flags.Administrator));
            const collectorBitir = courtChannel.createMessageCollector({ filter: filterBitir, time: 3600000 });

            collectorBitir.on('collect', async m => {
                clearTimeout(autoDeleteTimer);
                await m.reply('⚖️ Mahkeme sonlandırıldı, kanal birazdan kapatılıyor...');
                await targetUser.roles.remove(mahkumRole).catch(() => {});
                setTimeout(async () => {
                    await courtChannel.delete().catch(() => {});
                }, 3000);
            });

        } catch (err) {
            console.error('Mahkeme sistemi hatası:', err);
            message.reply('❌ Mahkeme kurulurken bir hata oluştu.');
        }
    }
});

// --- RENDER UYKU ÖNLEYİCİ (KEEP-ALIVE) ---
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Lexo Bot Aktif ve Dinlemede!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[+] Keep-alive sunucusu ${PORT} portunda çalışıyor.`);
});

client.login(process.env.DISCORD_TOKEN);
