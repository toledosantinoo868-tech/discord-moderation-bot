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
// RENDER
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
// CONFIGURACIÓN
// =====================================================

const CLIENT_ID = "1552817688378605650";
const TOKEN = process.env.DISCORD_TOKEN;

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

    const regex = /(\d+)(y|mo|w|d|h|m|s)/g;

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

    // IP
    new SlashCommandBuilder()
        .setName("ip")
        .setDescription("Muestra la IP del servidor de Minecraft."),

    // BAN
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

    // MUTE
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
                    "Ej: 30s, 5m, 1h, 24h, 7d, 2h30m"
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    // UNMUTE
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

    // UNBAN
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

    // LOCK
    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Bloquea el canal actual.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        ),

    // UNLOCK
    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea el canal actual.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        )

].map(command => command.toJSON());

// =====================================================
// REST
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

// =====================================================
// REGISTRAR COMANDOS
// =====================================================

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
        // /IP
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
                        value: "`mc.laordenmorada.lat`",
                        inline: false
                    },
                    {
                        name: "🔌 PUERTO",
                        value: "`19527`",
                        inline: false
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
        // /MUTE
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

            if (usuario.id === interaction.user.id) {
                return interaction.reply({
                    content:
                        "❌ No puedes silenciarte a ti mismo.",
                    ephemeral: true
                });
            }

            if (usuario.id === interaction.guild.ownerId) {
                return interaction.reply({
                    content:
                        "❌ No puedes silenciar al dueño del servidor.",
                    ephemeral: true
                });
            }

            const duracion =
                convertirDuracion(duracionTexto);

            if (!duracion) {
                return interaction.reply({
                    content:
                        "❌ Duración inválida.\n\n" +
                        "Ejemplos: `30s`, `5m`, `1h`, `24h`, `7d`, `2h30m`.",
                    ephemeral: true
                });
            }

            if (duracion.permanente) {
                return interaction.reply({
                    content:
                        "⚠️ Discord no permite timeouts permanentes. " +
                        "El máximo es de 28 días.",
                    ephemeral: true
                });
            }

            const MAX_TIMEOUT =
                28 * 24 * 60 * 60 * 1000;

            if (duracion.milisegundos > MAX_TIMEOUT) {
                return interaction.reply({
                    content:
                        "❌ El máximo permitido por Discord es de **28 días**.",
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
                        name: "⏱️ Tiempo",
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

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // /UNMUTE
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

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // /BAN
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

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // /UNBAN
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

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // /LOCK
        // =================================================

        if (interaction.commandName === "lock") {

            // Responder inmediatamente a Discord
            await interaction.deferReply();

            const puedeBloquear =
                interaction.guild.ownerId === interaction.user.id ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            if (!puedeBloquear) {

                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("❌ SIN PERMISOS")
                    .setDescription(
                        "No tienes permisos para bloquear este canal."
                    )
                    .setFooter({
                        text: "Bot creado por DEVLVDARKKIDD"
                    })
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            const canal = interaction.channel;

            if (!canal) {
                return interaction.editReply({
                    content:
                        "❌ No se pudo detectar el canal."
                });
            }

            const miembroBot =
                interaction.guild.members.me;

            const permisosBot =
                canal.permissionsFor(miembroBot);

            if (
                !permisosBot ||
                !permisosBot.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {

                return interaction.editReply({
                    content:
                        "❌ El bot no tiene **Gestionar canales** en este canal."
                });
            }

            // Bloquear únicamente a @everyone
            await canal.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔒 CANAL BLOQUEADO")
                .setDescription(
                    "Este canal ha sido bloqueado correctamente."
                )
                .addFields(
                    {
                        name: "🚫 Usuarios",
                        value:
                            "Los usuarios normales no pueden enviar mensajes.",
                        inline: false
                    },
                    {
                        name: "👑 Administración",
                        value:
                            "Los administradores conservan el acceso.",
                        inline: false
                    },
                    {
                        name: "🛡️ Moderador",
                        value: `${interaction.user}`,
                        inline: false
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
        // /UNLOCK
        // =================================================

        if (interaction.commandName === "unlock") {

            // Responder inmediatamente a Discord
            await interaction.deferReply();

            const puedeDesbloquear =
                interaction.guild.ownerId === interaction.user.id ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            if (!puedeDesbloquear) {

                const embed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("❌ SIN PERMISOS")
                    .setDescription(
                        "No tienes permisos para desbloquear este canal."
                    )
                    .setFooter({
                        text: "Bot creado por DEVLVDARKKIDD"
                    })
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            const canal = interaction.channel;

            if (!canal) {
                return interaction.editReply({
                    content:
                        "❌ No se pudo detectar el canal."
                });
            }

            const miembroBot =
                interaction.guild.members.me;

            const permisosBot =
                canal.permissionsFor(miembroBot);

            if (
                !permisosBot ||
                !permisosBot.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {

                return interaction.editReply({
                    content:
                        "❌ El bot no tiene **Gestionar canales** en este canal."
                });
            }

            // Quitar el bloqueo de @everyone
            await canal.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔓 CANAL DESBLOQUEADO")
                .setDescription(
                    "Este canal vuelve a estar disponible para todos."
                )
                .addFields({
                    name: "🛡️ Moderador",
                    value: `${interaction.user}`,
                    inline: false
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
                ? "❌ Discord rechazó la acción por falta de permisos. Revisá que el bot tenga **Gestionar canales** en este canal."
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
// TOKEN
// =====================================================

if (!TOKEN) {

    console.error(
        "❌ Falta DISCORD_TOKEN en las variables de entorno."
    );

    process.exit(1);
}

// =====================================================
// INICIAR
// =====================================================

registrarComandos();

client.login(TOKEN);
