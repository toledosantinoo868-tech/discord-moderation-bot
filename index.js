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
    ChannelType,
    Partials
} = require("discord.js");

const http = require("http");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const CLIENT_ID = "1552817688378605650";
const TOKEN = process.env.DISCORD_TOKEN;

// =====================================================
// ROLES
// =====================================================

const OWNER_ROLE_ID = "1531489394127536188";
const STAFF_ROLE_ID = "1532574929235607632";
const MOD_ROLE_ID = "1538995243490353263";
const VERIFY_ROLE_ID = "1544521207708131409";

// =====================================================
// CANALES
// =====================================================

const WELCOME_CHANNEL_ID = "1531493723840450580";
const LOG_CHANNEL_ID = "1544504719047917610";
const VERIFY_CHANNEL_ID = "1544523269376450590";

// =====================================================
// TICKETS
// =====================================================

const TICKET_PANEL_CHANNEL_ID = "1533646002878283936";
const TICKET_CATEGORY_ID = "1532906564569272401";

// =====================================================
// SERVIDOR HTTP
// =====================================================

const PORT = Number(process.env.PORT) || 10000;

const httpServer = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Discord bot online");
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor HTTP escuchando en el puerto ${PORT}`);
});

// =====================================================
// CLIENTE DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],

    partials: [
        Partials.Message,
        Partials.Channel
    ]
});

// =====================================================
// CACHE DE MENSAJES
// =====================================================

const messageCache = new Map();

// =====================================================
// ADVERTENCIAS
// =====================================================

const warnings = new Map();

// =====================================================
// ANTI-SPAM
// =====================================================

const spamTracker = new Map();

const SPAM_MESSAGE_LIMIT = 5;
const SPAM_WINDOW = 5000;
const SPAM_TIMEOUT = 30 * 1000;

// =====================================================
// FUNCIONES DE PERMISOS
// =====================================================

function esOwner(interaction) {
    if (!interaction.guild) return false;

    return (
        interaction.guild.ownerId === interaction.user.id ||
        interaction.member?.roles?.cache?.has(OWNER_ROLE_ID)
    );
}

function esStaff(interaction) {
    if (!interaction.guild) return false;

    return (
        esOwner(interaction) ||
        interaction.member?.roles?.cache?.has(STAFF_ROLE_ID) ||
        interaction.member?.roles?.cache?.has(MOD_ROLE_ID) ||
        interaction.member?.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

// =====================================================
// PROTECCIÓN DE JERARQUÍA
// =====================================================

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

    const ejecutor = interaction.member;

    if (!ejecutor) {
        return false;
    }

    return (
        miembro.roles.highest.position <
        ejecutor.roles.highest.position
    );
}

// =====================================================
// GUARDAR MENSAJE
// =====================================================

function guardarMensaje(message) {
    if (!message) return;
    if (!message.id) return;
    if (!message.guild) return;
    if (message.author?.bot) return;

    messageCache.set(message.id, {
        id: message.id,
        guildId: message.guild.id,
        channelId: message.channel?.id,
        channelName: message.channel?.name || "desconocido",
        authorId: message.author?.id,
        authorTag: message.author?.tag || "Desconocido",
        authorAvatar: message.author?.displayAvatarURL({
            extension: "png",
            size: 256
        }),
        content: message.content || ""
    });

    if (messageCache.size > 5000) {
        const primero =
            messageCache.keys().next().value;

        if (primero) {
            messageCache.delete(primero);
        }
    }
}

// =====================================================
// ENVIAR LOG
// =====================================================

async function enviarLog(guild, embed) {
    try {
        if (!guild) return;

        const canal =
            await guild.channels.fetch(LOG_CHANNEL_ID);

        if (!canal) {
            console.log("❌ No existe el canal de logs.");
            return;
        }

        if (!canal.isTextBased()) {
            console.log("❌ El canal de logs no es de texto.");
            return;
        }

        await canal.send({
            embeds: [embed]
        });

    } catch (error) {
        console.error(
            "❌ ERROR ENVIANDO LOG:",
            error.message || error
        );
    }
}

// =====================================================
// PARSEAR DURACIÓN
// =====================================================

function convertirDuracion(entrada) {
    if (!entrada || typeof entrada !== "string") {
        return null;
    }

    const match =
        entrada.trim().match(
            /^(\d+)\s*(s|m|h|d)$/i
        );

    if (!match) {
        return null;
    }

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
// PANEL VERIFICACIÓN
// =====================================================

function crearPanelVerificacion() {
    const embed =
        new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle("🛡️ VERIFICACIÓN — LA ORDEN MORADA")
            .setDescription(
                "¡Bienvenido/a a **La Orden Morada**! 💜\n\n" +
                "Para acceder al servidor, primero tenés que verificarte.\n\n" +
                "Al presionar **✅ Verificar**, aceptás respetar " +
                "las reglas y normas de la comunidad.\n\n" +
                "🔐 Una vez verificado/a, recibirás automáticamente " +
                "el rol correspondiente.\n\n" +
                "💜 ¡Gracias por formar parte de **La Orden Morada**!\n\n" +
                "━━━━━━━━━━━━━━━━━━━━\n\n" +
                "🟢 **Presioná el botón de abajo para verificarte.**"
            )
            .setFooter({
                text: "La Orden Morada • Verificación"
            })
            .setTimestamp();

    const boton =
        new ButtonBuilder()
            .setCustomId("verificar_usuario")
            .setLabel("Verificar")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success);

    const fila =
        new ActionRowBuilder()
            .addComponents(boton);

    return {
        embeds: [embed],
        components: [fila]
    };
}

// =====================================================
// PANEL TICKETS
// =====================================================

function crearPanelTickets() {
    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🎫 SOPORTE — LA ORDEN MORADA")
            .setDescription(
                "¿Necesitás ayuda? 💜\n\n" +
                "Nuestro equipo está disponible para ayudarte.\n\n" +
                "🎫 **¿Cómo abrir un ticket?**\n" +
                "Presioná el botón **🎫 Crear ticket**.\n\n" +
                "🔒 El ticket será privado.\n\n" +
                "📌 **Antes de abrir un ticket:**\n" +
                "• Explicá claramente tu problema.\n" +
                "• No abras tickets innecesarios.\n" +
                "• Esperá al equipo.\n" +
                "• No hagas spam.\n\n" +
                "━━━━━━━━━━━━━━━━━━━━\n\n" +
                "🟢 **Presioná el botón para abrir un ticket.**"
            )
            .setFooter({
                text: "La Orden Morada • Sistema de soporte"
            })
            .setTimestamp();

    const boton =
        new ButtonBuilder()
            .setCustomId("crear_ticket")
            .setLabel("Crear ticket")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Success);

    const fila =
        new ActionRowBuilder()
            .addComponents(boton);

    return {
        embeds: [embed],
        components: [fila]
    };
}

// =====================================================
// MENSAJE TICKET
// =====================================================

function crearMensajeTicket(member) {
    const embed =
        new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle("🎫 TICKET DE SOPORTE")
            .setDescription(
                `Hola ${member} 💜\n\n` +
                "Tu ticket fue creado correctamente.\n\n" +
                "📌 Explicá detalladamente el motivo de tu consulta.\n\n" +
                "🛡️ Un miembro del Staff, Moderación u Owner " +
                "atenderá tu ticket.\n\n" +
                "🚫 No hagas spam ni menciones repetidamente al equipo.\n\n" +
                "Cuando el problema esté solucionado, podés " +
                "utilizar **🔒 Cerrar ticket**."
            )
            .setFooter({
                text: "La Orden Morada • Soporte"
            })
            .setTimestamp();

    const cerrar =
        new ButtonBuilder()
            .setCustomId("cerrar_ticket")
            .setLabel("Cerrar ticket")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger);

    const fila =
        new ActionRowBuilder()
            .addComponents(cerrar);

    return {
        content: `${member}`,
        embeds: [embed],
        components: [fila]
    };
}

// =====================================================
// ASEGURAR PANEL VERIFICACIÓN
// =====================================================

async function asegurarPanelVerificacion() {
    try {
        for (const [, guild] of client.guilds.cache) {
            const canal =
                await guild.channels.fetch(
                    VERIFY_CHANNEL_ID
                );

            if (!canal || !canal.isTextBased()) {
                continue;
            }

            const mensajes =
                await canal.messages.fetch({
                    limit: 100
                });

            const existe =
                mensajes.find(message => {
                    if (
                        message.author?.id !==
                        client.user.id
                    ) {
                        return false;
                    }

                    return message.components?.some(row =>
                        row.components?.some(component =>
                            component.customId ===
                            "verificar_usuario"
                        )
                    );
                });

            if (!existe) {
                await canal.send(
                    crearPanelVerificacion()
                );

                console.log(
                    `✅ Panel de verificación enviado en ${guild.name}.`
                );
            }
        }
    } catch (error) {
        console.error(
            "❌ ERROR PANEL VERIFICACIÓN:",
            error.message || error
        );
    }
}

// =====================================================
// ASEGURAR PANEL TICKETS
// =====================================================

async function asegurarPanelTickets() {
    try {
        for (const [, guild] of client.guilds.cache) {
            const canal =
                await guild.channels.fetch(
                    TICKET_PANEL_CHANNEL_ID
                );

            if (!canal || !canal.isTextBased()) {
                continue;
            }

            const mensajes =
                await canal.messages.fetch({
                    limit: 100
                });

            const existe =
                mensajes.find(message => {
                    if (
                        message.author?.id !==
                        client.user.id
                    ) {
                        return false;
                    }

                    return message.components?.some(row =>
                        row.components?.some(component =>
                            component.customId ===
                            "crear_ticket"
                        )
                    );
                });

            if (!existe) {
                await canal.send(
                    crearPanelTickets()
                );

                console.log(
                    `✅ Panel de tickets enviado en ${guild.name}.`
                );
            }
        }
    } catch (error) {
        console.error(
            "❌ ERROR PANEL TICKETS:",
            error.message || error
        );
    }
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
        .setName("warn")
        .setDescription("Advierte a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario a advertir")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("motivo")
                .setDescription("Motivo de la advertencia")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription(
            "Muestra las advertencias de un usuario."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes de un canal.")
        .addIntegerOption(option =>
            option
                .setName("cantidad")
                .setDescription("Cantidad de mensajes a eliminar")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Configura el modo lento.")
        .addStringOption(option =>
            option
                .setName("tiempo")
                .setDescription("Ej: 5s, 10s, 1m, 5m")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Bloquea un canal o todo el servidor.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("canal")
                .setDescription("Bloquea este canal.")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("general")
                .setDescription("Bloquea todos los canales.")
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea un canal o todo el servidor.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("canal")
                .setDescription("Desbloquea este canal.")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("general")
                .setDescription("Desbloquea todos los canales.")
        ),

    new SlashCommandBuilder()
        .setName("create")
        .setDescription("Crea un mensaje personalizado.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("msj")
                .setDescription("Crea un mensaje en formato embed.")
                .addStringOption(option =>
                    option
                        .setName("texto")
                        .setDescription("Texto del mensaje.")
                        .setRequired(true)
                )
        )

].map(command => command.toJSON());

// =====================================================
// REGISTRAR COMANDOS
// =====================================================

const rest =
    new REST({
        version: "10"
    }).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("🔄 Registrando comandos slash...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log(
            `✅ ${commands.length} comandos registrados correctamente.`
        );

    } catch (error) {
        console.error(
            "❌ ERROR REGISTRANDO COMANDOS:",
            error.message || error
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
            "=========================================="
        );

        console.log(
            `✅ BOT CONECTADO: ${client.user.tag}`
        );

        console.log(
            `🆔 CLIENT ID: ${client.user.id}`
        );

        console.log(
            `🏠 SERVIDORES: ${client.guilds.cache.size}`
        );

        console.log(
            "🛡️ Anti-spam: ACTIVADO"
        );

        console.log(
            "🔗 Bloqueo de invitaciones: ACTIVADO"
        );

        console.log(
            "🎫 Sistema de tickets: ACTIVADO"
        );

        console.log(
            "🛡️ Sistema de verificación: ACTIVADO"
        );

        console.log(
            "=========================================="
        );

        setTimeout(
            async () => {
                await asegurarPanelVerificacion();
                await asegurarPanelTickets();
            },
            2000
        );
    }
);

// =====================================================
// MENSAJES
// =====================================================

client.on(
    "messageCreate",
    async message => {

        try {

            if (!message.guild) return;
            if (message.author?.bot) return;

            guardarMensaje(message);

            const miembro =
                message.member;

            const protegido =
                miembro &&
                (
                    miembro.roles.cache.has(OWNER_ROLE_ID) ||
                    miembro.roles.cache.has(STAFF_ROLE_ID) ||
                    miembro.roles.cache.has(MOD_ROLE_ID) ||
                    miembro.permissions.has(
                        PermissionFlagsBits.Administrator
                    )
                );

            const invitacionDiscord =
                /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i
                    .test(message.content || "");

            if (
                invitacionDiscord &&
                !protegido
            ) {

                try {
                    await message.delete();
                } catch {}

                const aviso =
                    await message.channel.send({
                        content:
                            `🚫 ${message.author}, no está permitido enviar invitaciones de otros servidores de Discord.`
                    });

                setTimeout(
                    async () => {
                        try {
                            await aviso.delete();
                        } catch {}
                    },
                    5000
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle(
                            "🔗 INVITACIÓN DE DISCORD BLOQUEADA"
                        )
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${message.author}`
                            },
                            {
                                name: "📍 Canal",
                                value:
                                    `${message.channel}`
                            },
                            {
                                name: "🔗 Contenido",
                                value:
                                    "Invitación de Discord detectada."
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    message.guild,
                    embed
                );

                return;
            }

            if (protegido) {
                return;
            }

            const clave =
                `${message.guild.id}:${message.author.id}`;

            const ahora =
                Date.now();

            let datos =
                spamTracker.get(clave);

            if (!datos) {

                datos = {
                    mensajes: [],
                    castigado: false
                };

                spamTracker.set(
                    clave,
                    datos
                );
            }

            datos.mensajes =
                datos.mensajes.filter(
                    timestamp =>
                        ahora - timestamp <= SPAM_WINDOW
                );

            datos.mensajes.push(ahora);

            if (
                datos.mensajes.length >=
                SPAM_MESSAGE_LIMIT &&
                !datos.castigado
            ) {

                datos.castigado = true;

                try {

                    const mensajes =
                        await message.channel.messages.fetch({
                            limit: 20
                        });

                    const mensajesSpam =
                        mensajes.filter(msg =>
                            msg.author.id ===
                            message.author.id &&
                            ahora - msg.createdTimestamp <=
                            SPAM_WINDOW
                        );

                    if (mensajesSpam.size > 0) {

                        await message.channel.bulkDelete(
                            mensajesSpam,
                            true
                        );
                    }

                } catch (error) {

                    console.error(
                        "❌ No se pudieron eliminar mensajes de spam:",
                        error.message || error
                    );
                }

                try {

                    await miembro.timeout(
                        SPAM_TIMEOUT,
                        "Anti-spam automático"
                    );

                } catch (error) {

                    console.error(
                        "❌ No se pudo aplicar timeout anti-spam:",
                        error.message || error
                    );
                }

                const embed =
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle(
                            "🛡️ ANTI-SPAM ACTIVADO"
                        )
                        .setDescription(
                            `${message.author} fue detectado enviando demasiados mensajes en poco tiempo.`
                        )
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${message.author}`
                            },
                            {
                                name: "📊 Límite",
                                value:
                                    `${SPAM_MESSAGE_LIMIT} mensajes / ${SPAM_WINDOW / 1000}s`
                            },
                            {
                                name: "🔇 Acción",
                                value:
                                    "Timeout automático de 30 segundos"
                            },
                            {
                                name: "📍 Canal",
                                value:
                                    `${message.channel}`
                            }
                        )
                        .setFooter({
                            text:
                                "La Orden Morada • Anti-Spam"
                        })
                        .setTimestamp();

                await enviarLog(
                    message.guild,
                    embed
                );

                const aviso =
                    await message.channel.send({
                        content:
                            `🛡️ ${message.author} fue silenciado durante 30 segundos por spam.`
                    });

                setTimeout(
                    async () => {
                        try {
                            await aviso.delete();
                        } catch {}
                    },
                    5000
                );

                setTimeout(
                    () => {
                        spamTracker.delete(clave);
                    },
                    SPAM_WINDOW
                );
            }

        } catch (error) {

            console.error(
                "❌ ERROR MESSAGE CREATE:",
                error.message || error
            );
        }
    }
);

// =====================================================
// MENSAJE ELIMINADO
// =====================================================

client.on(
    "messageDelete",
    async message => {

        try {

            if (!message.guild) return;
            if (message.author?.bot) return;

            const guardado =
                messageCache.get(message.id);

            let texto =
                message.content ||
                guardado?.content ||
                "Contenido no disponible.";

            if (texto.length > 1000) {
                texto =
                    texto.substring(0, 997) + "...";
            }

            const autor =
                message.author ||
                (
                    guardado?.authorId
                        ? await client.users.fetch(
                            guardado.authorId
                        ).catch(() => null)
                        : null
                );

            const embed =
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("🗑️ MENSAJE ELIMINADO")
                    .addFields(
                        {
                            name: "👤 Usuario",
                            value:
                                autor
                                    ? `${autor} \`${autor.tag}\``
                                    : "Desconocido"
                        },
                        {
                            name: "📍 Canal",
                            value:
                                message.channel
                                    ? `${message.channel}`
                                    : "Desconocido"
                        },
                        {
                            name: "💬 Mensaje",
                            value:
                                `\`\`\`\n${texto}\n\`\`\``
                        }
                    )
                    .setTimestamp();

            if (autor) {
                embed.setThumbnail(
                    autor.displayAvatarURL({
                        extension: "png",
                        size: 256
                    })
                );
            }

            await enviarLog(
                message.guild,
                embed
            );

            messageCache.delete(
                message.id
            );

        } catch (error) {

            console.error(
                "❌ ERROR MESSAGE DELETE:",
                error.message || error
            );
        }
    }
);

// =====================================================
// MENSAJE EDITADO
// =====================================================

client.on(
    "messageUpdate",
    async (oldMessage, newMessage) => {

        try {

            if (!oldMessage.guild) return;
            if (oldMessage.author?.bot) return;

            const guardado =
                messageCache.get(oldMessage.id);

            const antes =
                oldMessage.content ||
                guardado?.content ||
                "";

            const despues =
                newMessage.content ||
                "";

            if (antes === despues) {
                return;
            }

            let textoAntes =
                antes || "Sin contenido";

            let textoDespues =
                despues || "Sin contenido";

            if (textoAntes.length > 900) {
                textoAntes =
                    textoAntes.substring(0, 897) + "...";
            }

            if (textoDespues.length > 900) {
                textoDespues =
                    textoDespues.substring(0, 897) + "...";
            }

            const embed =
                new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle("✏️ MENSAJE EDITADO")
                    .addFields(
                        {
                            name: "👤 Usuario",
                            value:
                                oldMessage.author
                                    ? `${oldMessage.author} \`${oldMessage.author.tag}\``
                                    : "Desconocido"
                        },
                        {
                            name: "📍 Canal",
                            value:
                                `${oldMessage.channel}`
                        },
                        {
                            name: "🔴 Antes",
                            value:
                                `\`\`\`\n${textoAntes}\n\`\`\``
                        },
                        {
                            name: "🟢 Después",
                            value:
                                `\`\`\`\n${textoDespues}\n\`\`\``
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

            guardarMensaje(newMessage);

        } catch (error) {

            console.error(
                "❌ ERROR MESSAGE UPDATE:",
                error.message || error
            );
        }
    }
);

// =====================================================
// BIENVENIDA
// =====================================================

client.on(
    "guildMemberAdd",
    async member => {

        try {

            const canal =
                await member.guild.channels.fetch(
                    WELCOME_CHANNEL_ID
                );

            if (!canal || !canal.isTextBased()) {
                return;
            }

            const avatar =
                member.displayAvatarURL({
                    extension: "png",
                    size: 1024
                });

            const embed =
                new EmbedBuilder()
                    .setColor(0x8E44AD)
                    .setTitle(
                        "🫶︱𝗕𝗜𝗘𝗡𝗩𝗘𝗡𝗜𝗗𝗢𝗦"
                    )
                    .setDescription(
                        `💜 **¡Bienvenido/a ${member} a La Orden Morada!**\n\n` +
                        "🫶 Esperamos que disfrutes del servidor."
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

        } catch (error) {

            console.error(
                "❌ ERROR BIENVENIDA:",
                error.message || error
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

            if (
                interaction.isButton() &&
                interaction.customId ===
                "verificar_usuario"
            ) {

                const miembro =
                    interaction.member;

                const rol =
                    await interaction.guild.roles.fetch(
                        VERIFY_ROLE_ID
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
                        VERIFY_ROLE_ID
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
                            "❌ El rol de verificado debe estar debajo del rol más alto del bot.",
                        ephemeral: true
                    });
                }

                await miembro.roles.add(
                    rol,
                    "Verificación mediante botón"
                );

                await interaction.reply({
                    content:
                        `✅ ¡Listo! Ya estás verificado/a y recibiste ${rol}.`,
                    ephemeral: true
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle("🛡️ USUARIO VERIFICADO")
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${interaction.user}`
                            },
                            {
                                name: "🆔 ID",
                                value:
                                    interaction.user.id
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            if (
                interaction.isButton() &&
                interaction.customId ===
                "crear_ticket"
            ) {

                await interaction.deferReply({
                    ephemeral: true
                });

                const guild =
                    interaction.guild;

                const categoria =
                    await guild.channels.fetch(
                        TICKET_CATEGORY_ID
                    );

                if (
                    !categoria ||
                    categoria.type !==
                    ChannelType.GuildCategory
                ) {

                    return interaction.editReply({
                        content:
                            "❌ La categoría de tickets no existe."
                    });
                }

                const existente =
                    guild.channels.cache.find(
                        canal =>
                            canal.parentId ===
                            TICKET_CATEGORY_ID &&
                            canal.topic ===
                            `ticket:${interaction.user.id}`
                    );

                if (existente) {

                    return interaction.editReply({
                        content:
                            `🎫 Ya tenés un ticket abierto: ${existente}`
                    });
                }

                const nombre =
                    `ticket-${interaction.user.username}`
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "")
                        .substring(0, 80);

                const canal =
                    await guild.channels.create({

                        name:
                            nombre || `ticket-${interaction.user.id}`,

                        type:
                            ChannelType.GuildText,

                        parent:
                            TICKET_CATEGORY_ID,

                        topic:
                            `ticket:${interaction.user.id}`,

                        permissionOverwrites: [

                            {
                                id:
                                    guild.roles.everyone.id,

                                deny: [
                                    PermissionFlagsBits.ViewChannel
                                ]
                            },

                            {
                                id:
                                    interaction.user.id,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.AttachFiles
                                ]
                            },

                            {
                                id:
                                    STAFF_ROLE_ID,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageMessages
                                ]
                            },

                            {
                                id:
                                    MOD_ROLE_ID,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageMessages
                                ]
                            },

                            {
                                id:
                                    OWNER_ROLE_ID,

                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageMessages
                                ]
                            }
                        ]
                    });

                await canal.send(
                    crearMensajeTicket(
                        interaction.member
                    )
                );

                await interaction.editReply({
                    content:
                        `🎫 Tu ticket fue creado correctamente: ${canal}`
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle("🎫 TICKET CREADO")
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${interaction.user}`
                            },
                            {
                                name: "📍 Ticket",
                                value:
                                    `${canal}`
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    guild,
                    embed
                );

                return;
            }

            if (
                interaction.isButton() &&
                interaction.customId ===
                "cerrar_ticket"
            ) {

                const canal =
                    interaction.channel;

                if (
                    !canal ||
                    canal.type !==
                    ChannelType.GuildText
                ) {

                    return interaction.reply({
                        content:
                            "❌ Este botón solo funciona dentro de un ticket.",
                        ephemeral: true
                    });
                }

                if (
                    canal.parentId !==
                    TICKET_CATEGORY_ID
                ) {

                    return interaction.reply({
                        content:
                            "❌ Este canal no es un ticket.",
                        ephemeral: true
                    });
                }

                if (!esStaff(interaction)) {

                    return interaction.reply({
                        content:
                            "❌ Solo Staff, Moderadores u Owner pueden cerrar tickets.",
                        ephemeral: true
                    });
                }

                await interaction.reply({
                    content:
                        "🔒 Cerrando ticket..."
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle("🔒 TICKET CERRADO")
                        .addFields(
                            {
                                name: "📍 Ticket",
                                value:
                                    canal.name
                            },
                            {
                                name: "👤 Cerrado por",
                                value:
                                    `${interaction.user}`
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    interaction.guild,
                    embed
                );

                setTimeout(
                    async () => {
                        try {
                            await canal.delete(
                                "Ticket cerrado"
                            );
                        } catch (error) {
                            console.error(
                                "❌ No se pudo eliminar el ticket:",
                                error.message || error
                            );
                        }
                    },
                    3000
                );

                return;
            }

            if (!interaction.isChatInputCommand()) {
                return;
            }

            if (
                interaction.commandName ===
                "ip"
            ) {

                const embed =
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(
                            "🎮 SERVIDOR DE MINECRAFT"
                        )
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
                            text:
                                "La Orden Morada"
                        })
                        .setTimestamp();

                return interaction.reply({
                    embeds: [embed]
                });
            }

            if (
                interaction.commandName ===
                "create"
            ) {

                if (!esOwner(interaction)) {

                    return interaction.reply({
                        content:
                            "❌ Solo el Owner puede utilizar este comando.",
                        ephemeral: true
                    });
                }

                const texto =
                    interaction.options.getString(
                        "texto"
                    );

                if (!texto) {

                    return interaction.reply({
                        content:
                            "❌ Tenés que escribir un texto.",
                        ephemeral: true
                    });
                }

                if (texto.length > 4096) {

                    return interaction.reply({
                        content:
                            "❌ El texto no puede superar los 4096 caracteres.",
                        ephemeral: true
                    });
                }

                const embed =
                    new EmbedBuilder()
                        .setColor(0x8E44AD)
                        .setDescription(texto)
                        .setFooter({
                            text:
                                "La Orden Morada"
                        })
                        .setTimestamp();

                await interaction.channel.send({
                    embeds: [embed]
                });

                return interaction.reply({
                    content:
                        "✅ Mensaje creado correctamente.",
                    ephemeral: true
                });
            }

            const comandosStaff = [
                "ban",
                "mute",
                "unmute",
                "unban",
                "warn",
                "warnings",
                "clear",
                "slowmode",
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

            if (
                interaction.commandName ===
                "warn"
            ) {

                const usuario =
                    interaction.options.getUser(
                        "usuario"
                    );

                const motivo =
                    interaction.options.getString(
                        "motivo"
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
                            "❌ No podés moderar a un usuario con un rol igual o superior al tuyo.",
                        ephemeral: true
                    });
                }

                const clave =
                    `${interaction.guild.id}:${usuario.id}`;

                if (!warnings.has(clave)) {
                    warnings.set(clave, []);
                }

                const lista =
                    warnings.get(clave);

                lista.push({
                    motivo,
                    moderador:
                        interaction.user.id,
                    fecha:
                        Date.now()
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(0xF1C40F)
                        .setTitle("⚠️ ADVERTENCIA")
                        .setDescription(
                            `${usuario} recibió una advertencia.`
                        )
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${usuario}`
                            },
                            {
                                name: "📝 Motivo",
                                value:
                                    motivo
                            },
                            {
                                name: "📊 Advertencias",
                                value:
                                    `${lista.length}`
                            },
                            {
                                name: "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
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

            if (
                interaction.commandName ===
                "warnings"
            ) {

                const usuario =
                    interaction.options.getUser(
                        "usuario"
                    );

                const clave =
                    `${interaction.guild.id}:${usuario.id}`;

                const lista =
                    warnings.get(clave) || [];

                if (lista.length === 0) {

                    return interaction.reply({
                        content:
                            `📋 ${usuario} no tiene advertencias.`,
                        ephemeral: true
                    });
                }

                const texto =
                    lista
                        .map(
                            (warn, index) =>
                                `**${index + 1}.** ${warn.motivo}\n<@${warn.moderador}> • <t:${Math.floor(warn.fecha / 1000)}:R>`
                        )
                        .join("\n\n");

                const embed =
                    new EmbedBuilder()
                        .setColor(0xF1C40F)
                        .setTitle(
                            "📋 HISTORIAL DE ADVERTENCIAS"
                        )
                        .setDescription(
                            `**Usuario:** ${usuario}\n\n${texto}`
                        )
                        .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

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
                        .setColor(0x57F287)
                        .setTitle("🧹 MENSAJES ELIMINADOS")
                        .addFields(
                            {
                                name: "📊 Cantidad",
                                value:
                                    `${mensajes.size}`
                            },
                            {
                                name: "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            },
                            {
                                name: "📍 Canal",
                                value:
                                    `${interaction.channel}`
                            }
                        )
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
                interaction.commandName ===
                "slowmode"
            ) {

                const entrada =
                    interaction.options.getString(
                        "tiempo"
                    );

                const segundos =
                    convertirDuracion(entrada);

                if (segundos === null) {

                    return interaction.reply({
                        content:
                            "❌ Usa `5s`, `10s`, `1m`, `5m` o `1h`.",
                        ephemeral: true
                    });
                }

                const segundosFinal =
                    Math.floor(
                        segundos / 1000
                    );

                if (
                    segundosFinal < 0 ||
                    segundosFinal > 21600
                ) {

                    return interaction.reply({
                        content:
                            "❌ El slowmode debe estar entre 0 y 6 horas.",
                        ephemeral: true
                    });
                }

                if (
                    !interaction.channel ||
                    typeof interaction.channel.setRateLimitPerUser !==
                    "function"
                ) {

                    return interaction.reply({
                        content:
                            "❌ Este canal no permite configurar slowmode.",
                        ephemeral: true
                    });
                }

                await interaction.channel.setRateLimitPerUser(
                    segundosFinal,
                    `Slowmode por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle("🐢 SLOWMODE CONFIGURADO")
                        .setDescription(
                            `El slowmode de este canal ahora es de **${segundosFinal} segundos**.`
                        )
                        .addFields({
                            name: "🛡️ Configurado por",
                            value:
                                `${interaction.user}`
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
                            "❌ No podés banear a un usuario con un rol igual o superior al tuyo.",
                        ephemeral: true
                    });
                }

                await miembro.ban({
                    reason:
                        `Ban aplicado por ${interaction.user.tag}`
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle(
                            "🔨 USUARIO BANEADO"
                        )
                        .setDescription(
                            `${usuario} fue baneado del servidor.`
                        )
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${usuario}`
                            },
                            {
                                name: "🆔 ID",
                                value:
                                    usuario.id
                            },
                            {
                                name: "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
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
                            "❌ No podés mutear a un usuario con un rol igual o superior al tuyo.",
                        ephemeral: true
                    });
                }

                const tiempo =
                    convertirDuracion(duracion);

                if (
                    tiempo === null
                ) {

                    return interaction.reply({
                        content:
                            "❌ Usa `30s`, `5m`, `1h` o `1d`.",
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
                            "❌ La duración debe estar entre 1 segundo y 28 días.",
                        ephemeral: true
                    });
                }

                await miembro.timeout(
                    tiempo,
                    `Mute aplicado por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle(
                            "🔇 USUARIO SILENCIADO"
                        )
                        .setDescription(
                            `${usuario} fue silenciado correctamente.`
                        )
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${usuario}`
                            },
                            {
                                name: "⏱️ Duración",
                                value:
                                    duracion
                            },
                            {
                                name: "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
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
                            "❌ No podés modificar a este usuario por su jerarquía.",
                        ephemeral: true
                    });
                }

                await miembro.timeout(
                    null,
                    `Mute quitado por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(
                            "🔊 MUTE REMOVIDO"
                        )
                        .setDescription(
                            `${usuario} ya puede volver a hablar.`
                        )
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${usuario}`
                            },
                            {
                                name: "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
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

            if (
                interaction.commandName ===
                "unban"
            ) {

                const id =
                    interaction.options.getString(
                        "id"
                    ).trim();

                if (!/^\d{17,20}$/.test(id)) {

                    return interaction.reply({
                        content:
                            "❌ La ID de Discord no es válida.",
                        ephemeral: true
                    });
                }

                await interaction.guild.members.unban(
                    id,
                    `Unban realizado por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(
                            "🔓 USUARIO DESBANEADO"
                        )
                        .setDescription(
                            `El usuario con ID \`${id}\` fue desbaneado.`
                        )
                        .addFields(
                            {
                                name: "🆔 ID",
                                value:
                                    id
                            },
                            {
                                name: "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
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

            if (
                interaction.commandName ===
                "lock"
            ) {

                const subcomando =
                    interaction.options.getSubcommand();

                await interaction.deferReply();

                if (
                    subcomando ===
                    "canal"
                ) {

                    const canal =
                        interaction.channel;

                    if (
                        !canal ||
                        !canal.permissionOverwrites
                    ) {

                        return interaction.editReply({
                            content:
                                "❌ Este canal no puede bloquearse."
                        });
                    }

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
                            .setColor(0xED4245)
                            .setTitle(
                                "🔒 CANAL BLOQUEADO"
                            )
                            .setDescription(
                                "🚫 Los usuarios no pueden enviar mensajes en este canal."
                            )
                            .addFields({
                                name: "🛡️ Bloqueado por",
                                value:
                                    `${interaction.user}`
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
                    subcomando ===
                    "general"
                ) {

                    const canales =
                        await interaction.guild.channels.fetch();

                    let bloqueados = 0;

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

                            bloqueados++;

                        } catch (error) {

                            console.error(
                                `❌ No se pudo bloquear #${canal.name}:`,
                                error.message || error
                            );
                        }
                    }

                    const embed =
                        new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle(
                                "🔒 SERVIDOR BLOQUEADO"
                            )
                            .setDescription(
                                "🚨 Se realizó un bloqueo general."
                            )
                            .addFields(
                                {
                                    name: "📊 Canales bloqueados",
                                    value:
                                        `${bloqueados}`
                                },
                                {
                                    name: "🛡️ Bloqueado por",
                                    value:
                                        `${interaction.user}`
                                }
                            )
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

            if (
                interaction.commandName ===
                "unlock"
            ) {

                const subcomando =
                    interaction.options.getSubcommand();

                await interaction.deferReply();

                if (
                    subcomando ===
                    "canal"
                ) {

                    const canal =
                        interaction.channel;

                    if (
                        !canal ||
                        !canal.permissionOverwrites
                    ) {

                        return interaction.editReply({
                            content:
                                "❌ Este canal no puede desbloquearse."
                        });
                    }

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
                            .setColor(0x57F287)
                            .setTitle(
                                "🔓 CANAL DESBLOQUEADO"
                            )
                            .setDescription(
                                "🟢 El canal volvió a utilizar sus permisos normales."
                            )
                            .addFields({
                                name: "🛡️ Desbloqueado por",
                                value:
                                    `${interaction.user}`
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
                    subcomando ===
                    "general"
                ) {

                    const canales =
                        await interaction.guild.channels.fetch();

                    let desbloqueados = 0;

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

                            desbloqueados++;

                        } catch (error) {

                            console.error(
                                `❌ No se pudo desbloquear #${canal.name}:`,
                                error.message || error
                            );
                        }
                    }

                    const embed =
                        new EmbedBuilder()
                            .setColor(0x57F287)
                            .setTitle(
                                "🔓 SERVIDOR DESBLOQUEADO"
                            )
                            .setDescription(
                                "🟢 Se realizó el desbloqueo general."
                            )
                            .addFields(
                                {
                                    name: "📊 Canales desbloqueados",
                                    value:
                                        `${desbloqueados}`
                                },
                                {
                                    name: "🛡️ Desbloqueado por",
                                    value:
                                        `${interaction.user}`
                                }
                            )
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

            } catch {}
        }
    }
);

// =====================================================
// ERRORES DEL CLIENTE
// =====================================================

client.on(
    "error",
    error => {
        console.error(
            "❌ ERROR DEL CLIENTE DISCORD:",
            error
        );
    }
);

client.on(
    "warn",
    warning => {
        console.warn(
            "⚠️ DISCORD:",
            warning
        );
    }
);

// =====================================================
// PROCESO
// =====================================================

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "❌ UNHANDLED REJECTION:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "❌ UNCAUGHT EXCEPTION:",
            error
        );
    }
);

// =====================================================
// COMPROBAR TOKEN
// =====================================================

if (!TOKEN) {

    console.error(
        "❌ ERROR: No existe la variable DISCORD_TOKEN."
    );

    console.error(
        "👉 En Wisbyte tenés que crear una variable de entorno llamada DISCORD_TOKEN con el token de tu bot."
    );

    process.exit(1);
}

// =====================================================
// INICIO
// =====================================================

(async () => {

    try {

        await registrarComandos();

        console.log(
            "🔐 Iniciando sesión en Discord..."
        );

        await client.login(TOKEN);

    } catch (error) {

        console.error(
            "❌ NO SE PUDO INICIAR EL BOT:"
        );

        console.error(
            error
        );

        process.exit(1);
    }

})();
