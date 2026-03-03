const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const { createCanvas, loadImage, registerFont } = require("canvas");

// ===== REGISTER ARABIC FONT =====
registerFont('./fonts/Cairo-VariableFont_slnt,wght.ttf', { family: 'Cairo' });

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ===== SETTINGS =====
const PREFIX = "!";
const LEVEL_CHANNEL_ID = "1463109215915741204"; // channel for level-up messages
const LEVEL_ROLES = {
  2: "1463097131966529679",
  5: "1463097276053327983",
  10: "1463097713980735579",
  15: "1463097816862949508",
  20: "1463097926581620777",
  30: "1463098038376730644",
};

// ===== MONGODB =====
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected 🔥"))
  .catch(err => console.log(err));

const levelSchema = new mongoose.Schema({
  userId: String,
  xp: Number,
  level: Number,
  lastMessage: Number,
});

const Level = mongoose.model("Level", levelSchema);

// ===== READY =====
client.once("clientReady", () => {
  console.log(`${client.user.tag} is online 🔥`);
});

// ===== XP NEEDED =====
function xpNeeded(level) {
  return level * 100;
}

// ===== XP COOLDOWN =====
const XP_COOLDOWN = 1  * 1000; // 60 seconds
const xpCooldowns = {};

// ===== MESSAGE CREATE =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== SPAM PROTECTION =====
  const userId = message.author.id;
  const now = Date.now();
  if (!xpCooldowns[userId]) xpCooldowns[userId] = 0;
  if (now - xpCooldowns[userId] < XP_COOLDOWN) return;
  xpCooldowns[userId] = now;

  // ===== FETCH OR CREATE USER DATA =====
  let data = await Level.findOne({ userId });
  if (!data) {
    data = await Level.create({ userId, xp: 0, level: 0, lastMessage: 0 });
  }

  // ===== GIVE XP =====
  const xpGain = Math.floor(Math.random() * 10) + 5;
  data.xp += xpGain;

  const nextLevel = data.level + 1;
  const needed = xpNeeded(nextLevel);

  // ===== LEVEL UP =====
  if (data.xp >= needed) {
    const oldLevel = data.level;
    data.level = nextLevel;
    data.xp = 0;

    // send message in level channel
    const levelChannel = message.guild.channels.cache.get(LEVEL_CHANNEL_ID);
    if (levelChannel) {
      levelChannel.send(
        `${message.author} leveled up from level ${oldLevel} to ${nextLevel}🌙 Keep shining!`
      ).catch(() => {});
    }

    // give role if exists
    const roleId = LEVEL_ROLES[nextLevel];
    if (roleId) {
      const role = message.guild.roles.cache.get(roleId);
      if (role) {
        message.member.roles.add(role).catch(() => {});
      }
    }
  }

  await data.save();

  // ===== COMMANDS =====
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== !rank =====
  if (command === "rank") {
    const user = message.mentions.users.first() || message.author;
    const userData = await Level.findOne({ userId: user.id });
    if (!userData) return message.reply("No level data found.");

    const neededXP = xpNeeded(userData.level + 1);
    const progress = userData.xp / neededXP;

    // ===== CREATE RANK CARD =====
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#111214";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1c20";
    ctx.fillRect(20, 20, 760, 210);

    // avatar
    const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 45, 45, 160, 160);
    ctx.restore();

    // username
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Cairo";
    ctx.fillText(user.username, 240, 90);

    // level
    ctx.font = "26px Cairo";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`Level: ${userData.level}`, 240, 130);

    // XP
    ctx.fillText(`XP: ${userData.xp} / ${neededXP}`, 240, 160);

    // progress bar background
    ctx.fillStyle = "#2a2d31";
    ctx.fillRect(240, 180, 500, 25);

    // progress bar fill
    ctx.fillStyle = "#9b59b6";
    ctx.fillRect(240, 180, 500 * progress, 25);

    const buffer = canvas.toBuffer();
    await message.reply({
      files: [{ attachment: buffer, name: "rank.png" }]
    });
  }
});

client.login(process.env.TOKEN);
