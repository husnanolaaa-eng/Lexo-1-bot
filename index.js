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
});

let sonMesajlar = new Map();

client.on('messageCreate', async message => {
    if (message.author.bot) {
        if (message.channel.name !== 'bot-komut') {
            const sonYazan = sonMesajlar.get(message.channel.id);
            if (sonYazan && (Date.now() - sonYazan.zaman < 4000)) {
                await message.delete().catch(() => {});
            }
        }
        return;
    }

    // --- SES KANALINA GİRİŞ KOMUTU (.sesegir) ---
    // Artık komutu yazan kişinin bağlı olduğu ses kanalına direkt girer!
    if (message.content.startsWith('.sesegir')) {
        try {
            const sesKanalimiz = message.member.voice.channel;
            
            if (!sesKanalimiz) {
                return message.reply('❌ Önce bir ses kanalına girmelisin kanka, yoksa nereye gireceğini bilemem!');
            }

            joinVoiceChannel({
                channelId: sesKanalimiz.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfMute: true,  // Kendini susturur
                selfDeaf: false
            });

            await message.channel.send(`✅ **${sesKanalimiz.name}** kanalına giriş yapıldı ve kendim mutelendim!`);
        } catch (err) {
            console.error('Ses kanalına girme hatası:', err);
            message.reply('❌ Ses kanalına bağlanırken bir hata oluştu: ' + err.message);
        }
        return;
    }

    // --- KANAL DIŞI "s?u" ENGELLEYİCİ ---
    const mesajIcerigi = message.content.toLowerCase();
    if (mesajIcerigi.startsWith('s?u') || mesajIcerigi.startsWith('S?u')) {
        if (message.channel.name !== 'bot-komut') {
            try {
                sonMesajlar.set(message.channel.id, { userId: message.author.id, zaman: Date.now() });

                await message.delete().catch(() => {});
                await message.channel.send(`${message.author}, Lütfen Bot-Komuta gidiniz.`);
            } catch (err) {
                console.error('s?u engelleme hatası:', err);
            }
            return;
        }
    }

    // --- ÖZEL ETİKET YANITI (@Lexocan 1) ---
    if (message.mentions.has(client.user) && message.content.includes('1')) {
        return message.reply('Buyrun?');
    }

    // --- KÜFÜR FİLTRESİ ---
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

    // --- UNMUTE KOMUTU (.unmute) ---
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

    // --- KURALLAR KOMUTU (.kurallar) ---
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

    // --- NUKE SİSTEMİ (.nuke) ---
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
