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

// Genişletilmiş Küresel, Türkçe, İngilizce, Arapça ve Irkçı/Ağır Hakaret Listesi (Lexo kelimesi hariç tutuldu)
const blacklist = [
    'sikeyim', 'sikim', 'skem', 'sikem', 's1key1m', 's3k1m', 'sıkm',
    'oç', 'orospu', 'orospu evladı', 'orosph çocuğu', 'oc', '0ç',
    'ibne', 'ibine', '1bne', 'piç', 'p1ç', 'pezevenk', 'pzvnk', 
    'yarrak', 'yrrm', 'yrm', 'yrk', 'yarak', 'yark', 'y4rr4k',
    'or', 'oe', 'oçoe', 'porno', 'seks', 's3ks', 'parçalarım',
    'aminakoydugum', 'amonakoydugum', 'amcikinaqoyim', 'aminakoyim',
    'anani', 'anasi', 'ananin', '4n4n1', '4n4sı',
    'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'mf',
    'fack', 'fak', 'fuk', 'faak', 'fuuck', 'fck',
    'shit', 'shitty', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 
    'pussy', 'cock', 'whore', 'slut', 'idiot', 'retard',
    'nigger', 'nigga', 'n1gg3r', 'n1gga', 'neger', 'negro', 'niggah',
    'sharmuta', 'sharmouta', 'kesh ummak', 'awad', 'kalb', 'hayawan',
    'kos omak', 'kus omak', 'putain', 'merde', 'scheiße', 'arschloch'
];

const spamKontrol = new Map();
const emojiSpamKontrol = new Map();
const uyariTakip = new Map();

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
                .setCustomId('kabul_et')
                .setLabel('✅ Kabul Ediyorum')
                .setStyle(ButtonStyle.Success)
        );

        await kurallarKanal.send({ content: `${member}`, embeds: [embed], components: [row] });
    } catch (err) {
        console.error('guildMemberAdd hatası:', err);
    }
});

// --- BUTON ETKİLEŞİMİ ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'kabul_et') {
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

    // --- "sa" KONTROLÜ ---
    if (message.content.toLowerCase() === 'sa') {
        await message.channel.send('as hoşgeldin bra');
    }

    const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const rolVarmi = message.member.roles.cache.size > 1;

    // --- ROLÜ OLMAYANLAR İÇİN GENEL MESAJ ENGELİ ---
    if (!adminMi && !rolVarmi) {
        const komutMu = message.content.startsWith('.rolbilgi') || message.content.startsWith('!kurallar') || message.content.startsWith('.şikayet') || message.content.startsWith('.sikayet');
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
                    await message.channel.send(`⚠️ ${message.author}, Flood ve spam yasaktır bir dahaki seferde mute yersiniz.`);
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

    // --- KÜFÜR FİLTRESİ (Loga atma ve uyarma eklendi) ---
    const komutMu = message.content.startsWith('.sesegir') || message.content.startsWith('.mute') || 
                    message.content.startsWith('.unmute') || message.content.startsWith('.nuke') || 
                    message.content.startsWith('.rolbilgi') || message.content.startsWith('!kurallar') ||
                    message.content.startsWith('.şikayet') || message.content.startsWith('.sikayet') ||
                    message.content.startsWith('.ship');

    if (!komutMu) {
        let hamMesaj = message.content.toLowerCase()
            .replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o')
            .replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/9/g, 'g')
            .replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i');

        let temizMesaj = hamMesaj
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .replace(/\s+/g, "")
            .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/i̇/g, 'i')
            .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');

        let isProfane = blacklist.some(yasakli => {
            let duzYasakli = yasakli.toLowerCase()
                .replace(/\s+/g, "")
                .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
                .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
            return temizMesaj.includes(duzYasakli);
        });

        if (isProfane) {
            try {
                await message.delete();
                await message.channel.send(`⚠️ ${message.author}, küfür etmek yasaktır!`);
                const logChannel = message.guild.channels.cache.find(c => c.name === 'log');
                if (logChannel) {
                    await logChannel.send(`🚨 **Küfür Yakalandı!**\n👤 **Üye:** ${message.author} (${message.author.tag})\n💬 **Mesaj:** \`${message.content}\``);
                }
            } catch (err) {
                console.error('Küfür log hatası:', err);
            }
            return; 
        }
    }

    // --- KOMUTLAR ---
    if (message.content.startsWith('.rolbilgi')) {
        try {
            await message.delete().catch(() => {});
            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setDescription(`🎖️ **AKTİF ÜYE ÖDÜLLERİ**\n\n1.000 mesaja **nuke✅**, 2.000 mesaja **chatyt✅** rolü verilir.`);
            await message.channel.send({ embeds: [embed] });
        } catch (err) { console.error(err); }
        return;
    }

    if (message.content.startsWith('!kurallar')) {
        try {
            await message.delete().catch(() => {});
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('kabul_et').setLabel('✅ Kabul Ediyorum').setStyle(ButtonStyle.Success)
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

    // --- .ship KOMUTU ---
    if (message.content.startsWith('.ship')) {
        try {
            const targetUser = message.mentions.users.first();
            if (!targetUser) return message.reply('❌ Lütfen shiplemek için bir kullanıcı etiketle! Örnek: `.ship @kullanici`');

            const yuzde = Math.floor(Math.random() * 101); // 0 ile 100 arası rastgele yüzde
            const user1 = message.author;
            const user2 = targetUser;

            const shipEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('💖 Aşk Testi (.ship) 💕')
                .setDescription(`💘 **${user1.username}** ❤️ **${user2.username}**\n\n✨ **Uyum Yüzdesi:** \`%${yuzde}\` ✨`)
                .setThumbnail(user1.displayAvatarURL({ dynamic: true }))
                .setImage(user2.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Lexo 1 Aşk Ölçer Sistemi 💘' });

            await message.channel.send({ embeds: [shipEmbed] });
        } catch (err) {
            console.error('Ship komut hatası:', err);
        }
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
