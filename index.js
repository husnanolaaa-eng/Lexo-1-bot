const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const http = require('http');

// Render port hatası vermesin diye mini web sunucusu
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot aktif ve calisiyor!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Web sunucusu ${PORT} portunda calisiyor.`);
});

// Discord Bot Ayarları
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`Bot ${client.user.tag} olarak giriş yaptı!`);
});

// Küfür Kelimeleri Listesi (Geliştirebilirsin)
const kufurler = [
    'aq', 'amina', 'amk', 'orospu', 'sik', 'piç', 'oc', 'orospu çocuğu',
    'Yarrak', 'amcık', 'göt', 'sikik', 'amina koyim'
];

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. Küfür Koruması ve LOG Kanalına Bildirim
    const icerikKucuk = message.content.toLowerCase();
    const kufurVarMi = kufurler.some(kufur => icerikKucuk.includes(kufur));

    if (kufurVarMi) {
        try {
            // Mesajı sil
            await message.delete();
            
            // Log kanalını bul veya oluştur
            let logKanali = message.guild.channels.cache.find(c => c.name === 'log' || c.name === 'LOG');
            if (!logKanali) {
                logKanali = await message.guild.channels.create({
                    name: 'log',
                    type: ChannelType.GuildText,
                }).catch(() => null);
            }

            if (logKanali) {
                await logKanali.send(`🚨 **KÜFÜR TESPİT EDİLDİ!**\n> **Kullanıcı:** ${message.author} (${message.author.tag})\n> **Kanal:** ${message.channel}\n> **Mesaj:** "${message.content}"`);
            }
        } catch (err) {
            console.error('Küfür log hatası:', err);
        }
        return;
    }

    // 2. Link ve Davet Engeli (Sunucu başkanı/yönetici hariç)
    const linkVarMi = icerikKucuk.includes('discord.gg/') || icerikKucuk.includes('http://') || icerikKucuk.includes('https://');
    if (linkVarMi && !message.member.permissions.has('Administrator')) {
        await message.delete().catch(() => {});
        return message.channel.send(`${message.author}, bu sunucuda link veya davet bağlantısı paylaşmak yasak!`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
        });
    }

    // 3. .sa Komutu (Tekrarı önlemek için birebir eşleşme)
    if (message.content.trim().toLowerCase() === 'sa') {
        await message.reply('as hoşgeldin BRA');
    }

    // 4. !ping Komutu
    if (message.content.trim() === '!ping') {
        await message.reply('Pong!');
    }

    // 5. !kurallar Komutu
    if (message.content.trim() === '!kurallar') {
        const kurallarMetni = `📜 **SUNUCU KURALLARI VE TOPLULUK AÇIKLAMASI**

Sunucumuz, arkadaşlık, dostluk ve güzel vakit geçirmek amacıyla oluşturulmuş bir topluluk sunucusudur.

1. **Saygı ve hoşgörü:** Herkes birbirine saygılı davranmalıdır.
2. **Küfür ve hakaret:** Yasaktır, log kanallarına kaydedilir.
3. **Link ve Reklam:** Kesinlikle yasaktır.

Kuralları kabul ettiyseniz aşağıdaki **✅** butonuna basın ve içeri girin! ❤️`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('kabul_et')
                    .setLabel('Kuralları Kabul Ediyorum')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await message.channel.send({ content: kurallarMetni, components: [row] });
    }

    // 6. .mute <kullanici> Komutu
    if (message.content.trim().startsWith('.mute')) {
        if (!message.member.permissions.has('ModerateMembers') && !message.member.permissions.has('Administrator')) {
            return message.reply('Bu komutu kullanmak için yetkin yok!');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('Lütfen mute atılacak bir kullanıcıyı etiketleyin. Örnek: `.mute @kullanici`');
        }

        try {
            // Mute rolünü bul veya oluştur (Metin kanallarında konuşmayı tamamen kapatır)
            let muteRole = message.guild.roles.cache.find(r => r.name === 'Muted' || r.name === 'mute');
            if (!muteRole) {
                muteRole = await message.guild.roles.create({
                    name: 'Muted',
                    color: '#808080',
                    permissions: []
                });

                // Her kanalda yazma iznini kapat
                message.guild.channels.cache.forEach(async (channel) => {
                    await channel.permissionOverwrites.create(muteRole, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: true // Sese girebilir ama yazı yazamaz
                    }).catch(() => {});
                });
            }

            await targetUser.roles.add(muteRole);
            await message.channel.send(`**${targetUser.user.tag}** susturuldu! 3 dakika sonra otomatik yeniden açılacaktır.`);

            // 3 dakika sonra mutesini otomatik aç
            setTimeout(async () => {
                if (targetUser.roles.cache.has(muteRole.id)) {
                    await targetUser.roles.remove(muteRole);
                    message.channel.send(`**${targetUser.user.tag}** kullanıcısının mutesi otomatik olarak kaldırıldı.`);
                }
            }, 3 * 60 * 1000); // 3 dakika

        } catch (error) {
            console.error(error);
            message.reply('Mute atılırken bir hata oluştu, botun yetkilerini kontrol edin.');
        }
    }

    // 7. .nuke Komutu
    if (message.content.trim() === '.nuke') {
        if (!message.member.permissions.has('ManageChannels') && !message.member.permissions.has('Administrator')) {
            return message.reply('Bu komutu kullanmak için yetkin yok!');
        }

        const confirmMsg = await message.channel.send('Nuke atacağım. Emin misiniz? (Evet yazarak onaylayın)');
        
        const filter = m => m.author.id === message.author.id && m.content.toLowerCase() === 'evet';
        const collector = message.channel.createMessageCollector({ filter, time: 10000, max: 1 });

        collector.on('collect', async () => {
            await message.channel.send('tamam');
            setTimeout(async () => {
                try {
                    const channel = message.channel;
                    const position = channel.position;
                    const newChannel = await channel.clone({ position: position });
                    await channel.delete();
                    await newChannel.send('💥 Kanal başarıyla nuke’lendi!');
                } catch (err) {
                    console.error('Nuke hatası:', err);
                }
            }, 3000); // 3 saniye sonra
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                confirmMsg.edit('Nuke işlemi zaman aşımına uğradı ve iptal edildi.').catch(() => {});
            }
        });
    }
});

// Butona basıldığında otomatik "hayatsız" rolü verme
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'kabul_et') {
        const roleName = 'hayatsız';
        const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName);

        if (!role) {
            return interaction.reply({ content: `Sunucuda '${roleName}' adında bir rol bulunamadı! Lütfen önce bu isimde bir rol oluşturun.`, ephemeral: true });
        }

        try {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: 'Kuralları kabul ettin ve **hayatsız** rolünü aldın! Keyifli sohbetler.', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Rol verilirken bir hata oluştu, lütfen botun yetkilerini kontrol edin.', ephemeral: true });
        }
    }
});

// Botu Token ile başlat
client.login(process.env.TOKEN);
