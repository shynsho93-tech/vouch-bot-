const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

const COOLDOWN = 5 * 60 * 1000;
const cooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vouch")
    .setDescription("Système de vouch")
    .addSubcommand(sc =>
      sc.setName("add")
        .setDescription("Donner un vouch positif")
        .addUserOption(o => o.setName("user").setDescription("Utilisateur").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Raison").setRequired(true))
        .addStringOption(o => o.setName("proof").setDescription("Lien preuve (optionnel)"))
    )
    .addSubcommand(sc =>
      sc.setName("remove")
        .setDescription("Donner un vouch négatif")
        .addUserOption(o => o.setName("user").setDescription("Utilisateur").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Raison").setRequired(true))
        .addStringOption(o => o.setName("proof").setDescription("Lien preuve (optionnel)"))
    )
    .addSubcommand(sc =>
      sc.setName("stats")
        .setDescription("Voir les stats vouch")
        .addUserOption(o => o.setName("user").setDescription("Utilisateur").setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName("list")
        .setDescription("Voir les derniers vouchs")
        .addUserOption(o => o.setName("user").setDescription("Utilisateur").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ===== STATS =====
    if (sub === "stats") {
      const user = interaction.options.getUser("user");

      const pos = db.prepare(`
        SELECT COUNT(*) as c FROM vouches 
        WHERE guild_id=? AND to_user=? AND type='POS'
      `).get(guildId, user.id).c;

      const neg = db.prepare(`
        SELECT COUNT(*) as c FROM vouches 
        WHERE guild_id=? AND to_user=? AND type='NEG'
      `).get(guildId, user.id).c;

      const embed = new EmbedBuilder()
        .setTitle("📊 Vouch Stats")
        .setDescription(`👤 **${user.username}**
        ✅ Positifs: **${pos}**
        ❌ Négatifs: **${neg}**
        ⭐ Score: **${pos - neg}**`);

      return interaction.reply({ embeds: [embed] });
    }

    // ===== LIST =====
    if (sub === "list") {
      const user = interaction.options.getUser("user");

      const rows = db.prepare(`
        SELECT * FROM vouches 
        WHERE guild_id=? AND to_user=?
        ORDER BY timestamp DESC LIMIT 5
      `).all(guildId, user.id);

      if (!rows.length)
        return interaction.reply({ content: "Aucun vouch trouvé.", ephemeral: true });

      const desc = rows.map(v =>
        `${v.type === "POS" ? "✅" : "❌"} par <@${v.from_user}>
        └ ${v.reason}`
      ).join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle(`📜 Derniers vouchs — ${user.username}`)
        .setDescription(desc);

      return interaction.reply({ embeds: [embed] });
    }

    // ===== ADD / REMOVE =====
    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const proof = interaction.options.getString("proof") || null;
    const type = sub === "add" ? "POS" : "NEG";

    if (target.id === interaction.user.id)
      return interaction.reply({ content: "❌ Tu ne peux pas te vouch toi-même.", ephemeral: true });

    const last = cooldowns.get(interaction.user.id) || 0;
    if (Date.now() - last < COOLDOWN)
      return interaction.reply({ content: "⏳ Cooldown actif (5 minutes).", ephemeral: true });

    cooldowns.set(interaction.user.id, Date.now());

    db.prepare(`
      INSERT INTO vouches (guild_id, from_user, to_user, type, reason, proof, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      guildId,
      interaction.user.id,
      target.id,
      type,
      reason,
      proof,
      Date.now()
    );

    const embed = new EmbedBuilder()
      .setTitle(type === "POS" ? "✅ Nouveau Vouch" : "❌ Vouch Négatif")
      .addFields(
        { name: "Donneur", value: interaction.user.tag, inline: true },
        { name: "Receveur", value: target.tag, inline: true },
        { name: "Raison", value: reason }
      )
      .setTimestamp();

    if (proof) embed.addFields({ name: "Preuve", value: proof });

    await interaction.reply({ embeds: [embed] });

    // LOG
    const logChannel = interaction.client.channels.cache.get(process.env.VOUCH_LOG_CHANNEL_ID);
    if (logChannel) logChannel.send({ embeds: [embed] });
  }
};