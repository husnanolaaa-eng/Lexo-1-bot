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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Yasaklı Kelimeler Listesi
const blacklist = ['oç', 'sg', 'prn', ' amk ', 'aq']; 

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Güvenlik Sistemleri');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- 1. KÜFÜR VE ARGO FİLTRESİ ---
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

    // --- 2. KURALLAR KOMUTU (.kurallar) ---
    if (message.content.startsWith('.kurallar')) {
        try {
            await message.delete().catch(() => {}); // Komut mesajını temizle

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

    // --- 3. NUKE SİSTEMİ (Kişi Kilidi ile Güvenli) ---
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

    // --- 4. MAHKEME SİSTEMİ ---
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

client.login(process.env.DISCORD_TOKEN);
