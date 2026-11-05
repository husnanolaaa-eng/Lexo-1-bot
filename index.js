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

// Genişletilmiş Küresel, Türkçe, İngilizce, Arapça ve Irkçı/Ağır Hakaret Listesi (Yanlış alarmlar temizlendi)
const blacklist = [
    // Türkçe & Bypass Varyasyonları
    'sikeyim', 'sikim', 'skem', 'sikem', 's1key1m', 's3k1m', 'sıkm',
    'oç', 'orospu', 'orospu evladı', 'orosph çocuğu', 'oc', '0ç',
    'ibne', 'ibine', '1bne', 'piç', 'p1ç', 'pezevenk', 'pzvnk', 
    'yarrak', 'yrrm', 'yrm', 'yrk', 'yarak', 'yark', 'y4rr4k',
    'or', 'oe', 'oçoe', 'porno', 'seks', 's3ks', 'sik', 'parçalarım',
    'aminakoydugum', 'amonakoydugum', 'amcikinaqoyim', 'aminakoyim',
    'anani', 'anasi', 'ananin', '4n4n1', '4n4sı',

    // İngilizce Küfürler & Fack/Fak/Fuk Varyasyonları
    'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'mf',
    'fack', 'fak', 'fuk', 'faak', 'fuuck', 'fck',
    'shit', 'shitty', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 
    'pussy', 'cock', 'whore', 'slut', 'idiot', 'retard',

    // Irkçı ve Hassas Küfürler (N-word ve varyasyonları)
    'nigger', 'nigga', 'n1gg3r', 'n1gga', 'neger', 'negro', 'niggah',

    // Arapça & Diğer Dillerdeki Yaygın Küfür / Hakaretler
    'sharmuta', 'sharmouta', 'kesh ummak', 'awad', 'kalb', 'hayawan',
    'kos omak', 'kus omak', 'putain', 'merde', 'scheiße', 'arschloch'
];

const spamKontrol = new Map();
const emojiSpamKontrol = new Map();

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Güvenlik Sistemleri - Uluslararası Koruma');
});

// --- YENİ ÜYE KATILIMI & FAKE HESAP KORUMASI ---
client.on('guildMemberAdd', async member => {
    try {
        const hesapYasiMS = Date.now() - member.user.createdTimestamp;
        const ucGunMS = 3 * 24 * 60 * 60 * 1000;

        if (hesapYasiMS < ucGunMS) {
            const logChannel = member.guild.channels.cache.find(c => c.name === 'log');
            if (logChannel) {
                await logChannel.send(`⚠️ **Şüpheli (Yeni) Hesap Yakalandı!**\n👤 **Üye:** ${member} (${member.user.tag})\n📅 **Hesap Kuruluş:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`);
            }
        }

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

// --- BUTON ETKİLEŞİMİ ("hayatsız" rolü verme & chat kanalına karşılama) ---
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

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- 1. LİNK / REKLAM / PHISHING KORUMASI ---
    const linkKumesi = /(https?:\/\/|discord\.gg|discord\.com\/invite)/i;
    if (linkKumesi.test(message.content)) {
        const yetkiliMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                         message.member.roles.cache.some(r => ['nuke✅', 'chatyt✅', 'çorum'].includes(r.name));
        
        if (!yetkiliMi) {
            try {
                await message.delete();
                await message.channel.send(`❌ ${message.author}, bu sunucuda link ve davet paylaşımı yasaktır!`);
                const logChannel = message.guild.channels.cache.find(c => c.name === 'log');
                if (logChannel) {
                    await logChannel.send(`⚠️ **Engellenen Link:** ${message.author} tarafından atıldı.\n💬 **Mesaj:** \`${message.content}\``);
                }
            } catch (err) {
                console.error('Link silme hatası:', err);
            }
            return;
        }
    }

    // --- 2. EMOJİ / STİCKER SPAM KORUMASI ---
    const emojiSayisi = (message.content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || []).length;
    if (emojiSayisi > 5 || message.stickers.size > 0) {
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
                await message.member.timeout(2 * 60 * 1000, 'Aşırı emoji/sticker spamı');
                await message.channel.send(`⚠️ ${message.author}, ard arda emoji/sticker spamı yaptığı için 2 dakika susturuldu!`);
                emojiSpamKontrol.set(userId, []);
            } catch (err) {
                console.error('Emoji spam mute hatası:', err);
            }
            return;
        }
    }

    // --- 3. SPAM / FLOOD KORUMASI ---
    const userId = message.author.id;
    const simdi = Date.now();
    
    if (!spamKontrol.has(userId)) spamKontrol.set(userId, []);
    let kullaniciMesajlari = spamKontrol.get(userId);
    kullaniciMesajlari.push(simdi);
    
    kullaniciMesajlari = kullaniciMesajlari.filter(zaman => simdi - zaman < 5000);
    spamKontrol.set(userId, kullaniciMesajlari);

    if (kullaniciMesajlari.length >= 4) {
        try {
            await message.member.timeout(3 * 60 * 1000, 'Arka arkaya spam/flood yapmak');
            await message.channel.send(`⚠️ ${message.author}, arka arkaya spam/flood yaptığı için 3 dakika süreyle susturuldu!`);
            spamKontrol.set(userId, []);
        } catch (err) {
            console.error('Otomatik mute hatası:', err);
        }
        return;
    }

    // --- 4. ULUSLARARASI KÜRESEL & 1337 BYPASS KORUMALI KÜFÜR VE IRÇILIK FİLTRESİ ---
    const komutMu = message.content.startsWith('.sesegir') || message.content.startsWith('.mute') || 
                    message.content.startsWith('.unmute') || message.content.startsWith('.nuke') || 
                    message.content.startsWith('.rolbilgi') || message.content.startsWith('!kurallar');

    if (!komutMu) {
        let hamMesaj = message.content.toLowerCase();
        
        hamMesaj = hamMesaj
            .replace(/4/g, 'a')
            .replace(/3/g, 'e')
            .replace(/1/g, 'i')
            .replace(/0/g, 'o')
            .replace(/5/g, 's')
            .replace(/7/g, 't')
            .replace(/8/g, 'b')
            .replace(/9/g, 'g')
            .replace(/@/g, 'a')
            .replace(/\$/g, 's')
            .replace(/!/g, 'i');

        let temizMesaj = hamMesaj
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .replace(/\s+/g, "")
            .replace(/ç/g, 'c')
            .replace(/ğ/g, 'g')
            .replace(/ı/g, 'i')
            .replace(/i̇/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ş/g, 's')
            .replace(/ü/g, 'u');

        let isProfane = blacklist.some(yasakli => {
            let duzYasakli = yasakli.toLowerCase()
                .replace(/\s+/g, "")
                .replace(/ç/g, 'c')
                .replace(/ğ/g, 'g')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ş/g, 's')
                .replace(/ü/g, 'u');
            return temizMesaj.includes(duzYasakli);
        });

        if (isProfane) {
            try {
                await message.delete();
                const logChannel = message.guild.channels.cache.find(c => c.name === 'log');
                if (logChannel) {
                    await logChannel.send(`🚨 **Uluslararası / Irkçı Küfür Yakalandı!**\n👤 **Üye:** ${message.author} (${message.author.tag})\n📁 **Kanal:** ${message.channel}\n💬 **Orijinal Mesaj:** \`${message.content}\``);
                } else {
                    await message.channel.send(`${message.author}, bu tarz küfür veya ırkçı söylemler yasaktır!`);
                }
            } catch (err) {
                console.error('Küfür filtreleme hatası:', err);
            }
            return; 
        }
    }

    // --- 📜 .rolbilgi KOMUTU ---
    if (message.content.startsWith('.rolbilgi')) {
        try {
            await message.delete().catch(() => {});

            const rolBilgiMetni = `🎖️ **AKTİF ÜYE ÖDÜLLERİ**

Sunucumuzda 1.000 mesaj gönderen üyelere **nuke✅**, 2.000 mesaj gönderen üyelere ise **chatyt✅** rolü verilecektir. (Şimdilik.)

🔇 **chatyt✅**
Bu role sahip üyeler, diğer üyeleri etiketleyerek susturma yetkisine sahiptir.
* Susturmak için: \`.mute (kullanıcı)\`
* Susturmayı kaldırmak için: \`.unmute (kullanıcı)\`
Susturma işlemi en az 3 dakika sürmelidir. Kişisel nedenlerle veya keyfî olarak susturma işlemi yapmak yasaktır. Yetkiler, sunucu kuralları doğrultusunda kullanılmalıdır. Aksi takdirde yetkiniz geri alınacaktır.

💥 **nuke✅**
Bu role sahip üyeler, yetkili oldukları kanallardaki mesajları silebilir.
Bunun için mesajları silmek istediğiniz kanala girmeniz ve sohbet kısmına \`.nuke\` yazmanız yeterlidir.
Ancak kanala art arda Nuke işlemi uygulayarak sohbet düzenini bozmak yasaktır. Bu yetkinin gereksiz kullanımında rolünüz geri alınacaktır. Nuke işlemini yalnızca gerekli durumlarda ve yönetim kurallarına uygun şekilde kullanmanız beklenmektedir.

*Unutmayın: Bu roller bir ayrıcalıktır. Yetkilerin kötüye kullanılması durumunda geri alınabilir.*`;

            const embed = new EmbedBuilder()
                .setColor('#00ffcc')
                .setDescription(rolBilgiMetni);

            await message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Rolbilgi komut hatası:', err);
        }
        return;
    }

    // --- 📜 !KURALLAR KOMUTU ---
    if (message.content.startsWith('!kurallar')) {
        try {
            await message.delete().catch(() => {});
            
            const kurallarMetni = `📜 **SUNUCU KURALLARI**

**1. Saygı ve hoşgörü**
Sunucumuzda bulunan her üyenin birbirine karşı saygılı ve anlayışlı davranması beklenmektedir. Hiçbir üye, başka bir üyeyi küçük düşüremez, aşağılayamaz, hedef gösteremez veya rahatsız edici davranışlarda bulunamaz.

**2. Küfür ve hakaret**
Sunucumuzda küfür, hakaret, ağır argo ve aşağılayıcı söylemler yasaktır. Şaka amacıyla dahi olsa başka bir üyeyi rahatsız edecek ifadeler kullanılmamalıdır.

**3. Şantaj, tehdit ve RAT**
Şantaj, tehdit, korkutma, kişisel bilgileri izinsiz paylaşma ve RAT (uzaktan erişim zararlı yazılımlar) kesinlikle yasaktır. İstisnası yoktur.

**4. Reklam ve Link Paylaşımı**
Sunucuda izinsiz her türlü link, davet kodu ve reklam paylaşımı yasaktır, otomatik silinir.

**5. Genel sunucu düzeni**
Bu sunucuya katılan herkes kuralları peşinen kabul etmiş sayılır. Keyifli vakitler! ❤`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('kabul_et')
                    .setLabel('✅ Kabul Ediyorum')
                    .setStyle(ButtonStyle.Success)
            );

            await message.channel.send({ content: kurallarMetni, components: [row] });
        } catch (err) {
            console.error('Kurallar komut hatası:', err);
        }
        return;
    }

    // --- SES KANALINA GİRİŞ KOMUTU (.sesegir) ---
    if (message.content.startsWith('.sesegir')) {
        try {
            const kanalAdi = message.content.slice('.sesegir'.length).trim();
            if (!kanalAdi) return message.reply('❌ Lütfen ses kanalının adını yaz! Örnek: `.sesegir SES KASIYORUZ`');

            const hedefKanal = message.guild.channels.cache.find(c => 
                c.name.toLowerCase() === kanalAdi.toLowerCase() && 
                c.type === ChannelType.GuildVoice
            );

            if (!hedefKanal) return message.reply(`❌ "${kanalAdi}" adında ses kanalı bulunamadı!`);

            joinVoiceChannel({
                channelId: hedefKanal.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfMute: false,
                selfDeaf: false
            });

            await message.channel.send('Başarılı şekilde sese girildi.');
        } catch (err) {
            console.error('Ses bağlantı hatası:', err);
        }
        return;
    }

    // --- 🔨 .mute KOMUTU ---
    if (message.content.startsWith('.mute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        
        const yetkisiVarmi = message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                             (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || 
                             (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetkisiVarmi) {
            return message.reply('❌ Bu komutu kullanmak için **chatyt✅** rolüne sahip olmalısın!');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('❌ Mutelemek için bir kullanıcı etiketle! Örnek: `.mute @kullanici`');
        }

        try {
            await targetUser.timeout(3 * 60 * 1000, 'Yetkili tarafından mutelendi.');
            await message.channel.send(`✅ ${targetUser.user.username} başarılı şekilde susturuldu (3 dakika).`);
        } catch (err) {
            console.error('Mute hatası:', err);
            message.reply('❌ Bu kullanıcıyı mutelemek için yetkim yetmiyor.');
        }
        return;
    }

    // --- 🔊 .unmute KOMUTU ---
    if (message.content.startsWith('.unmute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        
        const yetkisiVarmi = message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                             (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || 
                             (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetkisiVarmi) {
            return message.reply('❌ Bu komutu kullanmak için **chatyt✅** rolüne sahip olmalısın!');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('❌ Susturması kaldırılacak bir kullanıcı etiketle! Örnek: `.unmute @kullanici`');
        }

        try {
            await targetUser.timeout(null, 'Unmute komutu ile açıldı.');
            await message.channel.send(`✅ ${targetUser.user.username} adlı kullanıcının susturması kaldırıldı!`);
        } catch (err) {
            console.error('Unmute hatası:', err);
            message.reply('❌ Susturmayı kaldıramadım.');
        }
        return;
    }

    // --- 💣 NUKE SİSTEMİ (.nuke) ---
    if (message.content.startsWith('.nuke')) {
        const nukeRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'nuke✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        
        const yetkisiVarmi = message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                             (nukeRolu && message.member.roles.cache.has(nukeRolu.id)) || 
                             (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetkisiVarmi) {
            return message.reply('❌ Bu komutu kullanmak için **nuke✅** rolüne sahip olmalısın!');
        }

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
    res.end('Lexo Bot Global Guvenlik Aktif!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[+] Keep-alive ${PORT} portunda dinlemede.`);
});

client.login(process.env.DISCORD_TOKEN);
