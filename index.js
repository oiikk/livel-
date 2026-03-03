const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ===== الإعدادات =====
const PREFIX = "!";

const LEVEL_CHANNEL_ID = "PUT_LEVEL_CHANNEL_ID_HERE";

const LEVEL_ROLES = {
  2: "Level 2",
  5: "Level 5",
  10: "Level 10",
  15: "Level 15",
  20: "Level 20",
  30: "Level 30",
};

// ===== ملف التخزين =====
const LEVEL_FILE = "./levels.json";
if (!fs.existsSync(LEVEL_FILE)) fs.writeFileSync(LEVEL_FILE, JSON.stringify({}));

function getLevels() {
  return JSON.parse(fs.readFileSync(LEVEL_FILE));
}

function saveLevels(data) {
  fs.writeFileSync(LEVEL_FILE, JSON.stringify(data, null, 2));
}

function xpNeeded(level) {
  return level * 100;
}

// ===== READY =====
client.once("clientReady", () => {
  console.log(`${client.user.tag} شغال 🔥`);
});

// ===== الرسائل =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const levels = getLevels();
  const userId = message.author.id;

  if (!levels[userId]) {
    levels[userId] = { xp: 0, level: 0 };
  }

  // ===== نظام XP =====
  const xpGain = Math.floor(Math.random() * 10) + 5;
  levels[userId].xp += xpGain;

  let nextLevel = levels[userId].level + 1;
  let needed = xpNeeded(nextLevel);

  if (levels[userId].xp >= needed) {
    const oldLevel = levels[userId].level;

    levels[userId].level = nextLevel;
    levels[userId].xp = 0;

    const levelChannel = message.guild.channels.cache.get(LEVEL_CHANNEL_ID);
    if (levelChannel) {
      levelChannel.send(
        `🌙 | ${message.author} You leveled up from level ${oldLevel} to ${nextLevel} 🌙 Keep shining!`
      ).catch(()=>{});
    }

    const roleName = LEVEL_ROLES[nextLevel];
    if (roleName) {
      const role = message.guild.roles.cache.find(r => r.name === roleName);
      if (role) {
        message.member.roles.add(role).catch(()=>{});
      }
    }
  }

  saveLevels(levels);

  // ===== الأوامر =====
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== !rank =====
  if (command === "rank") {
    const user = message.mentions.users.first() || message.author;
    const data = levels[user.id];

    if (!data) {
      return message.reply("ما عندك بيانات لفل لسه.");
    }

    const neededXP = xpNeeded(data.level + 1);

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle(`📊 Rank - ${user.username}`)
      .addFields(
        { name: "Level", value: `${data.level}`, inline: true },
        { name: "XP", value: `${data.xp} / ${neededXP}`, inline: true }
      )
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
