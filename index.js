const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const { createCanvas, loadImage, registerFont } = require("canvas");

// ===== REGISTER ARABIC FONT =====
registerFont('./fonts/Cairo-VariableFont_slnt,wght.ttf', { family: 'Cairo' });

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
const LEVEL_CHANNEL_ID = "1463109215915741204";
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

// ===== LEVEL SCHEMA =====
const levelSchema = new mongoose.Schema({
  userId: String,
  xp: Number,
  level: Number,
  lastMessage: Number,
});

const Level = mongoose.model("Level", levelSchema);

// ===== READY =====
client.once("ready", () => {
  console.log(`${client.user.tag} is online 🔥`);
});

// ===== FUNCTIONS =====
function xpNeeded(level) {
  return level * 100;
}

const XP_COOLDOWN = 60 * 1000;
const xpCooldowns = {};

async function checkLevelUp(message, data, userId) {
  let leveledUp = false;
  while (data.xp >= xpNeeded(data.level + 1)) {
    data.xp -= xpNeeded(data.level + 1);
    const oldLevel = data.level;
    data.level += 1;
    leveledUp = true;

    // give role if exists
    const roleId = LEVEL_ROLES[data.level];
    if (roleId) {
      const role = message.guild.roles.cache.get(roleId);
      if (role) message.guild.members.cache.get(userId).roles.add(role).catch(()=>{});
    }

    // send message in level channel
    const levelChannel = message.guild.channels.cache.get(LEVEL_CHANNEL_ID);
    if (levelChannel) {
      levelChannel.send(`${message.guild.members.cache.get(userId)} You leveled up from level ${oldLevel} to ${data.level} 🌙`).catch(()=>{});
    }
  }
  await data.save();
  return leveledUp;
}

// ===== MESSAGE CREATE =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const now = Date.now();

  // ===== XP COOLDOWN =====
  if (!xpCooldowns[userId]) xpCooldowns[userId] = 0;
  if (now - xpCooldowns[userId] >= XP_COOLDOWN) {

    xpCooldowns[userId] = now;

    let data = await Level.findOne({ userId });
    if (!data) {
      data = await Level.create({ userId, xp: 0, level: 0, lastMessage: 0 });
    }

    const xpGain = Math.floor(Math.random() * 10) + 5;
    data.xp += xpGain;

    await checkLevelUp(message, data, userId);
  }

  // ===== COMMANDS =====
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ===== setxp =====
  if (command === "setxp") {
    if (!message.member.permissions.has("Administrator")) return message.reply("❌ ما عندك صلاحية");

    const member = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!member) return message.reply("❌ منشن العضو");
    if (isNaN(amount)) return message.reply("❌ حط رقم XP");

    let data = await Level.findOne({ userId: member.id });
    if (!data) data = await Level.create({ userId: member.id, xp: amount, level: 0, lastMessage: 0 });
    else data.xp = amount;

    const leveledUp = await checkLevelUp(message, data, member.id);

    let replyText = `✅ تم تعيين XP لـ ${member} إلى ${data.xp}`;
    if (leveledUp) replyText += `\n🎉 ${member} أصبح الآن مستوى ${data.level}!`;
    message.reply(replyText);
  }

  // ===== addxp =====
  if (command === "addxp") {
    if (!message.member.permissions.has("Administrator")) return message.reply("❌ ما عندك صلاحية");

    const member = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!member) return message.reply("❌ منشن العضو");
    if (isNaN(amount)) return message.reply("❌ حط رقم XP");

    let data = await Level.findOne({ userId: member.id });
    if (!data) data = await Level.create({ userId: member.id, xp: amount, level: 0, lastMessage: 0 });
    else data.xp += amount;

    const leveledUp = await checkLevelUp(message, data, member.id);

    let replyText = `✅ تم زيادة XP لـ ${member} بمقدار ${amount}, الآن XP: ${data.xp}`;
    if (leveledUp) replyText += `\n🎉 ${member} أصبح الآن مستوى ${data.level}!`;
    message.reply(replyText);
  }

  // ===== setlevel =====
  if (command === "setlevel") {
    if (!message.member.permissions.has("Administrator")) return message.reply("❌ ما عندك صلاحية");

    const member = message.mentions.users.first();
    const newLevel = parseInt(args[1]);

    if (!member) return message.reply("❌ منشن العضو");
    if (isNaN(newLevel)) return message.reply("❌ حط رقم المستوى");

    let data = await Level.findOne({ userId: member.id });
    if (!data) data = await Level.create({ userId: member.id, xp: 0, level: newLevel, lastMessage: 0 });
    else data.level = newLevel;

    data.xp = 0;

    await checkLevelUp(message, data, member.id);

    message.reply(`✅ تم تعيين مستوى ${member} إلى ${data.level}`);
  }

  // ===== top =====
  if (command === "top") {
    const top = await Level.find().sort({ level: -1, xp: -1 }).limit(10);
    if (!top || top.length === 0) return message.reply("No level data found.");

    const canvasHeight = 80 * top.length + 70;
    const canvas = createCanvas(800, canvasHeight);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#111214";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1c20";
    ctx.fillRect(20, 20, 760, canvasHeight - 40);

    ctx.font = "bold 28px Cairo";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("🏆 Top 10 Levels", 30, 50);

    let yOffset = 90;

    for (let i = 0; i < top.length; i++) {
      const member = await message.guild.members.fetch(top[i].userId).catch(()=>null);
      if (!member) continue;

      const avatar = await loadImage(member.user.displayAvatarURL({ extension:"png", size:128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, yOffset + 40, 30, 0, Math.PI*2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 30, yOffset + 10, 60, 60);
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.font = "24px Cairo";
      ctx.fillText(`${i+1}. ${member.user.username}`, 110, yOffset + 40);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillText(`Level: ${top[i].level} | XP: ${top[i].xp}`, 110, yOffset + 70);

      yOffset += 80;
    }

    const buffer = canvas.toBuffer();
    await message.reply({ files:[{ attachment: buffer, name:"top.png"}] });
  }

  // ===== rank =====
  if (command === "rank") {
    const user = message.mentions.users.first() || message.author;
    const userData = await Level.findOne({ userId: user.id });
    if (!userData) return message.reply("No level data found");

    const neededXP = xpNeeded(userData.level + 1);
    const progress = userData.xp / neededXP;

    const canvas = createCanvas(800,250);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#111214";
    ctx.fillRect(0,0,800,250);
    ctx.fillStyle = "#1a1c20";
    ctx.fillRect(20,20,760,210);

    const avatar = await loadImage(user.displayAvatarURL({ extension:"png", size:256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(125,125,80,0,Math.PI*2,true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar,45,45,160,160);
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Cairo";
    ctx.fillText(user.username,240,90);

    ctx.font = "26px Cairo";
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`Level: ${userData.level}`,240,130);
    ctx.fillText(`XP: ${userData.xp} / ${neededXP}`,240,160);

    ctx.fillStyle = "#2a2d31";
    ctx.fillRect(240,180,500,25);
    ctx.fillStyle = "#9b59b6";
    ctx.fillRect(240,180,500*progress,25);

    const buffer = canvas.toBuffer();
    await message.reply({ files:[{ attachment: buffer, name:"rank.png"}] });
  }

});

client.login(process.env.TOKEN);
