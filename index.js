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

const blacklist = ['oç', 'sg', 'prn', ' amk ', 'aq']; 

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Güvenlik Sistemleri');

    // --- SES KASIYORUZ KANALINA GİRİŞ VE MUTE ---
    const sesKanalimiz = client.channels.cache.find(c => c.name === 'SES KASIYORUZ' && c.type === ChannelType.GuildVoice);
    if (sesKanalimiz) {
        try {
            joinVoiceChannel({
                channelId: sesKanalimiz.id,
                guildId: sesKanalimiz.guild.id,
                adapterCreator: sesKanalimiz.guild.voiceAdapterCreator,
                selfMute: true,
                selfDeaf: false
            });
            console.log('[+] Bot "SES KASIYORUZ" kanalına katıldı ve sesini kapattı.');
        } catch (err) {
            console.error('Ses kanalına bağlanma hatası:', err);
        }
    } else {
        console.log('[!] "SES KASIYORUZ" adında bir ses kanalı bulunamadı!');
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- 1. KANAL DIŞI "s?u" ENGELLEYİCİ VE STATBOT TEMİZLİĞİ ---
    // Büyük/küçük harf duyarsız kontrol (s?u veya S?u)
    if (message.content.toLowerCase().startsWith('s?u')) {
        if (message.channel.name !== 'bot-komut') {
            try {
                const channel = message.channel;
                const authorId = message.author.id;

                // Kullanıcının mesajını anında sil
                await message.delete().catch(() => {});

                // Statbot'un vereceği yanıtı yakalamak için 3 saniyelik dinleyici
                const filterStat = m => m.author.bot && (m.content.includes(authorId) || m.embeds.length > 0);
                const collectorStat = channel.createMessageCollector({ filter: filterStat, time: 3000, max: 1 });

                collectorStat.on('collect', async statMsg => {
                    await statMsg.delete().catch(() => {});
                });

                // Kullanıcıyı uyar
                await channel.send(`${message.author}, Lütfen Bot-Komuta gidiniz.`);
            } catch (err) {
                console.error('s?u engelleme hatası:', err);
            }
            return;
        }
    }

    // --- 2. ÖZEL ETİKET YANITI (@Lexocan 1) ---
    if (message.mentions.has(client.user) && message.content.includes('1')) {
        return message.reply('Buyrun?');
    }

    // --- 3. KÜFÜR FİLTRESİ ---
    const contentLower = message.content.toLowerCase();
    const isProfane = blacklist.some(word => contentLower.includes(word));

    if (isProfane) {
        try {
            await message.delete();
            const logChannel = message.guild.channels.cache.find(c => c.name === 'log');
            if (logChannel) {
                await logChannel.send(`⚠️ **Yasaklı Kelime Yakalandı!**\nÜye: ${message.author}\nKanal: ${message.channel}`);
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
            if (targetUser.communicationDisabledUntilTimestamp) {
                await targetUser.timeout(null, 'Unmute komutu ile açıldı.');
            }

            let mahkumRole = message.guild.roles.cache.find(r => r.name === 'Mahkûm');
            if (mahkumRole && targetUser.roles.cache.has(mahkumRole.id)) {
                await targetUser.roles.remove(mahkumRole);
            }

            await message.channel.send(`Lexoda (${targetUser}) susturulması başarıyla kaldırıldı!`);
        } catch (err) {
            console.error('Unmute hatası:', err);
            message.reply('❌ Yetkim yetmediği için susturmayı kaldıramadım.');
        }
    }

    // --- 5. KURALLAR KOMUTU (.kurallar) ---
    if (message.content.startsWith('.kurallar')) {
        try {
            await message.delete().catch(() => {});
            const kuralEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('📜 Sunucu Kuralları')
                .setDescription('Sunucumuzun kurallarına uymaya özen gösterelim.');
            await message.channel.send({ embeds: [kuralEmbed] });
        } catch (err) {
            console.error(err);
        }
    }

    // --- 6. NUKE SİSTEMİ (.nuke) ---
    if (message.content.startsWith('.nuke')) {
        const komutuYazan = message.author;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nuke_evet').setLabel('Evet, Sıfırla').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('nuke_hayir').setLabel('İptal').setStyle(ButtonStyle.Secondary)
        );

        const confirmMsg = await message.channel.send({
            content: `⚠️ ${komutuYazan}, bu kanalı sıfırlamak istediğine emin misin?`,
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
                    await newChannel.send(`✅ Kanal ${komutuYazan} tarafından sıfırlandı.`);
                } catch (err) {
                    console.error(err);
                }
            } else {
                await i.update({ content: '❌ Nuke iptal edildi.', components: [] });
            }
        });
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
    console.log(`[+] Keep-alive ${PORT} portunda dinlemede.`);
});

client.login(process.env.DISCORD_TOKEN);
