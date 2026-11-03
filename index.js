const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// Express sunucusu (Koyeb 7/24 açık kalması için bunu ister)
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Lexo-1 botu aktif ve 7/24 çalışıyor!');
});

app.listen(port, () => {
  console.log(`Web sunucusu ${port} portunda çalışıyor.`);
});

// Discord Bot Ayarları
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.once('ready', () => {
  console.log(`Bot giriş yaptı: ${client.user.tag}`);
});

// Token'ını buraya yapıştıracaksın
client.login('KDDODKOSSJSOSJJ_73738282628263828');
