require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ChannelType
} = require("discord.js");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;

const CLIENT_ID = "1552817688378605650";

// =====================================================
// ROLES
// =====================================================

const OWNER_ROLE_ID = "1553559027697320026";
const EVERYONE_ROLE_ID = "1553559599963963442";
const VERIFIED_ROLE_ID = "1553558969924984862";

// =====================================================
// CONFIGURACIÓN DEL BOT
// =====================================================

const BOT_COLOR = 0x3498DB;

const FOOTER = "Bot creado por DEVLVdarkkidd";

// =====================================================
// DATOS DEL SERVIDOR
// =====================================================

const MINECRAFT_IP = "mc.eternalcraft.fun";
const MINECRAFT_PORT = "10096";

// =====================================================
// BIENVENIDA
// =====================================================

let welcomeChannelId = null;

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
// FUNCIONES
// =====================================================

function esOwner(interaction) {
    if (!interaction.guild) return false;

    return (
        interaction.guild.ownerId === interaction.user.id ||
        interaction.member.roles.cache.has(OWNER_ROLE_ID)
    );
}

function esStaff(interaction) {
    if (!interaction.guild) return false;

    return (
        esOwner(interaction) ||
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        ) ||
        interaction.member.permissions.has(
            PermissionFlagsBits.ManageMessages
        )
    );
}

function puedeModerar(interaction, miembro) {
    if (!interaction.guild || !miembro) {
        return false;
    }

    if (interaction.guild.ownerId === interaction.user.id) {
        return true;
    }

    if (miembro.id === interaction.guild.ownerId) {
        return false;
    }

    if (miembro.id === interaction.user.id) {
        return false;
    }

    const ejecutor = interaction.member;

    if (!ejecutor) {
        return false;
    }

    return (
        miembro.roles.highest.position <
        ejecutor.roles.highest.position
    );
}

function convertirDuracion(entrada) {
    if (!entrada) return null;

    const match = entrada
        .trim()
        .match(/^(\d+)\s*(s|m|h|d)$/i);

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

// =====================================================
// LOGS
// =====================================================

async function enviarLog(guild, embed) {
    try {
        // Busca un canal llamado logs
        const canal = guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildText &&
                channel.name.toLowerCase() === "logs"
        );

        if (!canal) return;

        await canal.send({
            embeds: [embed]
        });

    } catch (error) {
        console.error(
            "Error enviando log:",
            error.message
        );
    }
}

// =====================================================
// PANEL DE VERIFICACIÓN
// =====================================================

function crearPanelVerificacion() {

    const embed = new EmbedBuilder()
        .setColor(BOT_COLOR)
        .setTitle("🔵 ETERNAL CRAFT NETWORK")
        .setDescription(
            "¡Bienvenido/a a **Eternal Craft Network**! 💙\n\n" +
            "Para poder hablar y participar en el servidor, " +
            "primero tenés que verificarte.\n\n" +
            "Presioná el botón **✅ Verificarse** de abajo.\n\n" +
            "🔐 Una vez verificado/a recibirás automáticamente " +
            "el rol correspondiente.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🟢 **Presioná el botón para verificarse.**"
        )
        .setFooter({
            text: FOOTER
        })
        .setTimestamp();

    const boton = new ButtonBuilder()
        .setCustomId("eternal_verificar")
        .setLabel("Verificarse")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

    const fila = new ActionRowBuilder()
        .addComponents(boton);

    return {
        embeds: [embed],
        components: [fila]
    };
}

// =====================================================
// COMANDOS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("ip")
        .setDescription(
            "Muestra la IP del servidor de Minecraft."
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription(
            "Elimina mensajes del canal."
        )
        .addIntegerOption(option =>
            option
                .setName("cantidad")
                .setDescription(
                    "Cantidad de mensajes a eliminar."
                )
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription(
            "Silencia temporalmente a un usuario."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription(
                    "Usuario que quieres silenciar."
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duracion")
                .setDescription(
                    "Ejemplo: 30s, 5m, 1h, 1d."
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription(
            "Quita el silencio a un usuario."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription(
                    "Usuario."
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription(
            "Banea a un usuario."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription(
                    "Usuario que quieres banear."
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription(
            "Desbanea a un usuario."
        )
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription(
                    "ID del usuario."
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription(
            "Bloquea canales."
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("canal")
                .setDescription(
                    "Bloquea este canal."
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("general")
                .setDescription(
                    "Bloquea todos los canales."
                )
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription(
            "Desbloquea canales."
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("canal")
                .setDescription(
                    "Desbloquea este canal."
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("general")
                .setDescription(
                    "Desbloquea todos los canales."
                )
        ),

    new SlashCommandBuilder()
        .setName("verificacion")
        .setDescription(
            "Configura el panel de verificación."
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("aqui")
                .setDescription(
                    "Envía el panel de verificación aquí."
                )
        ),

    new SlashCommandBuilder()
        .setName("bienvenidas")
        .setDescription(
            "Configura este canal como canal de bienvenidas."
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("aqui")
                .setDescription(
                    "Configura este canal para las bienvenidas."
                )
        )

].map(command => command.toJSON());

// =====================================================
// REGISTRO DE COMANDOS
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

async function registrarComandos() {

    try {

        console.log(
            "🔄 Registrando comandos..."
        );

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log(
            `✅ ${commands.length} comandos registrados.`
        );

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

client.once(
    "clientReady",
    async () => {

        console.log(
            "================================"
        );

        console.log(
            `✅ Bot conectado como ${client.user.tag}`
        );

        console.log(
            "🔵 Eternal Craft Network"
        );

        console.log(
            "================================"
        );

    }
);

// =====================================================
// NUEVO MIEMBRO
// =====================================================

client.on(
    "guildMemberAdd",
    async member => {

        try {

            if (!welcomeChannelId) {
                return;
            }

            const canal =
                await member.guild.channels.fetch(
                    welcomeChannelId
                );

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return;
            }

            const avatar =
                member.displayAvatarURL({
                    extension: "png",
                    size: 512
                });

            const embed =
                new EmbedBuilder()
                    .setColor(BOT_COLOR)
                    .setTitle(
                        "💙 ETERNAL CRAFT NETWORK"
                    )
                    .setDescription(
                        `🎉 **¡Bienvenido/a a Eternal Craft Network, ${member}!**\n\n` +
                        "💙 Esperamos que disfrutes de la comunidad.\n\n" +
                        "🔐 Recordá verificarte para poder participar "
                        + "en el servidor."
                    )
                    .setThumbnail(avatar)
                    .setFooter({
                        text: FOOTER
                    })
                    .setTimestamp();

            await canal.send({
                content:
                    `👋 ¡Bienvenido/a ${member}!`,
                embeds: [embed]
            });

        } catch (error) {

            console.error(
                "❌ Error en bienvenida:",
                error
            );
        }
    }
);

// =====================================================
// INTERACCIONES
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            // =========================================
            // BOTÓN VERIFICACIÓN
            // =========================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                "eternal_verificar"
            ) {

                const miembro =
                    interaction.member;

                const rol =
                    await interaction.guild.roles.fetch(
                        VERIFIED_ROLE_ID
                    );

                if (!rol) {

                    return interaction.reply({
                        content:
                            "❌ No encontré el rol de verificado.",
                        ephemeral: true
                    });
                }

                if (
                    miembro.roles.cache.has(
                        VERIFIED_ROLE_ID
                    )
                ) {

                    return interaction.reply({
                        content:
                            "✅ Ya estás verificado/a.",
                        ephemeral: true
                    });
                }

                const bot =
                    interaction.guild.members.me;

                if (
                    !bot ||
                    rol.position >=
                    bot.roles.highest.position
                ) {

                    return interaction.reply({
                        content:
                            "❌ El rol del bot debe estar por encima del rol Verificado.",
                        ephemeral: true
                    });
                }

                await miembro.roles.add(
                    rol,
                    "Verificación de Eternal Craft Network"
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle(
                            "✅ VERIFICACIÓN COMPLETADA"
                        )
                        .setDescription(
                            `¡Listo ${interaction.user}! 💙\n\n` +
                            `Recibiste el rol ${rol} y ya podés participar en **Eternal Craft Network**.`
                        )
                        .setFooter({
                            text: FOOTER
                        })
                        .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            // =========================================
            // SOLO SLASH COMMANDS
            // =========================================

            if (
                !interaction.isChatInputCommand()
            ) {
                return;
            }

            // =========================================
            // /IP
            // =========================================

            if (
                interaction.commandName === "ip"
            ) {

                const embed =
                    new EmbedBuilder()
                        .setColor(BOT_COLOR)
                        .setTitle(
                            "🎮 ETERNAL CRAFT NETWORK"
                        )
                        .setDescription(
                            "Conectate a nuestro servidor de Minecraft:"
                        )
                        .addFields(
                            {
                                name: "🌐 IP",
                                value:
                                    `\`${MINECRAFT_IP}\``,
                                inline: true
                            },
                            {
                                name: "🔌 Puerto",
                                value:
                                    `\`${MINECRAFT_PORT}\``,
                                inline: true
                            }
                        )
                        .setFooter({
                            text: FOOTER
                        })
                        .setTimestamp();

                return interaction.reply({
                    embeds: [embed]
                });
            }

            // =========================================
            // /VERIFICACION AQUI
            // =========================================

            if (
                interaction.commandName ===
                "verificacion"
            ) {

                if (!esOwner(interaction)) {

                    return interaction.reply({
                        content:
                            "❌ Solo el Owner puede utilizar este comando.",
                        ephemeral: true
                    });
                }

                const subcomando =
                    interaction.options.getSubcommand();

                if (
                    subcomando === "aqui"
                ) {

                    await interaction.channel.send(
                        crearPanelVerificacion()
                    );

                    return interaction.reply({
                        content:
                            "✅ Panel de verificación enviado correctamente.",
                        ephemeral: true
                    });
                }
            }

            // =========================================
            // /BIENVENIDAS AQUI
            // =========================================

            if (
                interaction.commandName ===
                "bienvenidas"
            ) {

                if (!esOwner(interaction)) {

                    return interaction.reply({
                        content:
                            "❌ Solo el Owner puede utilizar este comando.",
                        ephemeral: true
                    });
                }

                welcomeChannelId =
                    interaction.channel.id;

                return interaction.reply({
                    content:
                        `✅ Este canal quedó configurado permanentemente como canal de bienvenidas.\n\n` +
                        `📍 Canal: ${interaction.channel}`,
                    ephemeral: true
                });
            }

            // =========================================
            // COMANDOS STAFF
            // =========================================

            const comandosStaff = [
                "clear",
                "mute",
                "unmute",
                "ban",
                "unban",
                "lock",
                "unlock"
            ];

            if (
                comandosStaff.includes(
                    interaction.commandName
                )
            ) {

                if (!esStaff(interaction)) {

                    return interaction.reply({
                        content:
                            "❌ No tenés permisos para utilizar este comando.",
                        ephemeral: true
                    });
                }
            }

            // =========================================
            // /CLEAR
            // =========================================

            if (
                interaction.commandName ===
                "clear"
            ) {

                const cantidad =
                    interaction.options.getInteger(
                        "cantidad"
                    );

                if (
                    !interaction.channel ||
                    !interaction.channel.isTextBased()
                ) {

                    return interaction.reply({
                        content:
                            "❌ Este comando no puede utilizarse aquí.",
                        ephemeral: true
                    });
                }

                await interaction.deferReply({
                    ephemeral: true
                });

                const mensajes =
                    await interaction.channel.bulkDelete(
                        cantidad,
                        true
                    );

                const embed =
                    new EmbedBuilder()
                        .setColor(BOT_COLOR)
                        .setTitle(
                            "🧹 MENSAJES ELIMINADOS"
                        )
                        .addFields(
                            {
                                name: "📊 Cantidad",
                                value:
                                    `${mensajes.size}`,
                                inline: true
                            },
                            {
                                name: "👮 Moderador",
                                value:
                                    `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "📍 Canal",
                                value:
                                    `${interaction.channel}`,
                                inline: true
                            }
                        )
                        .setFooter({
                            text: FOOTER
                        })
                        .setTimestamp();

                await interaction.editReply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            // =========================================
            // /MUTE
            // =========================================

            if (
                interaction.commandName ===
                "mute"
            ) {

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

                if (
                    !puedeModerar(
                        interaction,
                        miembro
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ No podés moderar a este usuario por su jerarquía.",
                        ephemeral: true
                    });
                }

                const tiempo =
                    convertirDuracion(
                        duracion
                    );

                if (!tiempo) {

                    return interaction.reply({
                        content:
                            "❌ Usa formatos como `30s`, `5m`, `1h` o `1d`.",
                        ephemeral: true
                    });
                }

                const maximo =
                    28 *
                    24 *
                    60 *
                    60 *
                    1000;

                if (
                    tiempo <= 0 ||
                    tiempo > maximo
                ) {

                    return interaction.reply({
                        content:
                            "❌ El máximo permitido es 28 días.",
                        ephemeral: true
                    });
                }

                await miembro.timeout(
                    tiempo,
                    `Mute por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(BOT_COLOR)
                        .setTitle(
                            "🔇 USUARIO SILENCIADO"
                        )
                        .setDescription(
                            `${usuario} fue silenciado correctamente.`
                        )
                        .addFields(
                            {
                                name: "⏱️ Duración",
                                value:
                                    duracion
                            },
                            {
                                name: "👮 Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
                        .setFooter({
                            text: FOOTER
                        })
                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            // =========================================
            // /UNMUTE
            // =========================================

            if (
                interaction.commandName ===
                "unmute"
            ) {

                const usuario =
                    interaction.options.getUser(
                        "usuario"
                    );

                const miembro =
                    await interaction.guild.members.fetch(
                        usuario.id
                    );

                if (
                    !puedeModerar(
                        interaction,
                        miembro
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ No podés modificar a este usuario.",
                        ephemeral: true
                    });
                }

                await miembro.timeout(
                    null,
                    `Unmute por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle(
                            "🔊 MUTE REMOVIDO"
                        )
                        .setDescription(
                            `${usuario} ya puede volver a hablar.`
                        )
                        .setFooter({
                            text: FOOTER
                        })
                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            // =========================================
            // /BAN
            // =========================================

            if (
                interaction.commandName ===
                "ban"
            ) {

                const usuario =
                    interaction.options.getUser(
                        "usuario"
                    );

                const miembro =
                    await interaction.guild.members.fetch(
                        usuario.id
                    );

                if (
                    !puedeModerar(
                        interaction,
                        miembro
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ No podés banear a este usuario.",
                        ephemeral: true
                    });
                }

                await miembro.ban({
                    reason:
                        `Ban por ${interaction.user.tag}`
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle(
                            "🔨 USUARIO BANEADO"
                        )
                        .setDescription(
                            `${usuario} fue baneado del servidor.`
                        )
                        .addFields({
                            name: "👮 Moderador",
                            value:
                                `${interaction.user}`
                        })
                        .setFooter({
                            text: FOOTER
                        })
                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            // =========================================
            // /UNBAN
            // =========================================

            if (
                interaction.commandName ===
                "unban"
            ) {

                const id =
                    interaction.options
                        .getString("id")
                        .trim();

                if (!/^\d{17,20}$/.test(id)) {

                    return interaction.reply({
                        content:
                            "❌ La ID no es válida.",
                        ephemeral: true
                    });
                }

                await interaction.guild.members.unban(
                    id,
                    `Unban por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle(
                            "🔓 USUARIO DESBANEADO"
                        )
                        .setDescription(
                            `El usuario con ID \`${id}\` fue desbaneado.`
                        )
                        .setFooter({
                            text: FOOTER
                        })
                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            // =========================================
            // /LOCK
            // =========================================

            if (
                interaction.commandName ===
                "lock"
            ) {

                const subcomando =
                    interaction.options.getSubcommand();

                await interaction.deferReply();

                if (
                    subcomando === "canal"
                ) {

                    const canal =
                        interaction.channel;

                    await canal.permissionOverwrites.edit(
                        interaction.guild.roles.everyone,
                        {
                            SendMessages: false
                        },
                        {
                            reason:
                                `Lock por ${interaction.user.tag}`
                        }
                    );

                    const embed =
                        new EmbedBuilder()
                            .setColor(0xE74C3C)
                            .setTitle(
                                "🔒 CANAL BLOQUEADO"
                            )
                            .setDescription(
                                "Los usuarios ya no pueden enviar mensajes en este canal."
                            )
                            .setFooter({
                                text: FOOTER
                            })
                            .setTimestamp();

                    await interaction.editReply({
                        embeds: [embed]
                    });

                    await enviarLog(
                        interaction.guild,
                        embed
                    );

                    return;
                }

                if (
                    subcomando === "general"
                ) {

                    const canales =
                        await interaction.guild.channels.fetch();

                    let cantidad = 0;

                    for (
                        const [, canal]
                        of canales
                    ) {

                        if (
                            !canal ||
                            ![
                                ChannelType.GuildText,
                                ChannelType.GuildAnnouncement
                            ].includes(canal.type)
                        ) {
                            continue;
                        }

                        try {

                            await canal.permissionOverwrites.edit(
                                interaction.guild.roles.everyone,
                                {
                                    SendMessages: false
                                },
                                {
                                    reason:
                                        `Lock general por ${interaction.user.tag}`
                                }
                            );

                            cantidad++;

                        } catch {}
                    }

                    const embed =
                        new EmbedBuilder()
                            .setColor(0xE74C3C)
                            .setTitle(
                                "🔒 SERVIDOR BLOQUEADO"
                            )
                            .setDescription(
                                `Se bloquearon **${cantidad} canales**.`
                            )
                            .setFooter({
                                text: FOOTER
                            })
                            .setTimestamp();

                    await interaction.editReply({
                        embeds: [embed]
                    });

                    await enviarLog(
                        interaction.guild,
                        embed
                    );

                    return;
                }
            }

            // =========================================
            // /UNLOCK
            // =========================================

            if (
                interaction.commandName ===
                "unlock"
            ) {

                const subcomando =
                    interaction.options.getSubcommand();

                await interaction.deferReply();

                if (
                    subcomando === "canal"
                ) {

                    const canal =
                        interaction.channel;

                    await canal.permissionOverwrites.edit(
                        interaction.guild.roles.everyone,
                        {
                            SendMessages: null
                        },
                        {
                            reason:
                                `Unlock por ${interaction.user.tag}`
                        }
                    );

                    const embed =
                        new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setTitle(
                                "🔓 CANAL DESBLOQUEADO"
                            )
                            .setDescription(
                                "El canal volvió a utilizar sus permisos normales."
                            )
                            .setFooter({
                                text: FOOTER
                            })
                            .setTimestamp();

                    await interaction.editReply({
                        embeds: [embed]
                    });

                    await enviarLog(
                        interaction.guild,
                        embed
                    );

                    return;
                }

                if (
                    subcomando === "general"
                ) {

                    const canales =
                        await interaction.guild.channels.fetch();

                    let cantidad = 0;

                    for (
                        const [, canal]
                        of canales
                    ) {

                        if (
                            !canal ||
                            ![
                                ChannelType.GuildText,
                                ChannelType.GuildAnnouncement
                            ].includes(canal.type)
                        ) {
                            continue;
                        }

                        try {

                            await canal.permissionOverwrites.edit(
                                interaction.guild.roles.everyone,
                                {
                                    SendMessages: null
                                },
                                {
                                    reason:
                                        `Unlock general por ${interaction.user.tag}`
                                }
                            );

                            cantidad++;

                        } catch {}
                    }

                    const embed =
                        new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setTitle(
                                "🔓 SERVIDOR DESBLOQUEADO"
                            )
                            .setDescription(
                                `Se desbloquearon **${cantidad} canales**.`
                            )
                            .setFooter({
                                text: FOOTER
                            })
                            .setTimestamp();

                    await interaction.editReply({
                        embeds: [embed]
                    });

                    await enviarLog(
                        interaction.guild,
                        embed
                    );

                    return;
                }
            }

        } catch (error) {

            console.error(
                "❌ ERROR:",
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

            } catch {}
        }
    }
);

// =====================================================
// ERRORES
// =====================================================

client.on(
    "error",
    error => {
        console.error(
            "❌ Error Discord:",
            error
        );
    }
);

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "❌ Unhandled Rejection:",
            error
        );
    }
);

// =====================================================
// COMPROBAR TOKEN
// =====================================================

if (!TOKEN) {

    console.error(
        "❌ Falta DISCORD_TOKEN en el archivo .env"
    );

    process.exit(1);
}

// =====================================================
// INICIAR
// =====================================================

(async () => {

    try {

        await registrarComandos();

        await client.login(TOKEN);

    } catch (error) {

        console.error(
            "❌ No se pudo iniciar el bot:"
        );

        console.error(error);

        process.exit(1);
    }

})();
