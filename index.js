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

// =====================================================
// CONFIGURACIÓN
// =====================================================

const CLIENT_ID = "1552817688378605650";
const TOKEN = process.env.DISCORD_TOKEN;

// ID DEL ROL OWNER
const OWNER_ROLE_ID = "1531489394127536188";

// =====================================================
// SERVIDOR PARA RENDER
// =====================================================

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Discord bot online");
}).listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor HTTP escuchando en el puerto ${PORT}`);
});

// =====================================================
// CLIENTE DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// =====================================================
// DURACIONES
// =====================================================

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

    const unidades = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        mo: 30 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000
    };

    let match;
    let total = 0;
    let encontrado = false;
    let longitud = 0;

    while ((match = regex.exec(texto)) !== null) {
        encontrado = true;

        const cantidad = Number(match[1]);
        const unidad = match[2];

        total += cantidad * unidades[unidad];
        longitud += match[0].length;
    }

    if (!encontrado || longitud !== texto.length || total <= 0) {
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

// =====================================================
// COMANDOS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("ip")
        .setDescription("Muestra la IP del servidor de Minecraft."),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario que quieres banear")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

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
                .setDescription(
                    "Ej: 30s, 5m, 1h, 24h, 7d"
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el silencio a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario al que quitar el mute")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario mediante su ID.")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID del usuario")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Bloquea el canal para los usuarios."),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea el canal.")

].map(command => command.toJSON());

// =====================================================
// REGISTRO DE COMANDOS
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("Registrando comandos...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log("✅ Comandos registrados correctamente.");

    } catch (error) {
        console.error(
            "❌ Error registrando comandos:",
            error
        );
    }
}

// =====================================================
// BOT READY
// =====================================================

client.once("clientReady", () => {
    console.log(
        `✅ Bot conectado como ${client.user.tag}`
    );
});

// =====================================================
// INTERACCIONES
// =====================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    try {

        // =================================================
        // IP
        // =================================================

        if (interaction.commandName === "ip") {

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🎮 SERVIDOR DE MINECRAFT")
                .setDescription(
                    "Conectate al servidor usando estos datos:"
                )
                .addFields(
                    {
                        name: "🌐 IP",
                        value: "`mc.laordenmorada.lat`"
                    },
                    {
                        name: "🔌 PUERTO",
                        value: "`19527`"
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // MUTE
        // =================================================

        if (interaction.commandName === "mute") {

            const usuario =
                interaction.options.getUser("usuario");

            const duracionTexto =
                interaction.options.getString("duracion");

            const miembro =
                await interaction.guild.members.fetch(
                    usuario.id
                );

            const duracion =
                convertirDuracion(duracionTexto);

            if (!duracion) {
                return interaction.reply({
                    content:
                        "❌ Duración inválida. Ejemplos: `30s`, `5m`, `1h`, `24h`, `7d`.",
                    ephemeral: true
                });
            }

            if (duracion.permanente) {
                return interaction.reply({
                    content:
                        "⚠️ Discord no permite timeouts permanentes. El máximo es de 28 días.",
                    ephemeral: true
                });
            }

            const MAX_TIMEOUT =
                28 * 24 * 60 * 60 * 1000;

            if (duracion.milisegundos > MAX_TIMEOUT) {
                return interaction.reply({
                    content:
                        "❌ El máximo permitido por Discord es de 28 días.",
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
                        value: `${usuario}`
                    },
                    {
                        name: "⏱️ Tiempo",
                        value: duracion.texto
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // UNMUTE
        // =================================================

        if (interaction.commandName === "unmute") {

            const usuario =
                interaction.options.getUser("usuario");

            const miembro =
                await interaction.guild.members.fetch(
                    usuario.id
                );

            await miembro.timeout(
                null,
                `Mute quitado por ${interaction.user.tag}`
            );

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔊 USUARIO DESILENCIADO")
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${usuario}`
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // BAN
        // =================================================

        if (interaction.commandName === "ban") {

            const usuario =
                interaction.options.getUser("usuario");

            const miembro =
                await interaction.guild.members.fetch(
                    usuario.id
                );

            await miembro.ban({
                reason:
                    `Ban aplicado por ${interaction.user.tag}`
            });

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔨 USUARIO BANEADO")
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${usuario}`
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // UNBAN
        // =================================================

        if (interaction.commandName === "unban") {

            const id =
                interaction.options.getString("id");

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
                        value: id
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // LOCK
        // =================================================

        if (interaction.commandName === "lock") {

            await interaction.deferReply();

            const puedeUsar =
                interaction.guild.ownerId === interaction.user.id ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            if (!puedeUsar) {

                return interaction.editReply({
                    content:
                        "❌ No tienes permisos para bloquear este canal.\n\nBot creado por DEVLVDARKKIDD"
                });
            }

            const canal = interaction.channel;

            const miembroBot =
                interaction.guild.members.me;

            if (!miembroBot) {
                return interaction.editReply({
                    content:
                        "❌ No pude encontrar al bot dentro del servidor."
                });
            }

            const permisosBot =
                canal.permissionsFor(miembroBot);

            if (
                !permisosBot ||
                !permisosBot.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ El bot necesita el permiso **Gestionar roles**."
                });
            }

            // ---------------------------------------------
            // BLOQUEAR @EVERYONE
            // ---------------------------------------------

            await canal.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            // ---------------------------------------------
            // BLOQUEAR TODOS LOS ROLES DEL SERVIDOR
            // EXCEPTO OWNER
            // ---------------------------------------------

            const roles = interaction.guild.roles.cache;

            for (const [roleId, role] of roles) {

                if (role.id === interaction.guild.id) {
                    continue;
                }

                if (role.id === OWNER_ROLE_ID) {
                    continue;
                }

                // Ignoramos @everyone
                if (role.id === interaction.guild.roles.everyone.id) {
                    continue;
                }

                try {

                    await canal.permissionOverwrites.edit(
                        role.id,
                        {
                            SendMessages: false
                        }
                    );

                } catch (error) {

                    console.error(
                        `No se pudo modificar el rol ${role.name}:`,
                        error.message
                    );
                }
            }

            // ---------------------------------------------
            // PERMITIR AL ROL OWNER
            // ---------------------------------------------

            await canal.permissionOverwrites.edit(
                OWNER_ROLE_ID,
                {
                    SendMessages: true,
                    ViewChannel: true
                }
            );

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔒 CANAL BLOQUEADO")
                .setDescription(
                    "El canal está bloqueado. Los usuarios pueden seguir viéndolo, pero no pueden enviar mensajes."
                )
                .addFields(
                    {
                        name: "👑 Acceso para escribir",
                        value: "Solo el rol `『 𝐎𝐖𝐍𝐄𝐑 』`"
                    },
                    {
                        name: "👁️ Visibilidad",
                        value: "Todos pueden ver el canal."
                    },
                    {
                        name: "🛡️ Bloqueado por",
                        value: `${interaction.user}`
                    }
                )
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            return interaction.editReply({
                embeds: [embed]
            });
        }

        // =================================================
        // UNLOCK
        // =================================================

        if (interaction.commandName === "unlock") {

            await interaction.deferReply();

            const puedeUsar =
                interaction.guild.ownerId === interaction.user.id ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            if (!puedeUsar) {

                return interaction.editReply({
                    content:
                        "❌ No tienes permisos para desbloquear este canal.\n\nBot creado por DEVLVDARKKIDD"
                });
            }

            const canal = interaction.channel;

            // ---------------------------------------------
            // QUITAR BLOQUEO DE @EVERYONE
            // ---------------------------------------------

            await canal.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            // ---------------------------------------------
            // QUITAR BLOQUEO DE TODOS LOS ROLES
            // ---------------------------------------------

            const roles = interaction.guild.roles.cache;

            for (const [roleId, role] of roles) {

                if (role.id === interaction.guild.id) {
                    continue;
                }

                if (role.id === interaction.guild.roles.everyone.id) {
                    continue;
                }

                try {

                    await canal.permissionOverwrites.edit(
                        roleId,
                        {
                            SendMessages: null
                        }
                    );

                } catch (error) {

                    console.error(
                        `No se pudo restaurar el rol ${role.name}:`,
                        error.message
                    );
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔓 CANAL DESBLOQUEADO")
                .setDescription(
                    "El canal vuelve a permitir el envío de mensajes."
                )
                .addFields({
                    name: "🛡️ Desbloqueado por",
                    value: `${interaction.user}`
                })
                .setFooter({
                    text: "Bot creado por DEVLVDARKKIDD"
                })
                .setTimestamp();

            return interaction.editReply({
                embeds: [embed]
            });
        }

    } catch (error) {

        console.error(
            "❌ ERROR DEL COMANDO:",
            error
        );

        const mensaje =
            error.code === 50013
                ? "❌ Discord rechazó la acción por falta de permisos."
                : `❌ Ocurrió un error: \`${error.message || "Error desconocido"}\``;

        try {

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                await interaction.editReply({
                    content: mensaje,
                    embeds: []
                });

            } else {

                await interaction.reply({
                    content: mensaje,
                    ephemeral: true
                });
            }

        } catch (replyError) {

            console.error(
                "❌ No se pudo responder a Discord:",
                replyError
            );
        }
    }
});

// =====================================================
// INICIO
// =====================================================

if (!TOKEN) {
    console.error(
        "❌ Falta DISCORD_TOKEN en las variables de entorno."
    );

    process.exit(1);
}

registrarComandos();

client.login(TOKEN);
