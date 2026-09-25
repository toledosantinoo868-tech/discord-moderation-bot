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

const OWNER_ROLE_ID = "1531489394127536188";

const WELCOME_CHANNEL_ID = "1531493723840450580";

const LOG_CHANNEL_ID = "1544504719047917610";

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
// CLIENTE
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// =====================================================
// ENVIAR LOG
// =====================================================

async function enviarLog(guild, embed) {
    try {
        const canal = await guild.channels.fetch(LOG_CHANNEL_ID);

        if (!canal) {
            console.log(
                `❌ No existe el canal de logs ${LOG_CHANNEL_ID}`
            );
            return;
        }

        if (!canal.isTextBased()) {
            console.log("❌ El canal de logs no es un canal de texto.");
            return;
        }

        await canal.send({
            embeds: [embed]
        });

        console.log("📋 Log enviado correctamente.");

    } catch (error) {
        console.error(
            "❌ ERROR ENVIANDO LOG:",
            error
        );
    }
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
                .setDescription("Ej: 30s, 5m, 1h, 1d")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el mute a un usuario.")
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
        .setDescription("Desbanea a un usuario.")
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
// REGISTRAR COMANDOS
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
// BOT LISTO
// =====================================================

client.once("clientReady", () => {
    console.log(
        `✅ Bot conectado como ${client.user.tag}`
    );

    console.log(
        "🟢 Message Content Intent activado en el código."
    );

    console.log(
        `📋 Canal de logs configurado: ${LOG_CHANNEL_ID}`
    );
});

// =====================================================
// DIAGNÓSTICO DE MENSAJES
// =====================================================

client.on("messageCreate", message => {

    if (!message.guild) return;

    if (message.author?.bot) return;

    console.log(
        `📩 MENSAJE DETECTADO | ${message.author.tag} | #${message.channel.name} | ${message.content}`
    );
});

// =====================================================
// MENSAJE ELIMINADO
// =====================================================

client.on("messageDelete", async message => {

    try {

        if (!message.guild) return;

        if (message.author?.bot) return;

        console.log(
            `🗑️ MENSAJE BORRADO | ${message.author?.tag || "Desconocido"} | #${message.channel?.name || "Desconocido"}`
        );

        let contenido =
            message.content ||
            "Contenido no disponible.";

        if (contenido.length > 1000) {
            contenido =
                contenido.substring(0, 997) + "...";
        }

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🗑️ MENSAJE ELIMINADO")
            .setDescription(
                "Se eliminó un mensaje del servidor."
            )
            .addFields(
                {
                    name: "👤 Usuario",
                    value: message.author
                        ? `${message.author} \`${message.author.tag}\``
                        : "Desconocido"
                },
                {
                    name: "📍 Canal",
                    value: message.channel
                        ? `${message.channel}`
                        : "Desconocido"
                },
                {
                    name: "💬 Mensaje",
                    value: `\`\`\`\n${contenido}\n\`\`\``
                }
            )
            .setTimestamp();

        if (message.author) {
            embed.setThumbnail(
                message.author.displayAvatarURL({
                    extension: "png",
                    size: 256
                })
            );
        }

        await enviarLog(
            message.guild,
            embed
        );

    } catch (error) {

        console.error(
            "❌ ERROR EN MESSAGE DELETE:",
            error
        );
    }
});

// =====================================================
// MENSAJE EDITADO
// =====================================================

client.on("messageUpdate", async (oldMessage, newMessage) => {

    try {

        if (!oldMessage.guild) return;

        if (oldMessage.author?.bot) return;

        if (
            oldMessage.content ===
            newMessage.content
        ) {
            return;
        }

        console.log(
            `✏️ MENSAJE EDITADO | ${oldMessage.author?.tag || "Desconocido"} | #${oldMessage.channel?.name || "Desconocido"}`
        );

        let antes =
            oldMessage.content ||
            "Contenido no disponible.";

        let despues =
            newMessage.content ||
            "Contenido no disponible.";

        if (antes.length > 900) {
            antes =
                antes.substring(0, 897) + "...";
        }

        if (despues.length > 900) {
            despues =
                despues.substring(0, 897) + "...";
        }

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("✏️ MENSAJE EDITADO")
            .addFields(
                {
                    name: "👤 Usuario",
                    value: oldMessage.author
                        ? `${oldMessage.author} \`${oldMessage.author.tag}\``
                        : "Desconocido"
                },
                {
                    name: "📍 Canal",
                    value: oldMessage.channel
                        ? `${oldMessage.channel}`
                        : "Desconocido"
                },
                {
                    name: "🔴 Antes",
                    value:
                        `\`\`\`\n${antes}\n\`\`\``
                },
                {
                    name: "🟢 Después",
                    value:
                        `\`\`\`\n${despues}\n\`\`\``
                }
            )
            .setTimestamp();

        if (oldMessage.author) {
            embed.setThumbnail(
                oldMessage.author.displayAvatarURL({
                    extension: "png",
                    size: 256
                })
            );
        }

        await enviarLog(
            oldMessage.guild,
            embed
        );

    } catch (error) {

        console.error(
            "❌ ERROR EN MESSAGE UPDATE:",
            error
        );
    }
});

// =====================================================
// BIENVENIDA
// =====================================================

client.on("guildMemberAdd", async member => {

    try {

        const canal =
            await member.guild.channels.fetch(
                WELCOME_CHANNEL_ID
            );

        if (!canal || !canal.isTextBased()) {
            console.log(
                "❌ No encontré el canal de bienvenida."
            );
            return;
        }

        const avatar =
            member.displayAvatarURL({
                extension: "png",
                size: 1024
            });

        const embed = new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle("🎉 ¡NUEVO MIEMBRO!")
            .setDescription(
                `💜 **¡Bienvenido/a ${member} a La Orden Morada!**\n\n` +
                `🫶 Esperamos que disfrutes del servidor y la pases genial.`
            )
            .setThumbnail(avatar)
            .setImage(avatar)
            .setFooter({
                text: "La Orden Morada"
            })
            .setTimestamp();

        await canal.send({
            content:
                `🎉 ¡Bienvenido/a ${member}!`,
            embeds: [embed]
        });

        const logEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle("📥 USUARIO ENTRÓ")
            .setThumbnail(avatar)
            .addFields(
                {
                    name: "👤 Usuario",
                    value:
                        `${member.user} \`${member.user.tag}\``
                },
                {
                    name: "🆔 ID",
                    value: member.id
                }
            )
            .setTimestamp();

        await enviarLog(
            member.guild,
            logEmbed
        );

    } catch (error) {

        console.error(
            "❌ ERROR EN BIENVENIDA:",
            error
        );
    }
});

// =====================================================
// USUARIO SALE
// =====================================================

client.on("guildMemberRemove", async member => {

    try {

        const avatar =
            member.user.displayAvatarURL({
                extension: "png",
                size: 1024
            });

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("📤 USUARIO SALIÓ")
            .setThumbnail(avatar)
            .addFields(
                {
                    name: "👤 Usuario",
                    value:
                        `${member.user} \`${member.user.tag}\``
                },
                {
                    name: "🆔 ID",
                    value: member.id
                }
            )
            .setTimestamp();

        await enviarLog(
            member.guild,
            embed
        );

    } catch (error) {

        console.error(
            "❌ ERROR EN SALIDA:",
            error
        );
    }
});

// =====================================================
// INTERACCIONES
// =====================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) {
        return;
    }

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
                        value:
                            "`mc.laordenmorada.lat`"
                    },
                    {
                        name: "🔌 PUERTO",
                        value:
                            "`19527`"
                    }
                )
                .setFooter({
                    text: "La Orden Morada"
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
                interaction.options.getUser(
                    "usuario"
                );

            const miembro =
                await interaction.guild.members.fetch(
                    usuario.id
                );

            await miembro.ban({
                reason:
                    `Ban aplicado por ${interaction.user.tag}`
            });

            await interaction.reply({
                content:
                    `🔨 ${usuario} fue baneado correctamente.`
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
                        name: "🆔 ID",
                        value: usuario.id
                    },
                    {
                        name: "🛡️ Moderador",
                        value:
                            `${interaction.user}`
                    }
                )
                .setTimestamp();

            await enviarLog(
                interaction.guild,
                embed
            );

            return;
        }

        // =================================================
        // /MUTE
        // =================================================

        if (interaction.commandName === "mute") {

            const usuario =
                interaction.options.getUser(
                    "usuario"
                );

            const duracion =
                interaction.options.getString(
                    "duracion"
                );

            const miembro =
                await interaction.guild.members.fetch(
                    usuario.id
                );

            const match =
                duracion.match(
                    /^(\d+)(s|m|h|d)$/i
                );

            if (!match) {

                return interaction.reply({
                    content:
                        "❌ Usa `30s`, `5m`, `1h` o `1d`.",
                    ephemeral: true
                });
            }

            const cantidad =
                Number(match[1]);

            const unidad =
                match[2].toLowerCase();

            const multiplicadores = {
                s: 1000,
                m: 60 * 1000,
                h: 60 * 60 * 1000,
                d: 24 * 60 * 60 * 1000
            };

            const tiempo =
                cantidad *
                multiplicadores[unidad];

            const maximo =
                28 *
                24 *
                60 *
                60 *
                1000;

            if (tiempo > maximo) {

                return interaction.reply({
                    content:
                        "❌ El máximo es de 28 días.",
                    ephemeral: true
                });
            }

            await miembro.timeout(
                tiempo,
                `Mute aplicado por ${interaction.user.tag}`
            );

            await interaction.reply({
                content:
                    `🔇 ${usuario} fue silenciado durante ${duracion}.`
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle("🔇 USUARIO SILENCIADO")
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${usuario}`
                    },
                    {
                        name: "⏱️ Duración",
                        value: duracion
                    },
                    {
                        name: "🛡️ Moderador",
                        value:
                            `${interaction.user}`
                    }
                )
                .setTimestamp();

            await enviarLog(
                interaction.guild,
                embed
            );

            return;
        }

        // =================================================
        // /UNMUTE
        // =================================================

        if (interaction.commandName === "unmute") {

            const usuario =
                interaction.options.getUser(
                    "usuario"
                );

            const miembro =
                await interaction.guild.members.fetch(
                    usuario.id
                );

            await miembro.timeout(
                null,
                `Mute quitado por ${interaction.user.tag}`
            );

            await interaction.reply({
                content:
                    `🔊 ${usuario} ya puede volver a hablar.`
            });

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔊 MUTE QUITADO")
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${usuario}`
                    },
                    {
                        name: "🛡️ Moderador",
                        value:
                            `${interaction.user}`
                    }
                )
                .setTimestamp();

            await enviarLog(
                interaction.guild,
                embed
            );

            return;
        }

        // =================================================
        // /UNBAN
        // =================================================

        if (interaction.commandName === "unban") {

            const id =
                interaction.options.getString(
                    "id"
                );

            await interaction.guild.members.unban(
                id,
                `Unban realizado por ${interaction.user.tag}`
            );

            await interaction.reply({
                content:
                    `🔓 El usuario con ID \`${id}\` fue desbaneado.`
            });

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
                        value:
                            `${interaction.user}`
                    }
                )
                .setTimestamp();

            await enviarLog(
                interaction.guild,
                embed
            );

            return;
        }

        // =================================================
        // /LOCK
        // =================================================

        if (interaction.commandName === "lock") {

            await interaction.deferReply();

            const tienePermiso =
                interaction.guild.ownerId ===
                    interaction.user.id ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            if (!tienePermiso) {

                return interaction.editReply({
                    content:
                        "❌ Tú no tienes permisos para bloquear este canal."
                });
            }

            const canal =
                interaction.channel;

            const bot =
                interaction.guild.members.me;

            if (!bot) {

                return interaction.editReply({
                    content:
                        "❌ No pude encontrar al bot."
                });
            }

            const permisos =
                canal.permissionsFor(bot);

            if (
                !permisos ||
                !permisos.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {

                return interaction.editReply({
                    content:
                        "❌ El bot necesita **Gestionar canales**."
                });
            }

            await canal.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            await canal.permissionOverwrites.edit(
                OWNER_ROLE_ID,
                {
                    SendMessages: true
                }
            );

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔒 CANAL BLOQUEADO")
                .setDescription(
                    "🚫 Nadie puede enviar mensajes.\n" +
                    "👁️ Todos pueden seguir viendo el canal.\n" +
                    "👑 El Owner puede escribir."
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

            const logEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔒 CANAL BLOQUEADO")
                .addFields(
                    {
                        name: "📍 Canal",
                        value: `${canal}`
                    },
                    {
                        name: "🛡️ Moderador",
                        value:
                            `${interaction.user}`
                    }
                )
                .setTimestamp();

            await enviarLog(
                interaction.guild,
                logEmbed
            );

            return;
        }

        // =================================================
        // /UNLOCK
        // =================================================

        if (interaction.commandName === "unlock") {

            await interaction.deferReply();

            const tienePermiso =
                interaction.guild.ownerId ===
                    interaction.user.id ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                );

            if (!tienePermiso) {

                return interaction.editReply({
                    content:
                        "❌ Tú no tienes permisos para desbloquear este canal."
                });
            }

            const canal =
                interaction.channel;

            await canal.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            await canal.permissionOverwrites.edit(
                OWNER_ROLE_ID,
                {
                    SendMessages: null
                }
            );

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔓 CANAL DESBLOQUEADO")
                .setDescription(
                    "El canal volvió a permitir mensajes."
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

            const logEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔓 CANAL DESBLOQUEADO")
                .addFields(
                    {
                        name: "📍 Canal",
                        value: `${canal}`
                    },
                    {
                        name: "🛡️ Moderador",
                        value:
                            `${interaction.user}`
                    }
                )
                .setTimestamp();

            await enviarLog(
                interaction.guild,
                logEmbed
            );

            return;
        }

    } catch (error) {

        console.error(
            "❌ ERROR DEL BOT:",
            error
        );

        try {

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                await interaction.editReply({
                    content:
                        "❌ Ocurrió un error al ejecutar el comando."
                });

            } else {

                await interaction.reply({
                    content:
                        "❌ Ocurrió un error al ejecutar el comando.",
                    ephemeral: true
                });
            }

        } catch (replyError) {

            console.error(
                "❌ ERROR RESPONDIENDO:",
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
        "❌ Falta DISCORD_TOKEN en Render."
    );

    process.exit(1);
}

registrarComandos();

client.login(TOKEN);
