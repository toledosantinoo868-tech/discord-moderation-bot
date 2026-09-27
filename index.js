require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

// =====================================================
// CONFIGURACIÓN GLOBAL
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1552817688378605650";

const OWNER_ROLE_ID = "1553559027697320026";
const BOT_COLOR = 0x3498DB;
const FOOTER = "Bot creado por DEVLVdarkkidd";

// Mapa para rastrear el spam: userId -> Array de timestamps
const spamMap = new Map();

// =====================================================
// CLIENTE
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function esAdminOOwner(interaction) {
    if (!interaction.guild) return false;
    return (
        interaction.guild.ownerId === interaction.user.id ||
        interaction.member.roles.cache.has(OWNER_ROLE_ID) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
    );
}

function esStaff(interaction) {
    if (!interaction.guild) return false;
    return (
        esAdminOOwner(interaction) ||
        interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
    );
}

function puedeModerar(interaction, miembro) {
    if (!interaction.guild || !miembro) return false;
    if (interaction.guild.ownerId === interaction.user.id) return true;
    if (miembro.id === interaction.guild.ownerId || miembro.id === interaction.user.id) return false;

    const ejecutor = interaction.member;
    if (!ejecutor) return false;

    return miembro.roles.highest.position < ejecutor.roles.highest.position;
}

function convertirDuracion(entrada) {
    if (!entrada) return null;

    const match = entrada.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!match) return null;

    const cantidad = Number(match[1]);
    const unidad = match[2].toLowerCase();

    const multiplicadores = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return cantidad * multiplicadores[unidad];
}

async function enviarLog(guild, embed) {
    try {
        const canal = guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildText &&
                channel.name.toLowerCase() === "logs"
        );

        if (!canal) return;
        await canal.send({ embeds: [embed] });
    } catch (error) {
        console.error("Error enviando log:", error.message);
    }
}

// =====================================================
// REGISTRO DE COMANDOS SLASH
// =====================================================

const commands = [
    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes del canal.")
        .addIntegerOption(opt => opt.setName("cantidad").setDescription("Cantidad de mensajes").setRequired(true).setMinValue(1).setMaxValue(100)),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Silencia temporalmente a un usuario.")
        .addUserOption(opt => opt.setName("usuario").setDescription("Usuario a silenciar").setRequired(true))
        .addStringOption(opt => opt.setName("duracion").setDescription("Ejemplo: 30s, 5m, 1h, 1d").setRequired(true)),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el silencio a un usuario.")
        .addUserOption(opt => opt.setName("usuario").setDescription("Usuario").setRequired(true)),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(opt => opt.setName("usuario").setDescription("Usuario a banear").setRequired(true)),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario.")
        .addStringOption(opt => opt.setName("id").setDescription("ID del usuario").setRequired(true)),

    new SlashCommandBuilder()
        .setName("create_msj")
        .setDescription("Envía un mensaje personalizado estructurado.")
        .addStringOption(opt => opt.setName("titulo").setDescription("Título del mensaje").setRequired(true))
        .addStringOption(opt => opt.setName("contenido").setDescription("Texto principal del mensaje").setRequired(true))
        .addChannelOption(opt => opt.setName("canal").setDescription("Canal de destino (opcional)").setRequired(false))
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("🔄 Registrando comandos de moderación...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log(`✅ Comandos registrados con éxito.`);
    } catch (error) {
        console.error("❌ Error registrando comandos:", error);
    }
}

// =====================================================
// BOT LISTO
// =====================================================

client.once("ready", async () => {
    console.log("================================");
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log("================================");
    await registrarComandos();
});

// =====================================================
// SISTEMA ANTI-SPAM
// =====================================================

client.on("messageCreate", async message => {
    if (!message.guild || message.author.bot) return;

    // Los administradores ignoran la restricción de Anti-Spam
    if (message.member && message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

    const ahora = Date.now();
    const tiempoLimite = 3000; // 3 segundos
    const maxMensajes = 5; // Máximo 5 mensajes permitidos en el intervalo

    if (!spamMap.has(message.author.id)) {
        spamMap.set(message.author.id, []);
    }

    const timestamps = spamMap.get(message.author.id);
    timestamps.push(ahora);

    // Filtrar timestamps antiguos
    const filtrados = timestamps.filter(t => ahora - t < tiempoLimite);
    spamMap.set(message.author.id, filtrados);

    if (filtrados.length > maxMensajes) {
        try {
            await message.delete();
            const aviso = await message.channel.send(`⚠️ ${message.author}, por favor evita enviar mensajes tan rápido (Anti-Spam).`);
            setTimeout(() => aviso.delete().catch(() => {}), 4000);

            const embedLog = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle("⚠️ ANTI-SPAM DETECTADO")
                .setDescription(`Se detectó envío masivo de mensajes por parte de ${message.author}.`)
                .addFields({ name: "📍 Canal", value: `${message.channel}` })
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await enviarLog(message.guild, embedLog);
        } catch (error) {
            console.error("Error al procesar el Anti-Spam:", error);
        }
    }
});

// =====================================================
// INTERACCIONES Y COMANDOS
// =====================================================

client.on("interactionCreate", async interaction => {
    try {
        if (!interaction.isChatInputCommand() || !interaction.guild) return;

        if (!esStaff(interaction)) {
            return interaction.reply({ content: "❌ No tienes permisos de Staff para ejecutar este comando.", ephemeral: true });
        }

        // /CLEAR
        if (interaction.commandName === "clear") {
            const cantidad = interaction.options.getInteger("cantidad");
            await interaction.deferReply({ ephemeral: true });
            const mensajes = await interaction.channel.bulkDelete(cantidad, true);

            const embed = new EmbedBuilder()
                .setColor(BOT_COLOR)
                .setTitle("🧹 MENSAJES ELIMINADOS")
                .addFields(
                    { name: "📊 Cantidad", value: `${mensajes.size}`, inline: true },
                    { name: "👮 Moderador", value: `${interaction.user}`, inline: true },
                    { name: "📍 Canal", value: `${interaction.channel}`, inline: true }
                )
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /MUTE
        if (interaction.commandName === "mute") {
            const usuario = interaction.options.getUser("usuario");
            const duracion = interaction.options.getString("duracion");
            const miembro = await interaction.guild.members.fetch(usuario.id).catch(() => null);

            if (!miembro) return interaction.reply({ content: "❌ El usuario no pertenece al servidor.", ephemeral: true });

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({ content: "❌ No puedes moderar a este usuario por su jerarquía de roles.", ephemeral: true });
            }

            const tiempo = convertirDuracion(duracion);
            if (!tiempo || tiempo <= 0 || tiempo > 28 * 24 * 60 * 60 * 1000) {
                return interaction.reply({ content: "❌ Formato inválido. Utiliza: `30s` (segundos), `5m` (minutos), `1h` (horas) o `1d` (días). Máximo 28 días.", ephemeral: true });
            }

            await miembro.timeout(tiempo, `Mute aplicado por ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(BOT_COLOR)
                .setTitle("🔇 USUARIO SILENCIADO")
                .setDescription(`${usuario} ha sido silenciado correctamente.`)
                .addFields(
                    { name: "⏱️ Duración", value: duracion, inline: true },
                    { name: "👮 Moderador", value: `${interaction.user}`, inline: true }
                )
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /UNMUTE
        if (interaction.commandName === "unmute") {
            const usuario = interaction.options.getUser("usuario");
            const miembro = await interaction.guild.members.fetch(usuario.id).catch(() => null);

            if (!miembro) return interaction.reply({ content: "❌ El usuario no se encuentra en el servidor.", ephemeral: true });

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({ content: "❌ No puedes modificar la sanción a este usuario.", ephemeral: true });
            }

            await miembro.timeout(null, `Unmute realizado por ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle("🔊 MUTE REMOVIDO")
                .setDescription(`${usuario} ya no se encuentra silenciado.`)
                .addFields({ name: "👮 Moderador", value: `${interaction.user}` })
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /BAN
        if (interaction.commandName === "ban") {
            const usuario = interaction.options.getUser("usuario");
            const miembro = await interaction.guild.members.fetch(usuario.id).catch(() => null);

            if (miembro && !puedeModerar(interaction, miembro)) {
                return interaction.reply({ content: "❌ No puedes banear a este usuario por su jerarquía de roles.", ephemeral: true });
            }

            await interaction.guild.members.ban(usuario.id, { reason: `Baneado por ${interaction.user.tag}` });

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle("🔨 USUARIO BANEADO")
                .setDescription(`${usuario} fue baneado del servidor.`)
                .addFields({ name: "👮 Moderador", value: `${interaction.user}` })
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /UNBAN
        if (interaction.commandName === "unban") {
            const id = interaction.options.getString("id").trim();

            if (!/^\d{17,20}$/.test(id)) {
                return interaction.reply({ content: "❌ La ID ingresada no es válida.", ephemeral: true });
            }

            try {
                await interaction.guild.members.unban(id, `Desbaneado por ${interaction.user.tag}`);

                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle("🔓 USUARIO DESBANEADO")
                    .setDescription(`La ID \`${id}\` fue desbaneada exitosamente.`)
                    .addFields({ name: "👮 Moderador", value: `${interaction.user}` })
                    .setFooter({ text: FOOTER })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                await enviarLog(interaction.guild, embed);
            } catch (err) {
                return interaction.reply({ content: "❌ No se encontró ningún baneo activo para esa ID.", ephemeral: true });
            }
            return;
        }

        // /CREATE_MSJ
        if (interaction.commandName === "create_msj") {
            const titulo = interaction.options.getString("titulo");
            const contenido = interaction.options.getString("contenido");
            const canalDestino = interaction.options.getChannel("canal") || interaction.channel;

            if (!canalDestino.isTextBased()) {
                return interaction.reply({ content: "❌ El canal seleccionado debe ser de texto.", ephemeral: true });
            }

            const embedMsj = new EmbedBuilder()
                .setColor(BOT_COLOR)
                .setTitle(titulo)
                .setDescription(contenido.replace(/\\n/g, "\n"))
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await canalDestino.send({ embeds: [embedMsj] });
            return interaction.reply({ content: `✅ Mensaje enviado exitosamente en ${canalDestino}.`, ephemeral: true });
        }

    } catch (error) {
        console.error("Error procesando interacción:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Ocurrió un error al ejecutar el comando.", ephemeral: true });
        }
    }
});

// =====================================================
// INICIAR SESIÓN
// =====================================================

client.login(TOKEN);
