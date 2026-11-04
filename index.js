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

// Genişletilmiş ve tam eşleşme kontrollü küfür listesi
const blacklist = [
    'sikeyim', 'sikim', 'skem', 'sikem', 
    'oç', 'orospu', 'orospu evladı', 'orosph çocuğu', 
    'ibne', 'ibine', 'piç', 'pezevenk', 'pzvnk', 
    'yarrak', 'yrrm', 'yrm', 'yrk', 'yarak', 'yark', 
    'or', 'oe', 'oçoe', 'porno', 'seks', 'sik', 'parçalarım'
];

const spamKontrol = new Map();

client.once('ready', () => {
    console.log(`[+] Bot aktif! Giriş yapılan hesap: ${client.user.tag}`);
    client.user.setActivity('Lexo Güvenlik Sistemleri');
});

// --- YENİ ÜYE KATILIMI (Kurallar Butonlu Mesajı Gönderme) ---
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

// --- BUTON ETKİLEŞİMİ (Butona basınca "hayatsız" rolünü verme) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'kabul_et') {
        try {
            await interaction.deferUpdate();
            
            // Kullanıcıya direkt "hayatsız" rolünü atıyoruz
            const hayatsizRolu = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'hayatsız'); 
            if (hayatsizRolu) {
                await interaction.member.roles.add(hayatsizRolu);
            }
            
            await interaction.followUp({ content: '✅ Kuralları kabul ettin, "hayatsız" rolü verildi ve sunucu kilidi açıldı!', ephemeral: true });
        } catch (err) {
            console.error('Kabul et buton hatası:', err);
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- SPAM / FLOOD KORUMASI (4 defa arka arkaya ise 3 dakika mute) ---
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

    // --- KÜFÜR FİLTRESİ VE LOGLAMA (Tam Kelime Eşleşmesi) ---
    const contentLower = message.content.toLowerCase();
    const kelimeler = contentLower.split(/\s+/); 
    const isProfane = blacklist.some(yasakli => kelimeler.includes(yasakli));

    if (isProfane) {
        try {
            await message.delete();
            const logChannel = message.guild.channels.cache.find(c => c.name === 'log');
            if (logChannel) {
                await logChannel.send(`⚠️ **Yasaklı Kelime Yakalandı!**\n👤 **Üye:** ${message.author} (${message.author.tag})\n📁 **Kanal:** ${message.channel}\n💬 **Mesaj:** \`${message.content}\``);
            } else {
                await message.channel.send(`${message.author}, küfür etmek yasak!`);
            }
        } catch (err) {
            console.error('Küfür filtreleme hatası:', err);
        }
        return; 
    }

    // --- 📜 !KURALLAR KOMUTU ---
    if (message.content.startsWith('!kurallar')) {
        try {
            await message.delete().catch(() => {});
            
            const kurallarMetni = `📜 **SUNUCU KURALLARI**

**1. Saygı ve hoşgörü**
Sunucumuzda bulunan her üyenin birbirine karşı saygılı ve anlayışlı davranması beklenmektedir. Hiçbir üye, başka bir üyeyi küçük düşüremez, aşağılayamaz, hedef gösteremez veya rahatsız edici davranışlarda bulunamaz. Herkesin düşüncelerine ve kişisel sınırlarına saygı gösterilmelidir.

**2. Küfür ve hakaret**
Sunucumuzda küfür, hakaret, ağır argo ve aşağılayıcı söylemler yasaktır. Şaka amacıyla dahi olsa başka bir üyeyi rahatsız edecek, küçük düşürecek veya huzurunu bozacak ifadeler kullanılmamalıdır. Arkadaş ortamında bulunmamız, saygı sınırlarının aşılabileceği anlamına gelmez.

**3. Şantaj, tehdit ve RAT**
Şantaj, tehdit, korkutma, kişisel bilgileri izinsiz paylaşma ve RAT (uzaktan erişim yoluyla bir kişinin cihazını kontrol etmeye yönelik zararlı yazılımlar) gibi davranışlar kesinlikle yasaktır. Bu tür davranışların hiçbir şekilde bahanesi veya istisnası kabul edilmeyecektir.

**4. Üyeleri rahatsız etmek ve taciz**
Herhangi bir üyeyi sürekli mesaj atarak rahatsız etmek, özel mesaj yoluyla baskı kurmak, huzurunu bozmak veya istemediği hâlde iletişim kurmaya zorlamak yasaktır. Bir üye rahatsız olduğunu belirttiğinde bu uyarıya saygı gösterilmesi zorunludur.

**5. Kural ihlalleri ve uygulanacak cezalar**
Yukarıdaki kuralları ihlal eden üyeler hakkında gerekli işlemler uygulanacaktır. Şantaj, RAT, tehdit ve ciddi ihlallerde doğrudan kalıcı yasaklama (permanent ban) uygulanabilir.

**6. Genel sunucu düzeni**
Sunucumuzun amacı insanları birbirine düşürmek değil, keyifli sohbetler gerçekleştirmektir. Bu sunucuya katılan herkes kuralları kabul etmiş sayılır.

Herkese iyi eğlenceler, keyifli vakit geçirmeniz dileğiyle! ❤`;

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

    // --- 🔨 .mute KOMUTU (Sadece "chatyt✅" veya "çorum" rolü olanlar) ---
    if (message.content.startsWith('.mute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        
        const yetkisiVarmi = (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || 
                             (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetkisiVarmi) {
            return message.reply('❌ Bu komutu kullanmak için **chatyt✅** rolüne sahip olmalısın!');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('❌ Mutelemek için bir kullanıcı ismi girin! Örnek: `.mute @kullanici`');
        }

        try {
            await targetUser.timeout(3 * 60 * 1000, 'Yetkili tarafından mutelendi.');
            await message.channel.send(`✅ ${targetUser.user.username} başarılı şekilde susturuldu. 3 dakika.`);
        } catch (err) {
            console.error('Mute hatası:', err);
            message.reply('❌ Bu kullanıcıyı mutelemek için yetkim yetmiyor.');
        }
        return;
    }

    // --- 🔊 .unmute KOMUTU (Sadece "chatyt✅" veya "çorum" rolü olanlar) ---
    if (message.content.startsWith('.unmute')) {
        const chatytRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'chatyt✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        
        const yetkisiVarmi = (chatytRolu && message.member.roles.cache.has(chatytRolu.id)) || 
                             (corumRolu && message.member.roles.cache.has(corumRolu.id));

        if (!yetkisiVarmi) {
            return message.reply('❌ Bu komutu kullanmak için **chatyt✅** rolüne sahip olmalısın!');
        }

        const targetUser = message.mentions.members.first();
        if (!targetUser) {
            return message.reply('❌ Susturması kaldırılacak bir kullanıcı ismi girin! Örnek: `.unmute @kullanici`');
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

    // --- 💣 NUKE SİSTEMİ (.nuke) - Sadece "nuke✅" rolü olanlar ---
    if (message.content.startsWith('.nuke')) {
        const nukeRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'nuke✅');
        const corumRolu = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'çorum');
        
        const yetkisiVarmi = (nukeRolu && message.member.roles.cache.has(nukeRolu.id)) || 
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
    res.end('Lexo Bot Aktif!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[+] Keep-alive ${PORT} portunda dinlemede.`);
});

client.login(process.env.DISCORD_TOKEN);
