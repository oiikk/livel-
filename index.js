const {
  Client,
  GatewayIntentBits,
} = require("discord.js");

const mongoose = require("mongoose");
const { createCanvas, loadImage } = require("canvas");

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
const LEVEL_CHANNEL_ID = "1463109215915741204";

const LEVEL_ROLES = {
  2: "1463097131966529679",
  5: "1463097276053327983",
  10: "1463097713980735579",
  15: "1463097816862949508",
  20: "1463097926581620777",
  30: "1463098038376730644",
};

// ===== اتصال MongoDB =====
mongoose.connect(process.env.MONGO_URI)
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
  console.log(`${client.user.tag} شغال 🔥`);
});

// ===== XP المطلوب =====
function xpNeeded(level) {
  return level * 100;
}

// ===== الرسائل =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let data = await Level.findOne({ userId: message.author.id });

  if (!data) {
    data = await Level.create({
      userId: message.author.id,
      xp: 0,
      level: 0,
      lastMessage: 0,
    });
  }

  // ===== كولداون 60 ثانية =====
  const now = Date.now();
  if (now - data.lastMessage < 60000) return;

  data.lastMessage = now;

  // ===== XP =====
  const xpGain = Math.floor(Math.random() * 10) + 5;
  data.xp += xpGain;

  const nextLevel = data.level + 1;
  const needed = xpNeeded(nextLevel);

  if (data.xp >= needed) {
    const oldLevel = data.level;

    data.level = nextLevel;
    data.xp = 0;

    // رسالة في روم اللفلز فقط
    const levelChannel = message.guild.channels.cache.get(LEVEL_CHANNEL_ID);
    if (levelChannel) {
      levelChannel.send(
        `🌙 | ${message.author} You leveled up from level ${oldLevel} to ${nextLevel} 🌙 Keep shining!`
      ).catch(() => {});
    }

    // إعطاء الرول
    const roleId = LEVEL_ROLES[nextLevel];
    if (roleId) {
      const role = message.guild.roles.cache.get(roleId);
      if (role) {
        message.member.roles.add(role).catch(() => {});
      }
    }
  }

  await data.save();

  // ===== الأوامر =====
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== !rank =====
  if (command === "rank") {
    const user = message.mentions.users.first() || message.author;

    const userData = await Level.findOne({ userId: user.id });

    if (!userData) {
      return message.reply("ما عندك بيانات لفل لسه.");
    }

    const neededXP = xpNeeded(userData.level + 1);
    const progress = userData.xp / neededXP;

    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    // خلفية
    ctx.fillStyle = "#111214";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1a1c20";
    ctx.fillRect(20, 20, 760, 210);

    // صورة العضو
    const avatar = await loadImage(
      user.displayAvatarURL({ extension: "png", size: 256 })
    );

    ctx.save();
    ctx.beginPath();
    ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 45, 45, 160, 160);
    ctx.restore();

    // الاسم
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(user.username, 240, 90);

    // اللفل
    ctx.font = "26px sans-serif";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`Level: ${userData.level}`, 240, 130);

    // XP
    ctx.fillText(`XP: ${userData.xp} / ${neededXP}`, 240, 160);

    // بار الخلفية
    ctx.fillStyle = "#2a2d31";
    ctx.fillRect(240, 180, 500, 25);

    // بار التقدم
    ctx.fillStyle = "#9b59b6";
    ctx.fillRect(240, 180, 500 * progress, 25);

    const buffer = canvas.toBuffer();

    await message.reply({
      files: [{
        attachment: buffer,
        name: "rank.png"
      }]
    });
  }
});

client.login(process.env.TOKEN);
