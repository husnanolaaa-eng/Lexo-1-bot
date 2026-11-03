const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot aktif ve calisiyor!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Web sunucusu ${PORT} portunda calisiyor.`);
});

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

const kufurler = [
    'aq', 'amina', 'amk', 'orospu', 'sik', 'piç', 'oc', 'orospu çocuğu',
    'Yarrak', 'amcık', 'göt', 'sikik', 'amina koyim'
];

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const icerikKucuk = message.content.toLowerCase();
    
    // 1. Küfür Koruması ve Özel LOG Kanalı (Sadece Bot ve Yönetici Görebilir)
    const kufurVarMi = kufurler.some(kufur => icerikKucuk.includes(kufur));
    if (kufurVarMi) {
        try {
            await message.delete();
            let logKanali = message.guild.channels.cache.find(c => c.name.toLowerCase() === 'log');
            if (!logKanali) {
                logKanali = await message.guild.channels.create({
                    name: 'log',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: message.guild.id, // @everyone (herkes)
                            deny: [PermissionFlagsBits.ViewChannel], // Kimse göremez
                        },
                        {
                            id: client.user.id, // Bot görebilir
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        }
                    ]
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

    // 2. Link ve Davet Engeli (Yalnızca Sunucu Başkanı / Yönetici atabilir)
    const linkVarMi = icerikKucuk.includes('discord.gg/') || icerikKucuk.includes('http://') || icerikKucuk.includes('https://');
    if (linkVarMi && !message.member.permissions.has('Administrator')) {
        await message.delete().catch(() => {});
        return message.channel.send(`${message.author}, bu sunucuda link veya davet bağlantısı paylaşmak yasak!`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 4000);
        });
    }

    // 3. .sa Komutu
    if (message.content.trim().toLowerCase() === 'sa') {
        await message.reply('as hoşgeldin BRA');
    }

    // 4. !kurallar Komutu
    if (message.content.trim() === '!kurallar') {
        const kurallarMetni = `📜 **SUNUCU KURALLARI VE TOPLULUK AÇIKLAMASI**

Sunucumuz, arkadaşlık ve dostluk amacıyla kurulmuştur. Bütün üyelerin aşağıdaki kurallara uyması zorunludur:

1. **Saygı ve hoşgörü:** Herkes birbirine saygılı davranmalıdır. Kimse kimseyi küçük düşüremez.
2. **Küfür ve hakaret:** Sunucumuzda küfür, hakaret yasaktır; gizli log kanalına kaydedilir.
3. **Şantaj, tehdit ve RAT:** Her türlü şantaj, tehdit, kişisel bilgileri izinsiz paylaşma ve RAT gibi zararlı yazılımlar kesinlikle yasaktır. Cezası doğrudan kalıcı sunucu yasağıdır.
4. **Link ve Reklam:** Kesinlikle yasaktır.

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

    // 5. .mute Komutu (3 Dakika)
    if (message.content.trim().startsWith('.mute')) {
        if (!message.member.permissions.has('ModerateMembers') && !message.member.permissions.has('Administrator')) {
            return message.reply('Bu komutu kullanmak için yetkin yok!');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('Bir kullanıcıyı etiketleyin. Örnek: `.mute @kullanici`');
        }

        try {
            let muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted' || r.name.toLowerCase() === 'mute');
            if (!muteRole) {
                muteRole = await message.guild.roles.create({
                    name: 'Muted',
                    color: '#808080',
                    permissions: []
                });

                message.guild.channels.cache.forEach(async (channel) => {
                    await channel.permissionOverwrites.create(muteRole, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: true
                    }).catch(() => {});
                });
            }

            await targetUser.roles.add(muteRole);
            await message.channel.send(`**${targetUser.user.tag}** susturuldu! 3 dakika sonra otomatik yeniden açılacaktır.`);

            setTimeout(async () => {
                if (targetUser.roles.cache.has(muteRole.id)) {
                    await targetUser.roles.remove(muteRole);
                    message.channel.send(`**${targetUser.user.tag}** kullanıcısının mutesi otomatik olarak kaldırıldı.`);
                }
            }, 3 * 60 * 1000);

        } catch (error) {
            console.error(error);
            message.reply('Mute atılırken bir hata oluştu.');
        }
    }

    // 6. .nuke Komutu (Kanalı klonlamadan, direkt mesajları tertemiz siler)
    if (message.content.trim() === '.nuke') {
        if (!message.member.permissions.has('ManageChannels') && !message.member.permissions.has('Administrator')) {
            return message.reply('Bu komutu kullanmak için yetkin yok!');
        }

        const confirmMsg = await message.channel.send('Nuke atacağım. Emin misiniz? (evet yazın)');
        
        const filter = m => m.author.id === message.author.id && m.content.toLowerCase() === 'evet';
        const collector = message.channel.createMessageCollector({ filter, time: 10000, max: 1 });

        collector.on('collect', async () => {
            await message.channel.send('tamam');
            setTimeout(async () => {
                try {
                    let fetched;
                    do {
                        fetched = await message.channel.messages.fetch({ limit: 100 });
                        if (fetched.size > 0) {
                            await message.channel.bulkDelete(fetched, true).catch(() => {});
                        }
                    } while (fetched.size >= 2);
                    
                    const infoMsg = await message.channel.send('💥 Kanal başarıyla nuke’lendi ve temizlendi!');
                    setTimeout(() => infoMsg.delete().catch(() => {}), 4000);
                } catch (err) {
                    console.error('Nuke hatası:', err);
                }
            }, 3000);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                confirmMsg.edit('Nuke işlemi iptal edildi.').catch(() => {});
            }
        });
    }
});

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
            await interaction.reply({ content: 'Rol verilirken bir hata oluştu.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
