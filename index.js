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

// ROLES
const OWNER_ROLE_ID = "1531489394127536188";
const STAFF_ROLE_ID = "1532574929235607632";
const MOD_ROLE_ID = "1538995243490353263";
const VERIFY_ROLE_ID = "1544521207708131409";

// CANALES
const WELCOME_CHANNEL_ID = "1531493723840450580";
const LOG_CHANNEL_ID = "1544504719047917610";
const VERIFY_CHANNEL_ID = "1544523269376450590";

// TICKETS
const TICKET_PANEL_CHANNEL_ID = "1533646002878283936";
const TICKET_CATEGORY_ID = "1532906564569272401";

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
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],

    partials: [
        Partials.Message,
        Partials.Channel
    ]
});

// =====================================================
// CACHE PARA LOGS
// =====================================================

const messageCache = new Map();

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
            error
        );
    }
}

// =====================================================
// PANEL DE VERIFICACIÓN
// =====================================================

function crearPanelVerificacion() {

    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle("🛡️ VERIFICACIÓN — LA ORDEN MORADA")
        .setDescription(
            "¡Bienvenido/a a **La Orden Morada**! 💜\n\n" +

            "Para acceder al servidor, primero tenés que verificarte.\n\n" +

            "Al presionar **✅ Verificar**, aceptás respetar " +
            "las reglas y normas de la comunidad.\n\n" +

            "🔐 Una vez verificado/a, recibirás automáticamente " +
            "el rol correspondiente y podrás acceder a los " +
            "canales habilitados.\n\n" +

            "📌 **Importante:**\n" +
            "Si tenés algún problema con la verificación, " +
            "contactá a un miembro del equipo de administración.\n\n" +

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
// PANEL DE TICKETS
// =====================================================

function crearPanelTickets() {

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎫 SOPORTE — LA ORDEN MORADA")
        .setDescription(
            "¿Necesitás ayuda? 💜\n\n" +

            "Nuestro equipo está disponible para ayudarte " +
            "con cualquier problema, duda o consulta relacionada " +
            "con el servidor.\n\n" +

            "🎫 **¿Cómo abrir un ticket?**\n" +
            "Presioná el botón **🎫 Crear ticket** de abajo.\n\n" +

            "🔒 El ticket será privado y solamente podrán verlo " +
            "vos y el equipo encargado de atenderlo.\n\n" +

            "📌 **Antes de abrir un ticket:**\n" +
            "• Explicá claramente tu problema.\n" +
            "• No abras tickets innecesarios.\n" +
            "• Esperá a que un miembro del equipo responda.\n" +
            "• No hagas spam dentro del ticket.\n\n" +

            "💜 Nuestro equipo intentará ayudarte lo antes posible.\n\n" +

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
// PANEL DE TICKET
// =====================================================

function crearMensajeTicket(member) {

    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle("🎫 TICKET DE SOPORTE")
        .setDescription(
            `Hola ${member} 💜\n\n` +

            "Tu ticket fue creado correctamente.\n\n" +

            "📌 Explicá detalladamente el motivo de tu consulta " +
            "para que el equipo pueda ayudarte.\n\n" +

            "🛡️ Un miembro del Staff, Moderación u Owner " +
            "atenderá tu ticket cuando esté disponible.\n\n" +

            "🚫 No hagas spam ni menciones repetidamente al equipo.\n\n" +

            "Cuando el problema esté solucionado, podés " +
            "utilizar el botón **🔒 Cerrar ticket**."
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
// BUSCAR Y CREAR PANEL DE VERIFICACIÓN
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

            if (existe) {

                console.log(
                    "✅ Panel de verificación ya existe."
                );

                continue;
            }

            await canal.send(
                crearPanelVerificacion()
            );

            console.log(
                "✅ Panel de verificación enviado."
            );
        }

    } catch (error) {

        console.error(
            "❌ ERROR EN PANEL DE VERIFICACIÓN:",
            error
        );
    }
}

// =====================================================
// BUSCAR Y CREAR PANEL DE TICKETS
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

            if (existe) {

                console.log(
                    "✅ Panel de tickets ya existe."
                );

                continue;
            }

            await canal.send(
                crearPanelTickets()
            );

            console.log(
                "✅ Panel de tickets enviado."
            );
        }

    } catch (error) {

        console.error(
            "❌ ERROR EN PANEL DE TICKETS:",
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
        .setDescription(
            "Muestra la IP del servidor de Minecraft."
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
                    "Usuario que quieres banear"
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
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
                    "Usuario que quieres silenciar"
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duracion")
                .setDescription(
                    "Ej: 30s, 5m, 1h, 1d"
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription(
            "Quita el mute a un usuario."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription(
                    "Usuario al que quitar el mute"
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
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
                    "ID del usuario"
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription(
            "Bloquea el canal para los usuarios."
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription(
            "Desbloquea el canal."
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

        console.log(
            "Registrando comandos..."
        );

        await rest.put(
            Routes.applicationCommands(
                CLIENT_ID
            ),
            {
                body: commands
            }
        );

        console.log(
            "✅ Comandos registrados correctamente."
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
            `✅ Bot conectado como ${client.user.tag}`
        );

        console.log(
            `📋 Logs: ${LOG_CHANNEL_ID}`
        );

        console.log(
            `🛡️ Verificación: ${VERIFY_CHANNEL_ID}`
        );

        console.log(
            `🎫 Panel tickets: ${TICKET_PANEL_CHANNEL_ID}`
        );

        console.log(
            `📂 Categoría tickets: ${TICKET_CATEGORY_ID}`
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
// MENSAJES CREADOS
// =====================================================

client.on(
    "messageCreate",
    message => {

        try {

            if (!message.guild) return;
            if (message.author?.bot) return;

            guardarMensaje(message);

        } catch (error) {

            console.error(
                "❌ ERROR GUARDANDO MENSAJE:",
                error
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

            const autor =
                message.author ||
                null;

            const contenido =
                message.content ||
                guardado?.content ||
                "Contenido no disponible.";

            let texto = contenido;

            if (texto.length > 1000) {

                texto =
                    texto.substring(0, 997) +
                    "...";
            }

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
                                    : guardado?.authorId
                                        ? `<@${guardado.authorId}>`
                                        : "Desconocido"
                        },
                        {
                            name: "📍 Canal",
                            value:
                                message.channel
                                    ? `${message.channel}`
                                    : `#${guardado?.channelName || "desconocido"}`
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

            } else if (guardado?.authorAvatar) {

                embed.setThumbnail(
                    guardado.authorAvatar
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
                error
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
                messageCache.get(
                    oldMessage.id
                );

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
                    textoAntes.substring(0, 897) +
                    "...";
            }

            if (textoDespues.length > 900) {

                textoDespues =
                    textoDespues.substring(0, 897) +
                    "...";
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
                                    : guardado?.authorId
                                        ? `<@${guardado.authorId}>`
                                        : "Desconocido"
                        },
                        {
                            name: "📍 Canal",
                            value:
                                oldMessage.channel
                                    ? `${oldMessage.channel}`
                                    : "Desconocido"
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

            guardarMensaje(
                newMessage
            );

        } catch (error) {

            console.error(
                "❌ ERROR MESSAGE UPDATE:",
                error
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
                        "🫶 Esperamos que disfrutes del servidor y la pases genial."
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
                error
            );
        }
    }
);

// =====================================================
// USUARIO SALE
// =====================================================

client.on(
    "guildMemberRemove",
    async member => {

        try {

            const avatar =
                member.user.displayAvatarURL({
                    extension: "png",
                    size: 1024
                });

            const embed =
                new EmbedBuilder()
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
                            value:
                                member.id
                        }
                    )
                    .setTimestamp();

            await enviarLog(
                member.guild,
                embed
            );

        } catch (error) {

            console.error(
                "❌ ERROR SALIDA:",
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

        // =================================================
        // VERIFICACIÓN
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId ===
            "verificar_usuario"
        ) {

            try {

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
                            "❌ El rol de verificado debe estar por debajo del rol del bot.",
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
                        .setTitle(
                            "🛡️ USUARIO VERIFICADO"
                        )
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

            } catch (error) {

                console.error(
                    "❌ ERROR VERIFICACIÓN:",
                    error
                );

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp({
                        content:
                            "❌ No pude completar la verificación.",
                        ephemeral: true
                    });

                } else {

                    await interaction.reply({
                        content:
                            "❌ No pude completar la verificación.",
                        ephemeral: true
                    });
                }
            }

            return;
        }

        // =================================================
        // CREAR TICKET
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId ===
            "crear_ticket"
        ) {

            try {

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
                            "❌ La categoría de tickets no existe o el ID no corresponde a una categoría."
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

                        name: nombre,

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
                        .setTitle(
                            "🎫 TICKET CREADO"
                        )
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
                            },
                            {
                                name: "🆔 Usuario ID",
                                value:
                                    interaction.user.id
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    guild,
                    embed
                );

            } catch (error) {

                console.error(
                    "❌ ERROR CREANDO TICKET:",
                    error
                );

                if (
                    interaction.deferred ||
                    interaction.replied
                ) {

                    await interaction.editReply({
                        content:
                            "❌ No pude crear el ticket. Revisá los permisos del bot."
                    });

                } else {

                    await interaction.reply({
                        content:
                            "❌ No pude crear el ticket.",
                        ephemeral: true
                    });
                }
            }

            return;
        }

        // =================================================
        // CERRAR TICKET
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId ===
            "cerrar_ticket"
        ) {

            try {

                const canal =
                    interaction.channel;

                if (
                    !canal ||
                    canal.type !==
                    ChannelType.GuildText
                ) {

                    return interaction.reply({
                        content:
                            "❌ Este botón solo puede utilizarse dentro de un ticket.",
                        ephemeral: true
                    });
                }

                const esTicket =
                    canal.parentId ===
                    TICKET_CATEGORY_ID;

                if (!esTicket) {

                    return interaction.reply({
                        content:
                            "❌ Este canal no es un ticket.",
                        ephemeral: true
                    });
                }

                const puedeCerrar =

                    interaction.member.roles.cache.has(
                        STAFF_ROLE_ID
                    ) ||

                    interaction.member.roles.cache.has(
                        MOD_ROLE_ID
                    ) ||

                    interaction.member.roles.cache.has(
                        OWNER_ROLE_ID
                    ) ||

                    interaction.guild.ownerId ===
                        interaction.user.id;

                if (!puedeCerrar) {

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
                        .setTitle(
                            "🔒 TICKET CERRADO"
                        )
                        .addFields(
                            {
                                name: "📍 Ticket",
                                value:
                                    `${canal.name}`
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
                                error
                            );
                        }

                    },
                    3000
                );

            } catch (error) {

                console.error(
                    "❌ ERROR CERRANDO TICKET:",
                    error
                );
            }

            return;
        }

        // =================================================
        // COMANDOS
        // =================================================

        if (!interaction.isChatInputCommand()) {
            return;
        }

        try {

            // =================================================
            // /IP
            // =================================================

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

            // =================================================
            // /BAN
            // =================================================

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

                await miembro.ban({
                    reason:
                        `Ban aplicado por ${interaction.user.tag}`
                });

                await interaction.reply({
                    content:
                        `🔨 ${usuario} fue baneado correctamente.`
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle(
                            "🔨 USUARIO BANEADO"
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

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            // =================================================
            // /MUTE
            // =================================================

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

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle(
                            "🔇 USUARIO SILENCIADO"
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

                await enviarLog(
                    interaction.guild,
                    embed
                );

                return;
            }

            // =================================================
            // /UNMUTE
            // =================================================

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

                await miembro.timeout(
                    null,
                    `Mute quitado por ${interaction.user.tag}`
                );

                await interaction.reply({
                    content:
                        `🔊 ${usuario} ya puede volver a hablar.`
                });

                return;
            }

            // =================================================
            // /UNBAN
            // =================================================

            if (
                interaction.commandName ===
                "unban"
            ) {

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

                return;
            }

            // =================================================
            // /LOCK
            // =================================================

            if (
                interaction.commandName ===
                "lock"
            ) {

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
                            "❌ No tenés permisos para bloquear este canal."
                    });
                }

                const canal =
                    interaction.channel;

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

                const embed =
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle(
                            "🔒 CANAL BLOQUEADO"
                        )
                        .setDescription(
                            "🚫 Nadie puede enviar mensajes.\n" +
                            "👁️ Todos pueden seguir viendo el canal.\n" +
                            "👑 El Owner puede escribir."
                        )
                        .setTimestamp();

                await interaction.editReply({
                    embeds: [embed]
                });

                return;
            }

            // =================================================
            // /UNLOCK
            // =================================================

            if (
                interaction.commandName ===
                "unlock"
            ) {

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
                            "❌ No tenés permisos para desbloquear este canal."
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

                const embed =
                    new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(
                            "🔓 CANAL DESBLOQUEADO"
                        )
                        .setDescription(
                            "El canal volvió a permitir mensajes."
                        )
                        .setTimestamp();

                await interaction.editReply({
                    embeds: [embed]
                });

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
    }
);

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
