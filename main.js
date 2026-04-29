require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder
} = require('discord.js');

const fs = require('fs');
const QRCode = require('qrcode');
const axios = require('axios');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1476293650102227097";
const GUILD_ID = "1468520331445665867";

const ADMIN_ROLE_ID = "1477384729102909440";
const UPI_ID = "ashotoshpatra797@ybl";

const PTERO_API_KEY = process.env.PTERO_API_KEY;
const PTERO_PANEL_URL = process.env.PTERO_PANEL_URL;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ---------------- SAFE JSON ---------------- */

function readJSON(path, def) {
  try {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, JSON.stringify(def, null, 2));
      return def;
    }
    const raw = fs.readFileSync(path);
    if (!raw.length) return def;
    return JSON.parse(raw);
  } catch {
    return def;
  }
}

function writeJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

/* ---------------- READY ---------------- */

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

/* ---------------- SLASH COMMANDS ---------------- */

const commands = [

  new SlashCommandBuilder()
    .setName('shopadd')
    .setDescription('Add item to shop')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Item name')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('price')
        .setDescription('Item price')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('category')
        .setDescription('Item category')
        .setRequired(true)
        .addChoices(
          { name: 'Crate', value: 'crate' },
          { name: 'Rank', value: 'rank' },
          { name: 'Tag', value: 'tag' },
          { name: 'Coin', value: 'coin' }
        ))
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(o =>
      o.setName('command')
        .setDescription('Console command use {player}')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View shop items')
    .addStringOption(o =>
      o.setName('category')
        .setDescription('Filter by category')
        .setRequired(false)
        .addChoices(
          { name: 'Crate', value: 'crate' },
          { name: 'Rank', value: 'rank' },
          { name: 'Tag', value: 'tag' },
          { name: 'Coin', value: 'coin' }
        )),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy item from shop')
    .addStringOption(o =>
      o.setName('item')
        .setDescription('Select item')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(o =>
      o.setName('username')
        .setDescription('Minecraft username')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('shopdelete')
    .setDescription('Delete shop item')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Select item to delete')
        .setRequired(true)
        .setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName('shopedit')
    .setDescription('Edit item price')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Select item')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(o =>
      o.setName('new_price')
        .setDescription('New price')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('approve')
    .setDescription('Approve pending order')
    .addStringOption(o =>
      o.setName('order_id')
        .setDescription('Select pending order')
        .setRequired(true)
        .setAutocomplete(true))

].map(c => c.toJSON());
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log('✅ Slash commands registered.');
})();

/* ---------------- AUTOCOMPLETE ---------------- */

client.on('interactionCreate', async interaction => {

  if (!interaction.isAutocomplete()) return;

  try {

    const focused = interaction.options.getFocused() || "";
    const items = readJSON('./items.json', []);
    const payments = readJSON('./payments.json', []);
    const servers = readJSON('./servers.json', {});

    /* ITEM AUTOCOMPLETE */
    if (['buy', 'shopdelete', 'shopedit'].includes(interaction.commandName)) {

      const filtered = items
        .filter(i => i.name?.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25)
        .map(i => ({
          name: i.name,
          value: i.name
        }));

      return await interaction.respond(filtered);
    }

    /* APPROVE AUTOCOMPLETE */
    if (interaction.commandName === 'approve') {

    const filtered = payments
        .filter(p => p.status && p.status.toLowerCase() === "pending")
        .slice(0, 25)
        .map(p => ({
        name: `${p.orderId} | ${p.item?.name || "Unknown"}`,
        value: String(p.orderId)
        }));

    return await interaction.respond(filtered);
    }

    /* SERVER AUTOCOMPLETE */
    if (interaction.commandName === 'shopadd') {

      const filtered = Object.keys(servers)
        .filter(s => s.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25)
        .map(s => ({
          name: s,
          value: s
        }));

      return await interaction.respond(filtered);
    }

  } catch (err) {

    console.error("AUTOCOMPLETE ERROR:", err);

    try {
      return await interaction.respond([]);
    } catch {}

  }

});
/* ---------------- COMMAND HANDLER ---------------- */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID);

  /* SHOPADD */
  if (interaction.commandName === 'shopadd') {
    if (!isAdmin)
      return interaction.reply({ content: "❌ No permission.", ephemeral: true });

    const name = interaction.options.getString('name');
    const price = interaction.options.getInteger('price');
    const category = interaction.options.getString('category');
    const server = interaction.options.getString('server');
    const command = interaction.options.getString('command');

    const items = readJSON('./items.json', []);
    items.push({ name, price, category, server, command });
    writeJSON('./items.json', items);

    return interaction.reply(`✅ ${name} added.`);
  }

  /* SHOP */
  if (interaction.commandName === 'shop') {
    const category = interaction.options.getString('category');
    let items = readJSON('./items.json', []);

    if (category)
      items = items.filter(i => i.category === category);

    if (!items.length)
      return interaction.reply("No items found.");

    let msg = `🛒 Shop\n\n`;
    items.forEach(i => msg += `${i.name} - ₹${i.price}\n`);

    return interaction.reply(msg);
  }

  /* BUY */
  if (interaction.commandName === 'buy') {

    const itemName = interaction.options.getString('item');
    const username = interaction.options.getString('username');

    const items = readJSON('./items.json', []);
    const item = items.find(i => i.name === itemName);

    if (!item)
      return interaction.reply({ content: "Item not found.", ephemeral: true });

    const upiLink = `upi://pay?pa=${UPI_ID}&pn=SMPStore&am=${item.price}&cu=INR`;
    const qrBuffer = await QRCode.toBuffer(upiLink);
    const attachment = new AttachmentBuilder(qrBuffer, { name: 'payment.png' });

    const payments = readJSON('./payments.json', []);
    const orderId = Date.now().toString();

    payments.push({
      orderId,
      userId: interaction.user.id,
      username,
      item,
      status: "pending"
    });

    writeJSON('./payments.json', payments);

    return interaction.reply({
      content: `💳 Pay ₹${item.price}\nOrder ID: ${orderId}`,
      files: [attachment]
    });
  }

  /* SHOPDELETE */
  if (interaction.commandName === 'shopdelete') {

    if (!isAdmin)
      return interaction.reply({ content: "❌ No permission.", ephemeral: true });

    const name = interaction.options.getString('name');
    const items = readJSON('./items.json', []);
    const index = items.findIndex(i => i.name === name);

    if (index === -1)
      return interaction.reply({ content: "❌ Item not found.", ephemeral: true });

    items.splice(index, 1);
    writeJSON('./items.json', items);

    return interaction.reply(`🗑️ Deleted ${name}`);
  }

  /* SHOPEDIT */
  if (interaction.commandName === 'shopedit') {

    if (!isAdmin)
      return interaction.reply({ content: "❌ No permission.", ephemeral: true });

    const name = interaction.options.getString('name');
    const newPrice = interaction.options.getInteger('new_price');

    const items = readJSON('./items.json', []);
    const item = items.find(i => i.name === name);

    if (!item)
      return interaction.reply({ content: "❌ Item not found.", ephemeral: true });

    item.price = newPrice;
    writeJSON('./items.json', items);

    return interaction.reply(`✏️ Updated ${name} to ₹${newPrice}`);
  }

  /* APPROVE */
  if (interaction.commandName === 'approve') {

    if (!isAdmin)
      return interaction.reply({ content: "❌ No permission.", ephemeral: true });

    await interaction.deferReply();

    const orderId = interaction.options.getString('order_id');
    const payments = readJSON('./payments.json', []);
    const order = payments.find(p => p.orderId === orderId);

    if (!order)
      return interaction.editReply("Order not found.");

    const servers = readJSON('./servers.json', {});
    const serverId = servers[order.item.server];

    if (!serverId)
      return interaction.editReply("Server not found.");

    const finalCommand = order.item.command.replace('{player}', order.username);

    try {
      await axios.post(
        `${PTERO_PANEL_URL}/api/client/servers/${serverId}/command`,
        { command: finalCommand },
        {
          headers: {
            Authorization: `Bearer ${PTERO_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      order.status = "completed";
      writeJSON('./payments.json', payments);

      return interaction.editReply("✅ Approved & executed.");
    } catch {
      return interaction.editReply("❌ Failed to execute command.");
    }
  }

});

client.login(TOKEN);