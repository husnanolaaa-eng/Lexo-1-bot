const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const http = require('http');

// Render port hatası vermesin diye mini web sunucusu (Uyanık kalması için)
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

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // .sa komutu
    if (message.content.toLowerCase() === 'sa') {
        message.reply('as hoşgeldin BRA');
    }

    // !ping komutu
    if (message.content === '!ping') {
        message.reply('Pong!');
    }

    // !kurallar komutu ve Buton Oluşturma
    if (message.content === '!kurallar') {
        const kurallarMetni = `📜 **SUNUCU KURALLARI VE TOPLULUK AÇIKLAMASI**

Sunucumuz, arkadaşlık, dostluk ve güzel vakit geçirmek amacıyla oluşturulmuş bir topluluk sunucusudur. Sunucumuz içerisinde sohbet, muhabbet, eğlence, oyun ve çeşitli etkinlikler bulunmaktadır. Temel amacımız, tüm üyelerimizin kendilerini rahat hissedebileceği, yeni arkadaşlıklar kurabileceği ve herhangi bir rahatsızlık yaşamadan keyifli vakit geçirebileceği bir ortam oluşturmaktır.

Bu ortamın korunması ve sunucu düzeninin sağlanması için bütün üyelerimizin aşağıdaki kurallara uyması zorunludur.

1. **Saygı ve hoşgörü:** Sunucumuzda bulunan herkes birbirine karşı saygılı davranmalıdır. Hiçbir üye başka bir üyeyi küçük düşüremez, aşağılayamaz, hedef gösteremez veya bilerek rahatsız edemez.
2. **Küfür ve hakaret:** Sunucumuzda küfür, hakaret ve diğer üyeleri rahatsız edebilecek ifadeler kesinlikle yasaktır.
3. **Şantaj, tehdit ve RAT:** Her türlü şantaj, tehdit, korkutma, kişisel bilgileri izinsiz paylaşma ve RAT gibi zararlı yazılımlar kesinlikle yasaktır. Cezası doğrudan kalıcı sunucu yasağıdır.
4. **Üyeleri rahatsız etmek:** Bir üyeyi sürekli mesaj göndererek rahatsız etmek yasaktır.
5. **Kural ihlalleri ve cezalar:** İhlalin ciddiyetine göre uyarı veya uzaklaştırma uygulanabilir.

**SON OLARAK:** Bu sunucuya katılan herkes belirtilen kuralları kabul etmiş sayılır.

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
});

// Butona basıldığında otomatik "hayatsız" rolü verme
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'kabul_et') {
        const roleName = 'hayatsız';
        const role = interaction.guild.roles.cache.find(r => r.name === roleName);

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
