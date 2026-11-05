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

// Genişletilmiş Küresel, Türkçe, İngilizce, Arapça ve Irkçı/Ağır Hakaret Listesi
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
const uyariTakip = new Map();

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

// --- SES KANALI GİRİŞ KONTROLÜ (Rolü olmayan sese giremez) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    // Sese yeni bağlandıysa (veya kanal değiştirdiyse)
    if (newState.channelId && (!oldState.channelId || oldState.channelId !== newState.channelId)) {
        const member = newState.member;
        if (member.user.bot) return;

        const adminMi = member.permissions.has(PermissionsBitField.Flags.Administrator);
        // Üzerinde @everyone dışında başka bir rol var mı? (Örn: hayatsız, çorum vb.)
        const rolVarmi = member.roles.cache.size > 1;

        if (!adminMi && !rolVarmi) {
            try {
                // Sesten at (bağlantısını kes)
                await member.voice.disconnect('Kurallar onaylanmadığı için ses yasak.');
                
                // Mesaj yazabilen genel bir kanala veya olayın olduğu yere uyarı atabiliriz
                const genelKanal = newState.guild.channels.cache.find(c => c.name.toLowerCase() === 'chat' || c.name.toLowerCase() === 'sohbet' || c.name.toLowerCase() === 'genel');
                if (genelKanal) {
                    await genelKanal.send(`⚠️ ${member}, kurallar’ı onaylamadığınız için sunucuda herhangi bir eylem yapmanız yasaktır.`);
                }
            } catch (err) {
                console.error('Ses kısıtlama hatası:', err);
            }
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const adminMi = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    // Üzerinde @everyone dışında başka bir rol var mı kontrolü
    const rolVarmi = message.member.roles.cache.size > 1;

    // --- 0. ROLÜ OLMAYANLAR İÇİN GENEL MESAJ ENGELİ ---
    // Eğer admin değilse ve hiç rolü yoksa (sadece @everyone varsa) attığı her mesaj silinir.
    if (!adminMi && !rolVarmi) {
        // Komutlar (.rolbilgi, !kurallar vb.) veya kural butonu etkileşimi haricindeyse sil
        const komutMu = message.content.startsWith('.rolbilgi') || message.content.startsWith('!kurallar');
        if (!komutMu) {
            try {
                await message.delete();
                await message.channel.send(`⚠️ ${message.author}, kurallar’ı onaylamadığınız için sunucuda herhangi bir eylem yapmanız yasaktır.`);
            } catch (err) {
                console.error('Rolü olmayan mesajı silme hatası:', err);
            }
            return;
        }
    }

    // --- 1. LİNK / REKLAM / PHISHING KORUMASI ---
    const linkKumesi = /(https?:\/\/|discord\.gg|discord\.com\/invite)/i;
    if (linkKumesi.test(message.content)) {
        const yetkiliMi = adminMi || message.member.roles.cache.some(r => ['nuke✅', 'chatyt✅', 'çorum', 'hayatsız'].includes(r.name));
        
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

    const corumVarmi = message.member.roles.cache.some(r => r.name.toLowerCase() === 'çorum');

    // --- 2. EMOJİ / STİCKER SPAM KORUMASI ---
    const emojiSayisi = (message.content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || []).length;
    if (!adminMi && !corumVarmi && (emojiSayisi > 5 || message.stickers.size > 0)) {
        const userId = message.author.id;
        const simdi = Date.now();
        if (!emojiSp
