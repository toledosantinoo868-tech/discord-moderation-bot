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

const fs = require("fs");
const path = require("path");
const http = require("http");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const CLIENT_ID = "1552817688378605650";
const TOKEN = process.env.DISCORD_TOKEN;
const PORT = Number(process.env.PORT) || 10000;
const DATA_FILE = path.join(__dirname, "data.json");

// =====================================================
// BASE DE DATOS
// =====================================================

function cargarDatos() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, "{}");
        }

        return JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );
    } catch (error) {
        console.error("❌ Error cargando data:", error);
        return {};
    }
}

const database = cargarDatos();

function guardarDatos() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(database, null, 4)
        );
    } catch (error) {
        console.error("❌ Error guardando data:", error);
    }
}

function obtenerConfig(guildId) {
    if (!database[guildId]) {
        database[guildId] = {
            roles: {
                owner: null,
                staff: null,
                mod: null,
                verify: null
            },

            channels: {
                welcome: null,
                logs: null,
                verify: null,
                ticketPanel: null
            },

            tickets: {
                category: null
            },

            welcome: {
                enabled: false
            },

            verification: {
                enabled: false
            },

            ip: {
                enabled: false,
                address: null,
                port: null
            },

            warnings: {}
        };

        guardarDatos();
    }

    return database[guildId];
}

// =====================================================
// SERVIDOR HTTP
// =====================================================

const httpServer = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Discord bot online");
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor HTTP escuchando en puerto ${PORT}`);
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
// CACHE
// =====================================================

const messageCache = new Map();

// =====================================================
// ANTI-SPAM
// =====================================================

const spamTracker = new Map();

const SPAM_MESSAGE_LIMIT = 5;
const SPAM_WINDOW = 5000;
const SPAM_TIMEOUT = 30000;

// =====================================================
// UTILIDADES
// =====================================================

function nombreServidor(guild) {
    return guild?.name || "nuestro servidor";
}

function convertirDuracion(entrada) {
    if (!entrada || typeof entrada !== "string") {
        return null;
    }

    const match = entrada
        .trim()
        .match(/^(\d+)\s*(s|m|h|d)$/i);

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
// PERMISOS
// =====================================================

function esOwner(interaction) {
    if (!interaction.guild) {
        return false;
    }

    const config = obtenerConfig(interaction.guild.id);

    return (
        interaction.guild.ownerId === interaction.user.id ||
        (
            config.roles.owner &&
            interaction.member?.roles?.cache?.has(
                config.roles.owner
            )
        )
    );
}

function esStaff(interaction) {
    if (!interaction.guild) {
        return false;
    }

    const config = obtenerConfig(interaction.guild.id);

    return (
        esOwner(interaction) ||

        (
            config.roles.staff &&
            interaction.member?.roles?.cache?.has(
                config.roles.staff
            )
        ) ||

        (
            config.roles.mod &&
            interaction.member?.roles?.cache?.has(
                config.roles.mod
            )
        ) ||

        interaction.member?.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

function puedeModerar(interaction, miembro) {
    if (!interaction.guild || !miembro) {
        return false;
    }

    if (
        interaction.guild.ownerId ===
        interaction.user.id
    ) {
        return true;
    }

    if (
        miembro.id ===
        interaction.guild.ownerId
    ) {
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
        content: message.content || ""
    });

    if (messageCache.size > 5000) {
        const primero = messageCache.keys().next().value;

        if (primero) {
            messageCache.delete(primero);
        }
    }
}

// =====================================================
// LOGS
// =====================================================

async function enviarLog(guild, embed) {
    try {
        if (!guild) return;

        const config = obtenerConfig(guild.id);

        if (!config.channels.logs) {
            return;
        }

        const canal = await guild.channels.fetch(
            config.channels.logs
        );

        if (!canal || !canal.isTextBased()) {
            return;
        }

        await canal.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error(
            "❌ Error enviando log:",
            error.message || error
        );
    }
}

// =====================================================
// PANEL VERIFICACIÓN
// =====================================================

function crearPanelVerificacion(guild) {
    const nombre = nombreServidor(guild);

    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle(`🛡️ VERIFICACIÓN | ${nombre}`)
        .setDescription(
            `¡Bienvenido/a a **${nombre}**! 💜\n\n` +
            "Para acceder al servidor, necesitás completar la verificación.\n\n" +
            "Al presionar **Verificar**, recibirás automáticamente el rol correspondiente.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🟢 **Presioná el botón de abajo para comenzar.**"
        )
        .setFooter({
            text: `${nombre} • Sistema de verificación`
        })
        .setTimestamp();

    const boton = new ButtonBuilder()
        .setCustomId("verificar_usuario")
        .setLabel("Verificar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

    return {
        embeds: [embed],

        components: [
            new ActionRowBuilder()
                .addComponents(boton)
        ]
    };
}

// =====================================================
// PANEL TICKETS
// =====================================================

function crearPanelTickets(guild) {
    const nombre = nombreServidor(guild);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎫 SOPORTE | ${nombre}`)
        .setDescription(
            `¿Necesitás ayuda en **${nombre}**? 💜\n\n` +
            "Abrí un ticket para comunicarte de forma privada con el equipo.\n\n" +
            "🔒 El ticket será visible únicamente para vos y el equipo autorizado.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🟢 **Presioná el botón para abrir un ticket.**"
        )
        .setFooter({
            text: `${nombre} • Sistema de soporte`
        })
        .setTimestamp();

    const boton = new ButtonBuilder()
        .setCustomId("crear_ticket")
        .setLabel("Crear ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Success);

    return {
        embeds: [embed],

        components: [
            new ActionRowBuilder()
                .addComponents(boton)
        ]
    };
}

// =====================================================
// MENSAJE TICKET
// =====================================================

function crearMensajeTicket(member) {
    const guild = member.guild;
    const nombre = nombreServidor(guild);

    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle(`🎫 TICKET DE SOPORTE | ${nombre}`)
        .setDescription(
            `Hola ${member} 💜\n\n` +
            `Tu ticket en **${nombre}** fue creado correctamente.\n\n` +
            "📌 Explicá detalladamente el motivo de tu consulta.\n\n" +
            "🛡️ El equipo te atenderá lo antes posible.\n\n" +
            "Cuando tu consulta haya sido solucionada, un miembro autorizado podrá cerrar este ticket."
        )
        .setFooter({
            text: `${nombre} • Sistema de soporte`
        })
        .setTimestamp();

    const cerrar = new ButtonBuilder()
        .setCustomId("cerrar_ticket")
        .setLabel("Cerrar ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger);

    return {
        content: `${member}`,

        embeds: [embed],

        components: [
            new ActionRowBuilder()
                .addComponents(cerrar)
        ]
    };
}

// =====================================================
// COMANDOS
// =====================================================

const commands = [

    // IP
    new SlashCommandBuilder()
        .setName("ip")
        .setDescription(
            "Muestra la IP del servidor de Minecraft."
        ),

    // SETUP
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription(
            "Configura el bot para este servidor."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )

        .addSubcommand(sub =>
            sub
                .setName("bienvenida")
                .setDescription(
                    "Configura el canal de bienvenida."
                )
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(
                            "Canal donde se enviarán las bienvenidas."
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("verificacion")
                .setDescription(
                    "Configura el sistema de verificación."
                )
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(
                            "Canal de verificación."
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("rol")
                        .setDescription(
                            "Rol que recibirá el usuario."
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("logs")
                .setDescription(
                    "Configura el canal de logs."
                )
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(
                            "Canal de logs."
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("tickets")
                .setDescription(
                    "Configura el sistema de tickets."
                )
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(
                            "Canal donde estará el panel."
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("categoria")
                        .setDescription(
                            "Categoría donde se crearán los tickets."
                        )
                        .addChannelTypes(
                            ChannelType.GuildCategory
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("roles")
                .setDescription(
                    "Configura los roles del servidor."
                )
                .addRoleOption(option =>
                    option
                        .setName("owner")
                        .setDescription(
                            "Rol Owner."
                        )
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option
                        .setName("staff")
                        .setDescription(
                            "Rol Staff."
                        )
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option
                        .setName("mod")
                        .setDescription(
                            "Rol Moderador."
                        )
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("ip")
                .setDescription(
                    "Configura la IP de Minecraft."
                )
                .addStringOption(option =>
                    option
                        .setName("direccion")
                        .setDescription(
                            "IP o dominio."
                        )
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("puerto")
                        .setDescription(
                            "Puerto."
                        )
                        .setMinValue(1)
                        .setMaxValue(65535)
                        .setRequired(true)
                )
        ),

    // CREATE
    new SlashCommandBuilder()
        .setName("create")
        .setDescription(
            "Crea contenido del servidor."
        )

        .addSubcommand(sub =>
            sub
                .setName("verificacion")
                .setDescription(
                    "Publica el panel de verificación."
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("tickets")
                .setDescription(
                    "Publica el panel de tickets."
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("msj")
                .setDescription(
                    "Publica un mensaje personalizado."
                )
                .addStringOption(option =>
                    option
                        .setName("texto")
                        .setDescription(
                            "Texto del mensaje."
                        )
                        .setRequired(true)
                )
        ),

    // MODERACIÓN
    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Silencia temporalmente.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duracion")
                .setDescription(
                    "Ej: 30s, 5m, 1h, 1d."
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el mute.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario.")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID del usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Advierte a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("motivo")
                .setDescription("Motivo.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription(
            "Muestra las advertencias."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes.")
        .addIntegerOption(option =>
            option
                .setName("cantidad")
                .setDescription("Cantidad.")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription(
            "Configura slowmode."
        )
        .addStringOption(option =>
            option
                .setName("tiempo")
                .setDescription(
                    "Ej: 5s, 1m, 5m."
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Bloquea canales.")
        .addSubcommand(sub =>
            sub
                .setName("canal")
                .setDescription(
                    "Bloquea este canal."
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("general")
                .setDescription(
                    "Bloquea todos los canales."
                )
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea canales.")
        .addSubcommand(sub =>
            sub
                .setName("canal")
                .setDescription(
                    "Desbloquea este canal."
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("general")
                .setDescription(
                    "Desbloquea todos los canales."
                )
        )

].map(command => command.toJSON());

// =====================================================
// REGISTRAR COMANDOS
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

        console.log(
            `✅ ${commands.length} comandos registrados.`
        );
    } catch (error) {
        console.error(
            "❌ ERROR REGISTRANDO COMANDOS:",
            error
        );
    }
}

// =====================================================
// READY
// =====================================================

client.once("clientReady", () => {
    console.log("======================================");
    console.log(
        `✅ BOT CONECTADO: ${client.user.tag}`
    );
    console.log(
        `🏠 SERVIDORES: ${client.guilds.cache.size}`
    );
    console.log("⚙️ Sistema /setup: ACTIVADO");
    console.log("🛡️ Verificación: ACTIVADA");
    console.log("🎫 Tickets: ACTIVADOS");
    console.log("👋 Bienvenidas: ACTIVADAS");
    console.log("======================================");
});

// =====================================================
// MENSAJES
// =====================================================

client.on("messageCreate", async message => {
    try {
        if (!message.guild) return;
        if (message.author?.bot) return;

        guardarMensaje(message);

        const config = obtenerConfig(
            message.guild.id
        );

        const miembro = message.member;

        const protegido =
            miembro &&
            (
                (
                    config.roles.owner &&
                    miembro.roles.cache.has(
                        config.roles.owner
                    )
                ) ||
                (
                    config.roles.staff &&
                    miembro.roles.cache.has(
                        config.roles.staff
                    )
                ) ||
                (
                    config.roles.mod &&
                    miembro.roles.cache.has(
                        config.roles.mod
                    )
                ) ||
                miembro.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            );

        // INVITACIONES
        const invitacion =
            /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i
                .test(message.content || "");

        if (invitacion && !protegido) {
            try {
                await message.delete();
            } catch {}

            const aviso = await message.channel.send({
                content:
                    `🚫 ${message.author}, no está permitido enviar invitaciones de otros servidores.`
            });

            setTimeout(async () => {
                try {
                    await aviso.delete();
                } catch {}
            }, 5000);

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(
                    `🔗 INVITACIÓN BLOQUEADA | ${message.guild.name}`
                )
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${message.author}`
                    },
                    {
                        name: "📍 Canal",
                        value: `${message.channel}`
                    }
                )
                .setTimestamp();

            await enviarLog(
                message.guild,
                embed
            );

            return;
        }

        if (protegido) return;

        // ANTI-SPAM
        const clave =
            `${message.guild.id}:${message.author.id}`;

        const ahora = Date.now();

        let datos = spamTracker.get(clave);

        if (!datos) {
            datos = {
                mensajes: [],
                castigado: false
            };

            spamTracker.set(clave, datos);
        }

        datos.mensajes =
            datos.mensajes.filter(
                timestamp =>
                    ahora - timestamp <=
                    SPAM_WINDOW
            );

        datos.mensajes.push(ahora);

        if (
            datos.mensajes.length >=
                SPAM_MESSAGE_LIMIT &&
            !datos.castigado
        ) {
            datos.castigado = true;

            try {
                await miembro.timeout(
                    SPAM_TIMEOUT,
                    "Anti-spam automático"
                );
            } catch {}

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(
                    `🛡️ ANTI-SPAM | ${message.guild.name}`
                )
                .setDescription(
                    `${message.author} fue detectado enviando demasiados mensajes.`
                )
                .addFields(
                    {
                        name: "👤 Usuario",
                        value: `${message.author}`
                    },
                    {
                        name: "📊 Límite",
                        value:
                            `${SPAM_MESSAGE_LIMIT} mensajes / ${SPAM_WINDOW / 1000}s`
                    },
                    {
                        name: "🔇 Acción",
                        value:
                            "Timeout de 30 segundos"
                    }
                )
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

            setTimeout(async () => {
                try {
                    await aviso.delete();
                } catch {}
            }, 5000);

            setTimeout(() => {
                spamTracker.delete(clave);
            }, SPAM_WINDOW);
        }

    } catch (error) {
        console.error(
            "❌ ERROR MESSAGE CREATE:",
            error
        );
    }
});

// =====================================================
// BIENVENIDA
// =====================================================

client.on("guildMemberAdd", async member => {
    try {
        const config =
            obtenerConfig(member.guild.id);

        if (
            !config.welcome.enabled ||
            !config.channels.welcome
        ) {
            return;
        }

        const canal =
            await member.guild.channels.fetch(
                config.channels.welcome
            );

        if (!canal || !canal.isTextBased()) {
            return;
        }

        const nombre =
            nombreServidor(member.guild);

        const avatar =
            member.displayAvatarURL({
                extension: "png",
                size: 1024
            });

        const embed = new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle(
                `🫶 BIENVENIDO/A A ${nombre}`
            )
            .setDescription(
                `💜 **¡Bienvenido/a ${member}!**\n\n` +
                `Nos alegra tenerte en **${nombre}**.\n\n` +
                "📌 Leé las normas del servidor antes de participar.\n" +
                "🛡️ Completá la verificación si es necesaria.\n\n" +
                "¡Esperamos que disfrutes tu estadía!"
            )
            .setThumbnail(avatar)
            .setFooter({
                text: `${nombre} • Sistema de bienvenida`
            })
            .setTimestamp();

        await canal.send({
            content:
                `🎉 ¡Bienvenido/a ${member} a **${nombre}**!`,
            embeds: [embed]
        });

    } catch (error) {
        console.error(
            "❌ ERROR BIENVENIDA:",
            error
        );
    }
});

// =====================================================
// INTERACCIONES
// =====================================================

client.on("interactionCreate", async interaction => {
    try {

        // =================================================
        // VERIFICAR
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId ===
                "verificar_usuario"
        ) {
            const config =
                obtenerConfig(
                    interaction.guild.id
                );

            if (!config.roles.verify) {
                return interaction.reply({
                    content:
                        "❌ El sistema de verificación todavía no está configurado.",
                    ephemeral: true
                });
            }

            const miembro =
                interaction.member;

            const rol =
                await interaction.guild.roles.fetch(
                    config.roles.verify
                );

            if (!rol) {
                return interaction.reply({
                    content:
                        "❌ El rol configurado ya no existe.",
                    ephemeral: true
                });
            }

            if (
                miembro.roles.cache.has(
                    rol.id
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
                        "❌ El rol de verificación debe estar debajo del rol más alto del bot.",
                    ephemeral: true
                });
            }

            await miembro.roles.add(
                rol,
                "Verificación mediante botón"
            );

            await interaction.reply({
                content:
                    `✅ ¡Listo! Ya estás verificado/a en **${interaction.guild.name}** y recibiste ${rol}.`,
                ephemeral: true
            });

            const embed =
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(
                        `🛡️ USUARIO VERIFICADO | ${interaction.guild.name}`
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
                        },
                        {
                            name: "🛡️ Rol",
                            value:
                                `${rol}`
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
        // CREAR TICKET
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId ===
                "crear_ticket"
        ) {
            await interaction.deferReply({
                ephemeral: true
            });

            const config =
                obtenerConfig(
                    interaction.guild.id
                );

            if (!config.tickets.category) {
                return interaction.editReply({
                    content:
                        "❌ El sistema de tickets todavía no está configurado."
                });
            }

            const categoria =
                await interaction.guild.channels.fetch(
                    config.tickets.category
                );

            if (
                !categoria ||
                categoria.type !==
                    ChannelType.GuildCategory
            ) {
                return interaction.editReply({
                    content:
                        "❌ La categoría configurada no existe."
                });
            }

            const existente =
                interaction.guild.channels.cache.find(
                    canal =>
                        canal.parentId ===
                            config.tickets.category &&
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
                    .replace(
                        /[^a-z0-9-]/g,
                        ""
                    )
                    .substring(0, 80);

            const canal =
                await interaction.guild.channels.create({
                    name:
                        nombre ||
                        `ticket-${interaction.user.id}`,

                    type:
                        ChannelType.GuildText,

                    parent:
                        config.tickets.category,

                    topic:
                        `ticket:${interaction.user.id}`,

                    permissionOverwrites: [
                        {
                            id:
                                interaction.guild.roles.everyone.id,

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
                        }
                    ]
                });

            const rolesStaff = [
                config.roles.owner,
                config.roles.staff,
                config.roles.mod
            ].filter(Boolean);

            for (
                const roleId of rolesStaff
            ) {
                await canal.permissionOverwrites.edit(
                    roleId,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        ManageMessages: true
                    }
                );
            }

            await canal.send(
                crearMensajeTicket(
                    interaction.member
                )
            );

            await interaction.editReply({
                content:
                    `🎫 Ticket creado correctamente: ${canal}`
            });

            const embed =
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(
                        `🎫 TICKET CREADO | ${interaction.guild.name}`
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
        // CERRAR TICKET
        // =================================================

        if (
            interaction.isButton() &&
            interaction.customId ===
                "cerrar_ticket"
        ) {
            const canal =
                interaction.channel;

            const config =
                obtenerConfig(
                    interaction.guild.id
                );

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
                config.tickets.category
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
                    .setTitle(
                        `🔒 TICKET CERRADO | ${interaction.guild.name}`
                    )
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

            setTimeout(async () => {
                try {
                    await canal.delete(
                        "Ticket cerrado"
                    );
                } catch {}
            }, 3000);

            return;
        }

        // =================================================
        // SOLO SLASH COMMANDS
        // =================================================

        if (!interaction.isChatInputCommand()) {
            return;
        }

        const guild =
            interaction.guild;

        if (!guild) {
            return interaction.reply({
                content:
                    "❌ Este comando solo funciona en un servidor.",
                ephemeral: true
            });
        }

        const config =
            obtenerConfig(guild.id);

        // =================================================
        // SETUP
        // =================================================

        if (
            interaction.commandName ===
            "setup"
        ) {
            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Necesitás permisos de Administrador.",
                    ephemeral: true
                });
            }

            const sub =
                interaction.options.getSubcommand();

            // BIENVENIDA
            if (sub === "bienvenida") {
                const canal =
                    interaction.options.getChannel(
                        "canal"
                    );

                config.channels.welcome =
                    canal.id;

                config.welcome.enabled =
                    true;

                guardarDatos();

                return interaction.reply({
                    content:
                        `✅ **BIENVENIDAS CONFIGURADAS**\n\n` +
                        `🏠 Servidor: **${guild.name}**\n` +
                        `📍 Canal: ${canal}\n\n` +
                        `Ahora podés recibir automáticamente a los nuevos miembros.`,
                    ephemeral: true
                });
            }

            // VERIFICACIÓN
            if (sub === "verificacion") {
                const canal =
                    interaction.options.getChannel(
                        "canal"
                    );

                const rol =
                    interaction.options.getRole(
                        "rol"
                    );

                config.channels.verify =
                    canal.id;

                config.roles.verify =
                    rol.id;

                config.verification.enabled =
                    true;

                guardarDatos();

                return interaction.reply({
                    content:
                        `✅ **VERIFICACIÓN CONFIGURADA**\n\n` +
                        `🏠 Servidor: **${guild.name}**\n` +
                        `📍 Canal: ${canal}\n` +
                        `🛡️ Rol: ${rol}\n\n` +
                        `Ahora podés usar **/create verificacion** para publicar el panel.`,
                    ephemeral: true
                });
            }

            // LOGS
            if (sub === "logs") {
                const canal =
                    interaction.options.getChannel(
                        "canal"
                    );

                config.channels.logs =
                    canal.id;

                guardarDatos();

                return interaction.reply({
                    content:
                        `✅ **LOGS CONFIGURADOS**\n\n` +
                        `🏠 Servidor: **${guild.name}**\n` +
                        `📍 Canal: ${canal}\n\n` +
                        `Los eventos del bot se registrarán allí.`,
                    ephemeral: true
                });
            }

            // TICKETS
            if (sub === "tickets") {
                const canal =
                    interaction.options.getChannel(
                        "canal"
                    );

                const categoria =
                    interaction.options.getChannel(
                        "categoria"
                    );

                config.channels.ticketPanel =
                    canal.id;

                config.tickets.category =
                    categoria.id;

                guardarDatos();

                return interaction.reply({
                    content:
                        `✅ **TICKETS CONFIGURADOS**\n\n` +
                        `🏠 Servidor: **${guild.name}**\n` +
                        `🎫 Panel: ${canal}\n` +
                        `📁 Categoría: ${categoria}\n\n` +
                        `Ahora podés usar **/create tickets**.`,
                    ephemeral: true
                });
            }

            // ROLES
            if (sub === "roles") {
                const owner =
                    interaction.options.getRole(
                        "owner"
                    );

                const staff =
                    interaction.options.getRole(
                        "staff"
                    );

                const mod =
                    interaction.options.getRole(
                        "mod"
                    );

                if (owner) {
                    config.roles.owner =
                        owner.id;
                }

                if (staff) {
                    config.roles.staff =
                        staff.id;
                }

                if (mod) {
                    config.roles.mod =
                        mod.id;
                }

                guardarDatos();

                return interaction.reply({
                    content:
                        `✅ **ROLES CONFIGURADOS**\n\n` +
                        `🏠 Servidor: **${guild.name}**\n\n` +
                        `👑 Owner: ${owner || "Sin modificar"}\n` +
                        `🛡️ Staff: ${staff || "Sin modificar"}\n` +
                        `🔨 Moderador: ${mod || "Sin modificar"}`,
                    ephemeral: true
                });
            }

            // IP
            if (sub === "ip") {
                const direccion =
                    interaction.options.getString(
                        "direccion"
                    );

                const puerto =
                    interaction.options.getInteger(
                        "puerto"
                    );

                config.ip.enabled = true;
                config.ip.address = direccion;
                config.ip.port = puerto;

                guardarDatos();

                return interaction.reply({
                    content:
                        `✅ **IP CONFIGURADA**\n\n` +
                        `🏠 Servidor: **${guild.name}**\n` +
                        `🌐 IP: \`${direccion}\`\n` +
                        `🔌 Puerto: \`${puerto}\``,
                    ephemeral: true
                });
            }
        }

        // =================================================
        // IP
        // =================================================

        if (
            interaction.commandName ===
            "ip"
        ) {
            if (
                !config.ip.enabled ||
                !config.ip.address
            ) {
                return interaction.reply({
                    content:
                        "❌ Este servidor todavía no configuró su IP.\n\nUsá `/setup ip`.",
                    ephemeral: true
                });
            }

            const embed =
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle(
                        `🎮 ${guild.name} | SERVIDOR DE MINECRAFT`
                    )
                    .setDescription(
                        "Conectate al servidor utilizando estos datos:"
                    )
                    .addFields(
                        {
                            name: "🌐 IP",
                            value:
                                `\`${config.ip.address}\``
                        },
                        {
                            name: "🔌 PUERTO",
                            value:
                                `\`${config.ip.port}\``
                        }
                    )
                    .setFooter({
                        text: guild.name
                    })
                    .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // CREATE
        // =================================================

        if (
            interaction.commandName ===
            "create"
        ) {
            if (!esOwner(interaction)) {
                return interaction.reply({
                    content:
                        "❌ Solo el Owner, el rol configurado como Owner o un Administrador puede usar este comando.",
                    ephemeral: true
                });
            }

            const sub =
                interaction.options.getSubcommand();

            // VERIFICACIÓN
            if (sub === "verificacion") {
                if (
                    !config.verification.enabled ||
                    !config.channels.verify ||
                    !config.roles.verify
                ) {
                    return interaction.reply({
                        content:
                            "❌ Primero configurá `/setup verificacion`.",
                        ephemeral: true
                    });
                }

                const canal =
                    await guild.channels.fetch(
                        config.channels.verify
                    );

                if (
                    !canal ||
                    !canal.isTextBased()
                ) {
                    return interaction.reply({
                        content:
                            "❌ El canal configurado no existe.",
                        ephemeral: true
                    });
                }

                await canal.send(
                    crearPanelVerificacion(
                        guild
                    )
                );

                return interaction.reply({
                    content:
                        `✅ Panel de verificación publicado en ${canal} para **${guild.name}**.`,
                    ephemeral: true
                });
            }

            // TICKETS
            if (sub === "tickets") {
                if (
                    !config.channels.ticketPanel ||
                    !config.tickets.category
                ) {
                    return interaction.reply({
                        content:
                            "❌ Primero configurá `/setup tickets`.",
                        ephemeral: true
                    });
                }

                const canal =
                    await guild.channels.fetch(
                        config.channels.ticketPanel
                    );

                if (
                    !canal ||
                    !canal.isTextBased()
                ) {
                    return interaction.reply({
                        content:
                            "❌ El canal del panel no existe.",
                        ephemeral: true
                    });
                }

                await canal.send(
                    crearPanelTickets(
                        guild
                    )
                );

                return interaction.reply({
                    content:
                        `✅ Panel de tickets publicado en ${canal} para **${guild.name}**.`,
                    ephemeral: true
                });
            }

            // MENSAJE
            if (sub === "msj") {
                const texto =
                    interaction.options.getString(
                        "texto"
                    );

                if (texto.length > 4096) {
                    return interaction.reply({
                        content:
                            "❌ El mensaje no puede superar 4096 caracteres.",
                        ephemeral: true
                    });
                }

                const embed =
                    new EmbedBuilder()
                        .setColor(0x8E44AD)
                        .setTitle(
                            `📢 ${guild.name}`
                        )
                        .setDescription(texto)
                        .setFooter({
                            text: guild.name
                        })
                        .setTimestamp();

                await interaction.channel.send({
                    embeds: [embed]
                });

                return interaction.reply({
                    content:
                        `✅ Mensaje publicado correctamente en **${guild.name}**.`,
                    ephemeral: true
                });
            }
        }

        // =================================================
        // STAFF
        // =================================================

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

        // =================================================
        // WARN
        // =================================================

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
                await guild.members.fetch(
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
                        "❌ No podés moderar a un usuario con un rol igual o superior.",
                    ephemeral: true
                });
            }

            if (!config.warnings[usuario.id]) {
                config.warnings[usuario.id] = [];
            }

            config.warnings[usuario.id].push({
                motivo,
                moderador:
                    interaction.user.id,
                fecha:
                    Date.now()
            });

            guardarDatos();

            const embed =
                new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle(
                        `⚠️ ADVERTENCIA | ${guild.name}`
                    )
                    .addFields(
                        {
                            name: "👤 Usuario",
                            value: `${usuario}`
                        },
                        {
                            name: "📝 Motivo",
                            value: motivo
                        },
                        {
                            name: "📊 Advertencias",
                            value:
                                `${config.warnings[usuario.id].length}`
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
                guild,
                embed
            );

            return;
        }

        // =================================================
        // WARNINGS
        // =================================================

        if (
            interaction.commandName ===
            "warnings"
        ) {
            const usuario =
                interaction.options.getUser(
                    "usuario"
                );

            const lista =
                config.warnings[usuario.id] ||
                [];

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
                        `📋 ADVERTENCIAS | ${guild.name}`
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

        // =================================================
        // BAN
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
                await guild.members.fetch(
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
                        "❌ No podés banear a ese usuario.",
                    ephemeral: true
                });
            }

            await miembro.ban({
                reason:
                    `Ban por ${interaction.user.tag}`
            });

            const embed =
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(
                        `🔨 USUARIO BANEADO | ${guild.name}`
                    )
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

            await interaction.reply({
                embeds: [embed]
            });

            await enviarLog(
                guild,
                embed
            );

            return;
        }

        // =================================================
        // MUTE
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
                await guild.members.fetch(
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
                        "❌ No podés mutear a ese usuario.",
                    ephemeral: true
                });
            }

            const tiempo =
                convertirDuracion(
                    duracion
                );

            const maximo =
                28 *
                24 *
                60 *
                60 *
                1000;

            if (
                tiempo === null ||
                tiempo <= 0 ||
                tiempo > maximo
            ) {
                return interaction.reply({
                    content:
                        "❌ Usá una duración válida: `30s`, `5m`, `1h` o `1d`.",
                    ephemeral: true
                });
            }

            await miembro.timeout(
                tiempo,
                `Mute por ${interaction.user.tag}`
            );

            const embed =
                new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(
                        `🔇 USUARIO SILENCIADO | ${guild.name}`
                    )
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

            await interaction.reply({
                embeds: [embed]
            });

            await enviarLog(
                guild,
                embed
            );

            return;
        }

        // =================================================
        // UNMUTE
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
                await guild.members.fetch(
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

            return interaction.reply({
                content:
                    `🔊 ${usuario} ya puede hablar nuevamente en **${guild.name}**.`
            });
        }

        // =================================================
        // UNBAN
        // =================================================

        if (
            interaction.commandName ===
            "unban"
        ) {
            const id =
                interaction.options
                    .getString("id")
                    .trim();

            if (
                !/^\d{17,20}$/.test(id)
            ) {
                return interaction.reply({
                    content:
                        "❌ ID de Discord inválida.",
                    ephemeral: true
                });
            }

            await guild.members.unban(
                id,
                `Unban por ${interaction.user.tag}`
            );

            return interaction.reply({
                content:
                    `🔓 Usuario \`${id}\` desbaneado correctamente de **${guild.name}**.`
            });
        }

        // =================================================
        // CLEAR
        // =================================================

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
                    .setTitle(
                        `🧹 MENSAJES ELIMINADOS | ${guild.name}`
                    )
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
                guild,
                embed
            );

            return;
        }

        // =================================================
        // SLOWMODE
        // =================================================

        if (
            interaction.commandName ===
            "slowmode"
        ) {
            const entrada =
                interaction.options.getString(
                    "tiempo"
                );

            const tiempo =
                convertirDuracion(
                    entrada
                );

            if (tiempo === null) {
                return interaction.reply({
                    content:
                        "❌ Usá `5s`, `10s`, `1m`, `5m` o `1h`.",
                    ephemeral: true
                });
            }

            const segundos =
                Math.floor(
                    tiempo / 1000
                );

            if (segundos > 21600) {
                return interaction.reply({
                    content:
                        "❌ El máximo es 6 horas.",
                    ephemeral: true
                });
            }

            await interaction.channel.setRateLimitPerUser(
                segundos,
                `Slowmode por ${interaction.user.tag}`
            );

            return interaction.reply({
                content:
                    `🐢 Slowmode configurado en **${guild.name}**: ${segundos} segundos.`
            });
        }

        // =================================================
        // LOCK / UNLOCK
        // =================================================

        if (
            interaction.commandName ===
                "lock" ||
            interaction.commandName ===
                "unlock"
        ) {
            const sub =
                interaction.options.getSubcommand();

            const bloquear =
                interaction.commandName ===
                "lock";

            await interaction.deferReply();

            if (sub === "canal") {
                const canal =
                    interaction.channel;

                await canal.permissionOverwrites.edit(
                    guild.roles.everyone,
                    {
                        SendMessages:
                            bloquear
                                ? false
                                : null
                    }
                );

                return interaction.editReply({
                    content:
                        bloquear
                            ? `🔒 Canal bloqueado en **${guild.name}**.`
                            : `🔓 Canal desbloqueado en **${guild.name}**.`
                });
            }

            if (sub === "general") {
                const canales =
                    await guild.channels.fetch();

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
                        ].includes(
                            canal.type
                        )
                    ) {
                        continue;
                    }

                    try {
                        await canal.permissionOverwrites.edit(
                            guild.roles.everyone,
                            {
                                SendMessages:
                                    bloquear
                                        ? false
                                        : null
                            }
                        );

                        cantidad++;
                    } catch {}
                }

                return interaction.editReply({
                    content:
                        bloquear
                            ? `🔒 ${cantidad} canales bloqueados en **${guild.name}**.`
                            : `🔓 ${cantidad} canales desbloqueados en **${guild.name}**.`
                });
            }
        }

    } catch (error) {
        console.error(
            "❌ ERROR INTERACTION:",
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
});

// =====================================================
// ERRORES
// =====================================================

client.on("error", error => {
    console.error(
        "❌ ERROR DISCORD:",
        error
    );
});

client.on("warn", warning => {
    console.warn(
        "⚠️ DISCORD:",
        warning
    );
});

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
// TOKEN
// =====================================================

if (!TOKEN) {
    console.error(
        "❌ No existe DISCORD_TOKEN."
    );

    process.exit(1);
}

// =====================================================
// INICIAR
// =====================================================

(async () => {
    try {
        await registrarComandos();

        console.log(
            "🔐 Iniciando sesión..."
        );

        await client.login(TOKEN);

    } catch (error) {
        console.error(
            "❌ NO SE PUDO INICIAR EL BOT:"
        );

        console.error(error);

        process.exit(1);
    }
})();
