const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const http = require("http");

// ==========================================
// SERVIDOR HTTP PARA RENDER
// ==========================================

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Discord bot online");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor HTTP escuchando en el puerto ${PORT}`);
});

// ==========================================
// CLIENTE DISCORD
// ==========================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ID DE TU APLICACIÓN
const CLIENT_ID = "1552817688378605650";

// Token desde las variables de entorno de Render
const TOKEN = process.env.DISCORD_TOKEN;

// ==========================================
// FUNCIONES DE DURACIÓN
// ==========================================

function convertirDuracion(texto) {
    if (!texto) return null;

    texto = texto.toLowerCase().replace(/\s+/g, "");

    if (
        texto === "permanente" ||
        texto === "permanent" ||
        texto === "perm"
    ) {
        return {
            permanente: true,
            milisegundos: null,
            texto: "Permanente"
        };
    }

    const regex = /(\d+)(mo|y|w|d|h|m|s)/g;

    let match;
    let total = 0;
    let encontrado = false;

    const unidades = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        mo: 30 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000
    };

    while ((match = regex.exec(texto)) !== null) {
        encontrado = true;

        const cantidad = Number(match[1]);
        const unidad = match[2];

        total += cantidad * unidades[unidad];
    }

    if (!encontrado || total <= 0) {
        return null;
    }

    // Comprobar que no haya texto inválido
    const textoLimpio = texto.replace(/(\d+)(mo|y|w|d|h|m|s)/g, "");

    if (textoLimpio.length > 0) {
        return null;
    }

    return {
        permanente: false,
        milisegundos: total,
        texto: formatearDuracion(total)
    };
}

function formatearDuracion(ms) {
    let segundos = Math.floor(ms / 1000);

    const dias = Math.floor(segundos / 86400);
    segundos %= 86400;

    const horas = Math.floor(segundos / 3600);
    segundos %= 3600;

    const minutos = Math.floor(segundos / 60);
    segundos %= 60;

    const partes = [];

    if (dias > 0) {
        partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);
    }

    if (horas > 0) {
        partes.push(`${horas} ${horas === 1 ? "hora" : "horas"}`);
    }

    if (minutos > 0) {
        partes.push(`${minutos} ${minutos === 1 ? "minuto" : "minutos"}`);
    }

    if (segundos > 0) {
        partes.push(`${segundos} ${segundos === 1 ? "segundo" : "segundos"}`);
    }

    return partes.join(" ") || "0 segundos";
}

// ==========================================
// COMANDOS
// ==========================================

const commands = [
    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario que quieres banear")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duracion")
                .setDescription("Ejemplo: 10m, 2h, 7d")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Silencia temporalmente a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario que quieres silenciar")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duracion")
                .setDescription("Ej: 30s, 10m, 2h, 1d, 2h30m o permanente")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el silencio a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario al que quieres quitar el mute")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario mediante su ID.")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID del usuario")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
].map(command => command.toJSON());

// ==========================================
// REGISTRO DE COMANDOS
// ==========================================

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("Registrando comandos...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log("✅ Comandos registrados correctamente.");
    } catch (error) {
        console.error("❌ Error registrando comandos:", error);
    }
}

// ==========================================
// BOT LISTO
// ==========================================

client.once("clientReady", () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
});

// ==========================================
// INTERACCIONES
// ==========================================

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {

        // ======================================
        // MUTE
        // ======================================

        if (interaction.commandName === "mute") {

            const usuario = interaction.options.getUser("usuario");
            const duracionTexto = interaction.options.getString("duracion");

            const miembro = await interaction.guild.members.fetch(usuario.id);

            // Evitar mutear al dueño/servidor si no corresponde
            if (!miembro) {
                return interaction.reply({
                    content: "❌ No pude encontrar a ese usuario en el servidor.",
                    ephemeral: true
                });
            }

            if (usuario.id === interaction.user.id) {
                return interaction.reply({
                    content: "❌ No puedes silenciarte a ti mismo.",
                    ephemeral: true
                });
            }

            const duracion = convertirDuracion(duracionTexto);

            if (!duracion) {
                return interaction.reply({
                    content:
                        "❌ Duración inválida.\n\n" +
                        "Ejemplos: `30s`, `5m`, `2h`, `24h`, `7d`, `2h30m`, `1d12h` o `permanente`.",
                    ephemeral: true
                });
            }

            // ==================================
            // MUTE PERMANENTE
            // ==================================

            if (duracion.permanente) {

                return interaction.reply({
                    content:
                        "⚠️ El modo `permanente` requiere un sistema de rol de mute. " +
                        "El timeout de Discord no puede ser permanente.\n\n" +
                        "Por ahora usa una duración temporal como `28d`."
                });
            }

            // Discord permite timeouts de hasta 28 días
            const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;

            if (duracion.milisegundos > MAX_TIMEOUT) {
                return interaction.reply({
                    content:
                        "❌ La duración supera el máximo permitido por el timeout de Discord: **28 días**.\n\n" +
                        "Para duraciones mayores podemos implementar un sistema de rol de mute permanente.",
                    ephemeral: true
                });
            }

            await miembro.timeout(
                duracion.milisegundos,
                `Mute aplicado por ${interaction.user.tag}`
            );

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🔇 USUARIO SILENCIADO")
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${usuario}`,
                        inline: false
                    },
                    {
                        name: "⏱️ Duración",
                        value: duracion.texto,
                        inline: true
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`,
                        inline: true
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });
        }

        // ======================================
        // UNMUTE
        // ======================================

        if (interaction.commandName === "unmute") {

            const usuario = interaction.options.getUser("usuario");

            const miembro = await interaction.guild.members.fetch(usuario.id);

            if (!miembro) {
                return interaction.reply({
                    content: "❌ No pude encontrar a ese usuario.",
                    ephemeral: true
                });
            }

            await miembro.timeout(null, `Mute quitado por ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔊 USUARIO DESILENCIADO")
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${usuario}`,
                        inline: false
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`,
                        inline: true
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });
        }

        // ======================================
        // BAN
        // ======================================

        if (interaction.commandName === "ban") {

            const usuario = interaction.options.getUser("usuario");

            const miembro = await interaction.guild.members.fetch(usuario.id);

            await miembro.ban({
                reason: `Ban aplicado por ${interaction.user.tag}`
            });

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔨 USUARIO BANEADO")
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${usuario}`,
                        inline: false
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`,
                        inline: true
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });
        }

        // ======================================
        // UNBAN
        // ======================================

        if (interaction.commandName === "unban") {

            const id = interaction.options.getString("id");

            await interaction.guild.members.unban(
                id,
                `Unban realizado por ${interaction.user.tag}`
            );

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔓 USUARIO DESBANEADO")
                .addFields(
                    {
                        name: "🆔 ID",
                        value: id,
                        inline: false
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`,
                        inline: true
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });
        }

    } catch (error) {

        console.error("❌ Error procesando comando:", error);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "❌ Ocurrió un error al ejecutar el comando.",
                ephemeral: true
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: "❌ Ocurrió un error al ejecutar el comando.",
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// ==========================================
// INICIAR
// ==========================================

if (!TOKEN) {
    console.error("❌ Falta DISCORD_TOKEN en las variables de entorno.");
    process.exit(1);
}

registrarComandos();

client.login(TOKEN);
