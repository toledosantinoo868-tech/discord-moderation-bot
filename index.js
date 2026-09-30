require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1552817688378605650";

// SOLO ESTA CUENTA PUEDE USAR LOS COMANDOS
const OWNER_USER_ID = "1531489394127536188";

// CANALES
const CHANNELS = {
    VERIFICACION: "1544523269376450590",
    LOGS: "1544504719047917610",
    BIENVENIDAS: "1531493723840450580",
    TICKETS: "1533646002878283936"
};

// ROL DE VERIFICADO
const VERIFIED_ROLE_ID = "1544521207708131409";

// SERVIDOR MINECRAFT
const SERVER_IP = "mc.laordenmorada.lat";
const SERVER_PORT = "19527";

// DISEÑO
const BOT_COLOR = 0x8E44AD;
const SUCCESS_COLOR = 0x2ECC71;
const ERROR_COLOR = 0xE74C3C;
const WARNING_COLOR = 0xF1C40F;
const INFO_COLOR = 0x3498DB;

const FOOTER = "La Orden Morada";

// =====================================================
// MAPAS DE PROTECCIÓN
// =====================================================

const spamMap = new Map();
const raidMap = new Map();
const warnMap = new Map();
const antiLinkCooldown = new Map();

let raidLockdown = false;

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
// FUNCIONES GENERALES
// =====================================================

function embedBase(color = BOT_COLOR) {
    return new EmbedBuilder()
        .setColor(color)
        .setFooter({ text: FOOTER })
        .setTimestamp();
}

function esOwner(interaction) {
    return interaction.user.id === OWNER_USER_ID;
}

function esAdmin(member) {
    return member?.permissions?.has(PermissionFlagsBits.Administrator);
}

function puedeModerar(interaction, miembro) {
    if (!interaction.guild || !miembro) return false;

    if (interaction.user.id === interaction.guild.ownerId) {
        return true;
    }

    if (miembro.id === interaction.guild.ownerId) {
        return false;
    }

    if (miembro.id === interaction.user.id) {
        return false;
    }

    const ejecutor = interaction.member;

    if (!ejecutor) return false;

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

async function enviarLog(guild, embed) {
    try {
        const canal = guild.channels.cache.get(CHANNELS.LOGS);

        if (!canal || !canal.isTextBased()) return;

        await canal.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error("Error enviando log:", error.message);
    }
}

async function enviarEmbed(canal, embed, components = []) {
    if (!canal || !canal.isTextBased()) return;

    await canal.send({
        embeds: [embed],
        components
    });
}

// =====================================================
// COMANDOS
// =====================================================

const commands = [

    // CLEAR
    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes del canal.")
        .addIntegerOption(opt =>
            opt
                .setName("cantidad")
                .setDescription("Cantidad de mensajes")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    // MUTE
    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Silencia temporalmente a un usuario.")
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("duracion")
                .setDescription("Ejemplo: 30s, 5m, 1h, 1d")
                .setRequired(true)
        ),

    // UNMUTE
    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el timeout.")
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        ),

    // BAN
    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("motivo")
                .setDescription("Motivo del baneo")
                .setRequired(false)
        ),

    // UNBAN
    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario.")
        .addStringOption(opt =>
            opt
                .setName("id")
                .setDescription("ID del usuario")
                .setRequired(true)
        ),

    // KICK
    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Expulsa a un usuario.")
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("motivo")
                .setDescription("Motivo")
                .setRequired(false)
        ),

    // WARN
    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Advierte a un usuario.")
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("motivo")
                .setDescription("Motivo")
                .setRequired(true)
        ),

    // LOCK
    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Bloquea canales.")
        .addSubcommand(sub =>
            sub
                .setName("canal")
                .setDescription("Bloquea este canal")
        )
        .addSubcommand(sub =>
            sub
                .setName("general")
                .setDescription("Bloquea todos los canales")
        ),

    // UNLOCK
    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea canales.")
        .addSubcommand(sub =>
            sub
                .setName("canal")
                .setDescription("Desbloquea este canal")
        )
        .addSubcommand(sub =>
            sub
                .setName("general")
                .setDescription("Desbloquea todos los canales")
        ),

    // CREATE MSJ
    new SlashCommandBuilder()
        .setName("create_msj")
        .setDescription("Crea un mensaje embed.")
        .addStringOption(opt =>
            opt
                .setName("titulo")
                .setDescription("Título")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("contenido")
                .setDescription("Contenido")
                .setRequired(true)
        )
        .addChannelOption(opt =>
            opt
                .setName("canal")
                .setDescription("Canal de destino")
                .setRequired(false)
        ),

    // IP
    new SlashCommandBuilder()
        .setName("ip")
        .setDescription("Muestra la IP del servidor.")
];

// =====================================================
// REGISTRO DE COMANDOS
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("🔄 Registrando comandos...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log("✅ Comandos registrados.");
    } catch (error) {
        console.error("❌ Error registrando comandos:", error);
    }
}

// =====================================================
// READY
// =====================================================

client.once("ready", async () => {

    console.log("====================================");
    console.log(`🟣 ${client.user.tag}`);
    console.log("🟣 LA ORDEN MORADA");
    console.log("====================================");

    await registrarComandos();

    // ---------------------------------------------
    // PANEL DE VERIFICACIÓN
    // ---------------------------------------------

    const canalVerificacion =
        client.channels.cache.get(CHANNELS.VERIFICACION);

    if (canalVerificacion?.isTextBased()) {

        const embed = embedBase(BOT_COLOR)
            .setTitle("🛡️ VERIFICACIÓN")
            .setDescription(
                "## 🟣 LA ORDEN MORADA\n\n" +
                "Para acceder al servidor debes verificarte.\n\n" +
                "Pulsa el botón **✅ VERIFICARME** para obtener tu acceso.\n\n" +
                "Una vez verificado recibirás automáticamente el rol correspondiente."
            )
            .setThumbnail(client.user.displayAvatarURL())
            .setImage(
                "https://cdn.discordapp.com/embed/avatars/0.png"
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verificar_usuario")
                    .setLabel("VERIFICARME")
                    .setEmoji("✅")
                    .setStyle(ButtonStyle.Success)
            );

        // No se borra automáticamente el contenido existente.
        // Se publica el panel al iniciar.
        await canalVerificacion.send({
            embeds: [embed],
            components: [row]
        }).catch(() => {});
    }

    // ---------------------------------------------
    // PANEL DE TICKETS
    // ---------------------------------------------

    const canalTickets =
        client.channels.cache.get(CHANNELS.TICKETS);

    if (canalTickets?.isTextBased()) {

        const embedTicket = embedBase(BOT_COLOR)
            .setTitle("🎫 SOPORTE — LA ORDEN MORADA")
            .setDescription(
                "## 🎫 ¿NECESITAS AYUDA?\n\n" +
                "Si necesitas contactar con el Staff, abre un ticket.\n\n" +
                "Un canal privado será creado automáticamente para vos.\n\n" +
                "🟣 Utiliza el botón de abajo."
            )
            .setThumbnail(client.user.displayAvatarURL());

        const rowTicket = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("crear_ticket")
                    .setLabel("CREAR TICKET")
                    .setEmoji("🎫")
                    .setStyle(ButtonStyle.Primary)
            );

        await canalTickets.send({
            embeds: [embedTicket],
            components: [rowTicket]
        }).catch(() => {});
    }
});

// =====================================================
// BIENVENIDAS
// =====================================================

client.on("guildMemberAdd", async member => {

    try {

        // ---------------------------------------------
        // LOG
        // ---------------------------------------------

        const logEmbed = embedBase(SUCCESS_COLOR)
            .setTitle("📥 NUEVO MIEMBRO")
            .setDescription(
                `${member} se unió a **${member.guild.name}**.`
            )
            .addFields(
                {
                    name: "👤 Usuario",
                    value: `${member.user.tag}`,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: member.id,
                    inline: true
                },
                {
                    name: "👥 Miembros",
                    value: `${member.guild.memberCount}`,
                    inline: true
                }
            )
            .setThumbnail(member.user.displayAvatarURL({
                size: 512
            }));

        await enviarLog(member.guild, logEmbed);

        // ---------------------------------------------
        // BIENVENIDA
        // ---------------------------------------------

        const canal =
            member.guild.channels.cache.get(CHANNELS.BIENVENIDAS);

        if (!canal?.isTextBased()) return;

        const embed = embedBase(BOT_COLOR)
            .setTitle("🟣 BIENVENIDO A LA ORDEN MORADA")
            .setDescription(
                `## 👋 ¡Bienvenido ${member}!\n\n` +
                `Nos alegra tenerte en **La Orden Morada**.\n\n` +
                `🎉 Sos nuestro miembro **#${member.guild.memberCount}**.\n\n` +
                `🛡️ No olvides pasar por el canal de verificación.`
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size: 512,
                    extension: "png"
                })
            )
            .setImage(
                member.user.displayAvatarURL({
                    size: 1024,
                    extension: "png"
                })
            );

        await canal.send({
            content: `${member}`,
            embeds: [embed]
        });

    } catch (error) {
        console.error("Error en bienvenida:", error);
    }

    // =================================================
    // ANTI-RAID
    // =================================================

    const guildId = member.guild.id;

    if (!raidMap.has(guildId)) {
        raidMap.set(guildId, []);
    }

    const ahora = Date.now();

    const entradas = raidMap
        .get(guildId)
        .filter(timestamp => ahora - timestamp < 10000);

    entradas.push(ahora);

    raidMap.set(guildId, entradas);

    // 5 usuarios en 10 segundos
    if (entradas.length >= 5 && !raidLockdown) {

        raidLockdown = true;

        const raidEmbed = embedBase(ERROR_COLOR)
            .setTitle("🚨 ANTI-RAID ACTIVADO")
            .setDescription(
                "Se detectó una cantidad elevada de entradas al servidor en poco tiempo."
            )
            .addFields({
                name: "👥 Entradas detectadas",
                value: `${entradas.length} usuarios / 10 segundos`
            });

        await enviarLog(member.guild, raidEmbed);

        // Se mantiene activo durante 60 segundos
        setTimeout(() => {
            raidLockdown = false;
            raidMap.set(guildId, []);
        }, 60000);
    }
});

// =====================================================
// DESPEDIDAS
// =====================================================

client.on("guildMemberRemove", async member => {

    const embed = embedBase(ERROR_COLOR)
        .setTitle("📤 MIEMBRO SALIÓ")
        .setDescription(
            `${member.user} salió del servidor.`
        )
        .addFields({
            name: "👤 Usuario",
            value: member.user.tag
        })
        .setThumbnail(
            member.user.displayAvatarURL({
                size: 512
            })
        );

    await enviarLog(member.guild, embed);
});

// =====================================================
// ANTI-SPAM + ANTI-LINKS
// =====================================================

client.on("messageCreate", async message => {

    if (!message.guild || message.author.bot) return;

    const member = message.member;

    if (!member) return;

    // El Owner y administradores no son afectados
    if (
        message.author.id === OWNER_USER_ID ||
        member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
        return;
    }

    // =================================================
    // ANTI-LINKS
    // =================================================

    const linkRegex =
        /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

    if (linkRegex.test(message.content)) {

        try {

            await message.delete().catch(() => {});

            const ahora = Date.now();

            const key = `${message.guild.id}:${message.author.id}`;

            const ultimoAviso = antiLinkCooldown.get(key) || 0;

            if (ahora - ultimoAviso > 5000) {

                antiLinkCooldown.set(key, ahora);

                const aviso = await message.channel.send({
                    embeds: [
                        embedBase(WARNING_COLOR)
                            .setTitle("🔗 ENLACE BLOQUEADO")
                            .setDescription(
                                `${message.author}, los enlaces no están permitidos en este servidor.`
                            )
                    ]
                }).catch(() => null);

                if (aviso) {
                    setTimeout(() => {
                        aviso.delete().catch(() => {});
                    }, 4000);
                }
            }

            await enviarLog(
                message.guild,
                embedBase(WARNING_COLOR)
                    .setTitle("🔗 ANTI-LINKS")
                    .setDescription(
                        `Se eliminó un enlace enviado por ${message.author}.`
                    )
                    .addFields({
                        name: "📍 Canal",
                        value: `${message.channel}`
                    })
            );

        } catch (error) {
            console.error("Anti-links:", error);
        }

        return;
    }

    // =================================================
    // ANTI-SPAM
    // =================================================

    const key = `${message.guild.id}:${message.author.id}`;

    if (!spamMap.has(key)) {
        spamMap.set(key, []);
    }

    const ahora = Date.now();

    let timestamps = spamMap.get(key);

    timestamps = timestamps.filter(
        timestamp => ahora - timestamp < 3000
    );

    timestamps.push(ahora);

    spamMap.set(key, timestamps);

    // 6 mensajes en 3 segundos
    if (timestamps.length >= 6) {

        spamMap.set(key, []);

        await message.delete().catch(() => {});

        const aviso = await message.channel.send({
            embeds: [
                embedBase(WARNING_COLOR)
                    .setTitle("⚠️ ANTI-SPAM")
                    .setDescription(
                        `${message.author}, estás enviando mensajes demasiado rápido.`
                    )
            ]
        }).catch(() => null);

        if (aviso) {
            setTimeout(() => {
                aviso.delete().catch(() => {});
            }, 4000);
        }

        try {

            await member.timeout(
                30 * 1000,
                "Anti-Spam automático"
            );

            await enviarLog(
                message.guild,
                embedBase(ERROR_COLOR)
                    .setTitle("🚨 ANTI-SPAM ACTIVADO")
                    .setDescription(
                        `${message.author} recibió un timeout automático.`
                    )
                    .addFields(
                        {
                            name: "⏱️ Duración",
                            value: "30 segundos",
                            inline: true
                        },
                        {
                            name: "📍 Canal",
                            value: `${message.channel}`,
                            inline: true
                        }
                    )
            );

        } catch (error) {
            console.error("Error Anti-Spam:", error);
        }
    }
});

// =====================================================
// INTERACCIONES
// =====================================================

client.on("interactionCreate", async interaction => {

    try {

        // =================================================
        // BOTONES
        // =================================================

        if (interaction.isButton()) {

            // ---------------------------------------------
            // VERIFICACIÓN
            // ---------------------------------------------

            if (interaction.customId === "verificar_usuario") {

                const rol =
                    interaction.guild.roles.cache.get(
                        VERIFIED_ROLE_ID
                    );

                if (!rol) {
                    return interaction.reply({
                        content: "❌ No se encontró el rol de verificado.",
                        ephemeral: true
                    });
                }

                if (
                    interaction.member.roles.cache.has(
                        VERIFIED_ROLE_ID
                    )
                ) {
                    return interaction.reply({
                        content: "✅ Ya estás verificado.",
                        ephemeral: true
                    });
                }

                try {

                    await interaction.member.roles.add(
                        VERIFIED_ROLE_ID,
                        "Verificación mediante botón"
                    );

                    const embed = embedBase(SUCCESS_COLOR)
                        .setTitle("✅ VERIFICACIÓN COMPLETADA")
                        .setDescription(
                            `¡Bienvenido ${interaction.user}!\n\n` +
                            `Tu cuenta fue verificada correctamente en **La Orden Morada**.`
                        )
                        .setThumbnail(
                            interaction.user.displayAvatarURL({
                                size: 512
                            })
                        );

                    await interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });

                    await enviarLog(
                        interaction.guild,
                        embedBase(SUCCESS_COLOR)
                            .setTitle("✅ USUARIO VERIFICADO")
                            .setDescription(
                                `${interaction.user} completó la verificación.`
                            )
                            .addFields({
                                name: "🛡️ Rol",
                                value: `<@&${VERIFIED_ROLE_ID}>`
                            })
                            .setThumbnail(
                                interaction.user.displayAvatarURL()
                            )
                    );

                } catch (error) {

                    console.error("Error verificación:", error);

                    return interaction.reply({
                        content:
                            "❌ No pude asignarte el rol. Revisa los permisos y la posición del rol del bot.",
                        ephemeral: true
                    });
                }

                return;
            }

            // ---------------------------------------------
            // CREAR TICKET
            // ---------------------------------------------

            if (interaction.customId === "crear_ticket") {

                const guild = interaction.guild;

                const existente =
                    guild.channels.cache.find(
                        channel =>
                            channel.name ===
                            `ticket-${interaction.user.id}`
                    );

                if (existente) {

                    return interaction.reply({
                        embeds: [
                            embedBase(WARNING_COLOR)
                                .setTitle("🎫 TICKET EXISTENTE")
                                .setDescription(
                                    `Ya tenés un ticket abierto:\n${existente}`
                                )
                        ],
                        ephemeral: true
                    });
                }

                const panel =
                    guild.channels.cache.get(
                        CHANNELS.TICKETS
                    );

                const categoria = panel?.parentId || null;

                const ticket =
                    await guild.channels.create({
                        name: `ticket-${interaction.user.id}`,
                        type: ChannelType.GuildText,
                        parent: categoria,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone.id,
                                deny: [
                                    PermissionFlagsBits.ViewChannel
                                ]
                            },
                            {
                                id: interaction.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },
                            {
                                id: client.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            }
                        ]
                    });

                const embed = embedBase(BOT_COLOR)
                    .setTitle("🎫 TICKET CREADO")
                    .setDescription(
                        `Hola ${interaction.user}.\n\n` +
                        `Explicá tu problema y un miembro del Staff te atenderá.\n\n` +
                        `Cuando hayas terminado, pulsa **🔒 CERRAR TICKET**.`
                    )
                    .setThumbnail(
                        interaction.user.displayAvatarURL({
                            size: 512
                        })
                    );

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId("cerrar_ticket")
                            .setLabel("CERRAR TICKET")
                            .setEmoji("🔒")
                            .setStyle(ButtonStyle.Danger)
                    );

                await ticket.send({
                    content: `${interaction.user}`,
                    embeds: [embed],
                    components: [row]
                });

                await interaction.reply({
                    embeds: [
                        embedBase(SUCCESS_COLOR)
                            .setTitle("🎫 TICKET CREADO")
                            .setDescription(
                                `Tu ticket fue creado correctamente:\n${ticket}`
                            )
                    ],
                    ephemeral: true
                });

                await enviarLog(
                    guild,
                    embedBase(BOT_COLOR)
                        .setTitle("🎫 TICKET CREADO")
                        .setDescription(
                            `${interaction.user} creó un ticket.`
                        )
                        .addFields({
                            name: "📁 Canal",
                            value: `${ticket}`
                        })
                );

                return;
            }

            // ---------------------------------------------
            // CERRAR TICKET
            // ---------------------------------------------

            if (interaction.customId === "cerrar_ticket") {

                if (
                    !interaction.channel.name.startsWith(
                        "ticket-"
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Este canal no es un ticket.",
                        ephemeral: true
                    });
                }

                const embed =
                    embedBase(ERROR_COLOR)
                        .setTitle("🔒 TICKET CERRADO")
                        .setDescription(
                            `El ticket será eliminado en **5 segundos**.`
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embedBase(ERROR_COLOR)
                        .setTitle("🔒 TICKET CERRADO")
                        .setDescription(
                            `${interaction.user} cerró un ticket.`
                        )
                        .addFields({
                            name: "📁 Canal",
                            value: interaction.channel.name
                        })
                );

                setTimeout(() => {
                    interaction.channel.delete().catch(() => {});
                }, 5000);

                return;
            }

            return;
        }

        // =================================================
        // SLASH COMMANDS
        // =================================================

        if (!interaction.isChatInputCommand()) return;

        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este comando solamente puede utilizarse dentro de un servidor.",
                ephemeral: true
            });
        }

        // TODOS LOS COMANDOS SOLO PARA EL OWNER
        if (!esOwner(interaction)) {

            return interaction.reply({
                embeds: [
                    embedBase(ERROR_COLOR)
                        .setTitle("🚫 ACCESO DENEGADO")
                        .setDescription(
                            "No tenés permiso para utilizar los comandos de este bot."
                        )
                ],
                ephemeral: true
            });
        }

        // =================================================
        // /IP
        // =================================================

        if (interaction.commandName === "ip") {

            const embed = embedBase(BOT_COLOR)
                .setTitle("🟣 LA ORDEN MORADA")
                .setDescription(
                    "## 🎮 INFORMACIÓN DEL SERVIDOR\n\n" +
                    "🌐 **IP**\n" +
                    `\`${SERVER_IP}\`\n\n` +
                    "🔌 **Puerto**\n" +
                    `\`${SERVER_PORT}\`\n\n` +
                    "🟣 ¡Te esperamos dentro!"
                )
                .setThumbnail(
                    client.user.displayAvatarURL({
                        size: 512
                    })
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // /CLEAR
        // =================================================

        if (interaction.commandName === "clear") {

            const cantidad =
                interaction.options.getInteger("cantidad");

            await interaction.deferReply({
                ephemeral: true
            });

            const mensajes =
                await interaction.channel.bulkDelete(
                    cantidad,
                    true
                );

            const embed = embedBase(INFO_COLOR)
                .setTitle("🧹 MENSAJES ELIMINADOS")
                .addFields(
                    {
                        name: "📊 Cantidad",
                        value: `${mensajes.size}`,
                        inline: true
                    },
                    {
                        name: "👮 Moderador",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "📍 Canal",
                        value: `${interaction.channel}`,
                        inline: true
                    }
                );

            await interaction.editReply({
                embeds: [embed]
            });

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
                interaction.options.getUser("usuario");

            const duracion =
                interaction.options.getString("duracion");

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {
                return interaction.reply({
                    content:
                        "❌ El usuario no pertenece al servidor.",
                    ephemeral: true
                });
            }

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({
                    content:
                        "❌ No podés moderar a este usuario por su jerarquía.",
                    ephemeral: true
                });
            }

            const tiempo =
                convertirDuracion(duracion);

            if (
                !tiempo ||
                tiempo <= 0 ||
                tiempo > 28 * 24 * 60 * 60 * 1000
            ) {
                return interaction.reply({
                    content:
                        "❌ Duración inválida. Ejemplos: `30s`, `5m`, `1h`, `1d`. Máximo 28 días.",
                    ephemeral: true
                });
            }

            await miembro.timeout(
                tiempo,
                `Timeout aplicado por ${interaction.user.tag}`
            );

            const embed = embedBase(WARNING_COLOR)
                .setTitle("🔇 USUARIO SILENCIADO")
                .setDescription(
                    `${usuario} recibió un timeout.`
                )
                .addFields(
                    {
                        name: "⏱️ Duración",
                        value: duracion,
                        inline: true
                    },
                    {
                        name: "👮 Moderador",
                        value: `${interaction.user}`,
                        inline: true
                    }
                );

            await interaction.reply({
                embeds: [embed]
            });

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
                interaction.options.getUser("usuario");

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {
                return interaction.reply({
                    content:
                        "❌ Usuario no encontrado.",
                    ephemeral: true
                });
            }

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({
                    content:
                        "❌ No podés modificar a este usuario.",
                    ephemeral: true
                });
            }

            await miembro.timeout(
                null,
                `Timeout removido por ${interaction.user.tag}`
            );

            const embed = embedBase(SUCCESS_COLOR)
                .setTitle("🔊 TIMEOUT REMOVIDO")
                .setDescription(
                    `${usuario} ya no está silenciado.`
                )
                .addFields({
                    name: "👮 Moderador",
                    value: `${interaction.user}`
                });

            await interaction.reply({
                embeds: [embed]
            });

            await enviarLog(
                interaction.guild,
                embed
            );

            return;
        }

        // =================================================
        // /BAN
        // =================================================

        if (interaction.commandName === "ban") {

            const usuario =
                interaction.options.getUser("usuario");

            const motivo =
                interaction.options.getString("motivo") ||
                "Sin motivo especificado";

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (
                miembro &&
                !puedeModerar(interaction, miembro)
            ) {
                return interaction.reply({
                    content:
                        "❌ No podés banear a este usuario.",
                    ephemeral: true
                });
            }

            await interaction.guild.members.ban(
                usuario.id,
                {
                    reason:
                        `${motivo} | Por ${interaction.user.tag}`
                }
            );

            const embed = embedBase(ERROR_COLOR)
                .setTitle("🔨 USUARIO BANEADO")
                .setDescription(
                    `${usuario} fue baneado del servidor.`
                )
                .addFields(
                    {
                        name: "📝 Motivo",
                        value: motivo
                    },
                    {
                        name: "👮 Moderador",
                        value: `${interaction.user}`
                    }
                )
                .setThumbnail(
                    usuario.displayAvatarURL({
                        size: 512
                    })
                );

            await interaction.reply({
                embeds: [embed]
            });

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
                interaction.options.getString("id")
                    .trim();

            if (!/^\d{17,20}$/.test(id)) {
                return interaction.reply({
                    content:
                        "❌ ID inválida.",
                    ephemeral: true
                });
            }

            try {

                await interaction.guild.members.unban(
                    id,
                    `Desbaneado por ${interaction.user.tag}`
                );

                const embed = embedBase(SUCCESS_COLOR)
                    .setTitle("🔓 USUARIO DESBANEADO")
                    .setDescription(
                        `La ID \`${id}\` fue desbaneada.`
                    )
                    .addFields({
                        name: "👮 Moderador",
                        value: `${interaction.user}`
                    });

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

            } catch {

                return interaction.reply({
                    content:
                        "❌ No existe un baneo activo para esa ID.",
                    ephemeral: true
                });
            }

            return;
        }

        // =================================================
        // /KICK
        // =================================================

        if (interaction.commandName === "kick") {

            const usuario =
                interaction.options.getUser("usuario");

            const motivo =
                interaction.options.getString("motivo") ||
                "Sin motivo especificado";

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {
                return interaction.reply({
                    content:
                        "❌ El usuario no está en el servidor.",
                    ephemeral: true
                });
            }

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({
                    content:
                        "❌ No podés expulsar a este usuario.",
                    ephemeral: true
                });
            }

            await miembro.kick(
                `${motivo} | Por ${interaction.user.tag}`
            );

            const embed = embedBase(ERROR_COLOR)
                .setTitle("👢 USUARIO EXPULSADO")
                .setDescription(
                    `${usuario} fue expulsado del servidor.`
                )
                .addFields(
                    {
                        name: "📝 Motivo",
                        value: motivo
                    },
                    {
                        name: "👮 Moderador",
                        value: `${interaction.user}`
                    }
                );

            await interaction.reply({
                embeds: [embed]
            });

            await enviarLog(
                interaction.guild,
                embed
            );

            return;
        }

        // =================================================
        // /WARN
        // =================================================

        if (interaction.commandName === "warn") {

            const usuario =
                interaction.options.getUser("usuario");

            const motivo =
                interaction.options.getString("motivo");

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {
                return interaction.reply({
                    content:
                        "❌ El usuario no está en el servidor.",
                    ephemeral: true
                });
            }

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({
                    content:
                        "❌ No podés advertir a este usuario.",
                    ephemeral: true
                });
            }

            const key =
                `${interaction.guild.id}:${usuario.id}`;

            const cantidad =
                (warnMap.get(key) || 0) + 1;

            warnMap.set(key, cantidad);

            const embed = embedBase(WARNING_COLOR)
                .setTitle("⚠️ ADVERTENCIA")
                .setDescription(
                    `${usuario} recibió una advertencia.`
                )
                .addFields(
                    {
                        name: "📝 Motivo",
                        value: motivo
                    },
                    {
                        name: "⚠️ Advertencias",
                        value: `${cantidad}`,
                        inline: true
                    },
                    {
                        name: "👮 Moderador",
                        value: `${interaction.user}`,
                        inline: true
                    }
                );

            await interaction.reply({
                embeds: [embed]
            });

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

            const subcomando =
                interaction.options.getSubcommand();

            if (subcomando === "canal") {

                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: false
                    }
                );

                const embed = embedBase(ERROR_COLOR)
                    .setTitle("🔒 CANAL BLOQUEADO")
                    .setDescription(
                        `${interaction.channel} fue bloqueado.`
                    )
                    .addFields({
                        name: "👮 Moderador",
                        value: `${interaction.user}`
                    });

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            if (subcomando === "general") {

                await interaction.deferReply();

                const canales =
                    interaction.guild.channels.cache.filter(
                        channel =>
                            channel.type ===
                            ChannelType.GuildText
                    );

                for (const [, canal] of canales) {

                    await canal.permissionOverwrites
                        .edit(
                            interaction.guild.roles.everyone,
                            {
                                SendMessages: false
                            }
                        )
                        .catch(() => {});
                }

                const embed = embedBase(ERROR_COLOR)
                    .setTitle("🔒 BLOQUEO GENERAL")
                    .setDescription(
                        "Todos los canales de texto fueron bloqueados."
                    )
                    .addFields({
                        name: "👮 Moderador",
                        value: `${interaction.user}`
                    });

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

        // =================================================
        // /UNLOCK
        // =================================================

        if (interaction.commandName === "unlock") {

            const subcomando =
                interaction.options.getSubcommand();

            if (subcomando === "canal") {

                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: null
                    }
                );

                const embed = embedBase(SUCCESS_COLOR)
                    .setTitle("🔓 CANAL DESBLOQUEADO")
                    .setDescription(
                        `${interaction.channel} fue desbloqueado.`
                    )
                    .addFields({
                        name: "👮 Moderador",
                        value: `${interaction.user}`
                    });

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            if (subcomando === "general") {

                await interaction.deferReply();

                const canales =
                    interaction.guild.channels.cache.filter(
                        channel =>
                            channel.type ===
                            ChannelType.GuildText
                    );

                for (const [, canal] of canales) {

                    await canal.permissionOverwrites
                        .edit(
                            interaction.guild.roles.everyone,
                            {
                                SendMessages: null
                            }
                        )
                        .catch(() => {});
                }

                const embed = embedBase(SUCCESS_COLOR)
                    .setTitle("🔓 DESBLOQUEO GENERAL")
                    .setDescription(
                        "Todos los canales de texto fueron desbloqueados."
                    )
                    .addFields({
                        name: "👮 Moderador",
                        value: `${interaction.user}`
                    });

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

        // =================================================
        // /CREATE_MSJ
        // =================================================

        if (interaction.commandName === "create_msj") {

            const titulo =
                interaction.options.getString("titulo");

            const contenido =
                interaction.options.getString("contenido");

            const canalDestino =
                interaction.options.getChannel("canal") ||
                interaction.channel;

            if (!canalDestino.isTextBased()) {

                return interaction.reply({
                    content:
                        "❌ El canal no es de texto.",
                    ephemeral: true
                });
            }

            const embed = embedBase(BOT_COLOR)
                .setTitle(titulo)
                .setDescription(
                    contenido.replace(/\\n/g, "\n")
                );

            await canalDestino.send({
                embeds: [embed]
            });

            return interaction.reply({
                embeds: [
                    embedBase(SUCCESS_COLOR)
                        .setTitle("✅ MENSAJE CREADO")
                        .setDescription(
                            `El mensaje fue enviado en ${canalDestino}.`
                        )
                ],
                ephemeral: true
            });
        }

    } catch (error) {

        console.error(
            "❌ Error procesando interacción:",
            error
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                embeds: [
                    embedBase(ERROR_COLOR)
                        .setTitle("❌ ERROR")
                        .setDescription(
                            "Ocurrió un error al ejecutar la acción."
                        )
                ],
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN);
