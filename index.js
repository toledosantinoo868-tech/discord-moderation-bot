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
        console.error("❌ ERROR CARGANDO DATA:", error);
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
        console.error("❌ ERROR GUARDANDO DATA:", error);
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

            categories: {
                tickets: null
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
// ANTI SPAM
// =====================================================

const spamTracker = new Map();

const SPAM_MESSAGE_LIMIT = 5;
const SPAM_WINDOW = 5000;
const SPAM_TIMEOUT = 30000;

// =====================================================
// PERMISOS
// =====================================================

function esOwner(interaction) {
    if (!interaction.guild) return false;

    const config = obtenerConfig(
        interaction.guild.id
    );

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
    if (!interaction.guild) return false;

    const config = obtenerConfig(
        interaction.guild.id
    );

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
// DURACIONES
// =====================================================

function convertirDuracion(entrada) {
    if (
        !entrada ||
        typeof entrada !== "string"
    ) {
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

        if (!config.channels.logs) return;

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
            "❌ ERROR ENVIANDO LOG:",
            error.message || error
        );
    }
}

// =====================================================
// PANEL VERIFICACIÓN
// =====================================================

function crearPanelVerificacion(guildName) {
    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle("🛡️ VERIFICACIÓN")
        .setDescription(
            `¡Bienvenido/a a **${guildName}**! 💜\n\n` +
            "Para acceder al servidor, primero tenés que verificarte.\n\n" +
            "Presioná **✅ Verificar** para recibir automáticamente el rol de verificado.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🟢 **Presioná el botón de abajo para verificarte.**"
        )
        .setFooter({
            text: `${guildName} • Verificación`
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
            new ActionRowBuilder().addComponents(boton)
        ]
    };
}

// =====================================================
// PANEL TICKETS
// =====================================================

function crearPanelTickets(guildName) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("🎫 SOPORTE")
        .setDescription(
            `¿Necesitás ayuda en **${guildName}**? 💜\n\n` +
            "Presioná **🎫 Crear ticket** para contactar con el equipo.\n\n" +
            "🔒 El ticket será privado.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🟢 **Presioná el botón para abrir un ticket.**"
        )
        .setFooter({
            text: `${guildName} • Sistema de soporte`
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
            new ActionRowBuilder().addComponents(boton)
        ]
    };
}

// =====================================================
// MENSAJE TICKET
// =====================================================

function crearMensajeTicket(member) {
    const embed = new EmbedBuilder()
        .setColor(0x8E44AD)
        .setTitle("🎫 TICKET DE SOPORTE")
        .setDescription(
            `Hola ${member} 💜\n\n` +
            "Tu ticket fue creado correctamente.\n\n" +
            "📌 Explicá detalladamente el motivo de tu consulta.\n\n" +
            "🛡️ El equipo te atenderá lo antes posible.\n\n" +
            "Cuando el problema esté solucionado, un miembro del Staff puede cerrar el ticket."
        )
        .setFooter({
            text: "Sistema de soporte"
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
            new ActionRowBuilder().addComponents(cerrar)
        ]
    };
}

// =====================================================
// BUSCAR O CREAR ROL
// =====================================================

async function obtenerOCrearRol(guild, nombre, opciones = {}) {
    let rol = guild.roles.cache.find(
        r => r.name.toLowerCase() === nombre.toLowerCase()
    );

    if (rol) {
        return rol;
    }

    rol = await guild.roles.create({
        name: nombre,
        color: opciones.color || null,
        reason: "Configuración automática del bot"
    });

    return rol;
}

// =====================================================
// BUSCAR O CREAR CATEGORÍA
// =====================================================

async function obtenerOCrearCategoria(guild, nombre) {
    let categoria = guild.channels.cache.find(
        canal =>
            canal.type === ChannelType.GuildCategory &&
            canal.name.toLowerCase() === nombre.toLowerCase()
    );

    if (categoria) {
        return categoria;
    }

    categoria = await guild.channels.create({
        name: nombre,
        type: ChannelType.GuildCategory,
        reason: "Configuración automática del bot"
    });

    return categoria;
}

// =====================================================
// BUSCAR O CREAR CANAL
// =====================================================

async function obtenerOCrearCanal(
    guild,
    nombre,
    categoria = null,
    opciones = {}
) {
    let canal = guild.channels.cache.find(
        c =>
            c.type === ChannelType.GuildText &&
            c.name.toLowerCase() === nombre.toLowerCase() &&
            (!categoria || c.parentId === categoria.id)
    );

    if (canal) {
        return canal;
    }

    canal = await guild.channels.create({
        name: nombre,
        type: ChannelType.GuildText,
        parent: categoria?.id || null,
        topic: opciones.topic || undefined,
        reason: "Configuración automática del bot"
    });

    return canal;
}

// =====================================================
// SETUP AUTOMÁTICO
// =====================================================

async function ejecutarSetup(guild) {
    const config = obtenerConfig(guild.id);

    // ---------------------------------------------
    // ROL VERIFICADO
    // ---------------------------------------------

    const rolVerificado = await obtenerOCrearRol(
        guild,
        "Verificado",
        {
            color: 0x57F287
        }
    );

    config.roles.verify = rolVerificado.id;

    // ---------------------------------------------
    // CATEGORÍA TICKETS
    // ---------------------------------------------

    const categoriaTickets =
        await obtenerOCrearCategoria(
            guild,
            "🎫 TICKETS"
        );

    config.tickets.category =
        categoriaTickets.id;

    config.categories.tickets =
        categoriaTickets.id;

    // ---------------------------------------------
    // CANAL VERIFICACIÓN
    // ---------------------------------------------

    const canalVerificacion =
        await obtenerOCrearCanal(
            guild,
            "verificacion"
        );

    config.channels.verify =
        canalVerificacion.id;

    config.verification.enabled =
        true;

    // ---------------------------------------------
    // CANAL BIENVENIDA
    // ---------------------------------------------

    const canalBienvenida =
        await obtenerOCrearCanal(
            guild,
            "bienvenida"
        );

    config.channels.welcome =
        canalBienvenida.id;

    config.welcome.enabled =
        true;

    // ---------------------------------------------
    // CANAL LOGS
    // ---------------------------------------------

    const canalLogs =
        await obtenerOCrearCanal(
            guild,
            "logs"
        );

    config.channels.logs =
        canalLogs.id;

    // ---------------------------------------------
    // CANAL TICKETS
    // ---------------------------------------------

    const canalTickets =
        await obtenerOCrearCanal(
            guild,
            "tickets"
        );

    config.channels.ticketPanel =
        canalTickets.id;

    guardarDatos();

    // ---------------------------------------------
    // PERMISOS DEL CANAL DE VERIFICACIÓN
    // ---------------------------------------------

    try {
        await canalVerificacion.permissionOverwrites.edit(
            guild.roles.everyone,
            {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            }
        );
    } catch {}

    // ---------------------------------------------
    // PERMISOS DEL CANAL DE TICKETS
    // ---------------------------------------------

    try {
        await canalTickets.permissionOverwrites.edit(
            guild.roles.everyone,
            {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            }
        );
    } catch {}

    // ---------------------------------------------
    // PUBLICAR PANEL VERIFICACIÓN
    // ---------------------------------------------

    try {
        await canalVerificacion.send(
            crearPanelVerificacion(guild.name)
        );
    } catch (error) {
        console.error(
            "❌ No se pudo enviar panel de verificación:",
            error.message
        );
    }

    // ---------------------------------------------
    // PUBLICAR PANEL TICKETS
    // ---------------------------------------------

    try {
        await canalTickets.send(
            crearPanelTickets(guild.name)
        );
    } catch (error) {
        console.error(
            "❌ No se pudo enviar panel de tickets:",
            error.message
        );
    }

    guardarDatos();

    return {
        rolVerificado,
        categoriaTickets,
        canalVerificacion,
        canalBienvenida,
        canalLogs,
        canalTickets
    };
}

// =====================================================
// COMANDOS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("setup")
        .setDescription(
            "Configura automáticamente todo el servidor."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    new SlashCommandBuilder()
        .setName("ip")
        .setDescription(
            "Muestra la IP del servidor de Minecraft."
        ),

    new SlashCommandBuilder()
        .setName("create")
        .setDescription(
            "Crea paneles y mensajes."
        )
        .addSubcommand(
            sub =>
                sub
                    .setName("verificacion")
                    .setDescription(
                        "Crea el panel de verificación."
                    )
        )
        .addSubcommand(
            sub =>
                sub
                    .setName("tickets")
                    .setDescription(
                        "Crea el panel de tickets."
                    )
        )
        .addSubcommand(
            sub =>
                sub
                    .setName("msj")
                    .setDescription(
                        "Crea un mensaje embed."
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName("texto")
                                .setDescription(
                                    "Texto del mensaje."
                                )
                                .setRequired(true)
                    )
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription(
            "Banea a un usuario."
        )
        .addUserOption(
            option =>
                option
                    .setName("usuario")
                    .setDescription("Usuario.")
                    .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription(
            "Silencia temporalmente."
        )
        .addUserOption(
            option =>
                option
                    .setName("usuario")
                    .setDescription("Usuario.")
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("duracion")
                    .setDescription(
                        "Ej: 30s, 5m, 1h, 1d."
                    )
                    .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription(
            "Quita el mute."
        )
        .addUserOption(
            option =>
                option
                    .setName("usuario")
                    .setDescription("Usuario.")
                    .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription(
            "Desbanea a un usuario."
        )
        .addStringOption(
            option =>
                option
                    .setName("id")
                    .setDescription(
                        "ID del usuario."
                    )
                    .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription(
            "Advierte a un usuario."
        )
        .addUserOption(
            option =>
                option
                    .setName("usuario")
                    .setDescription("Usuario.")
                    .setRequired(true)
        )
        .addStringOption(
            option =>
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
        .addUserOption(
            option =>
                option
                    .setName("usuario")
                    .setDescription("Usuario.")
                    .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription(
            "Elimina mensajes."
        )
        .addIntegerOption(
            option =>
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
        .addStringOption(
            option =>
                option
                    .setName("tiempo")
                    .setDescription(
                        "Ej: 5s, 1m, 5m."
                    )
                    .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription(
            "Bloquea canales."
        )
        .addSubcommand(
            sub =>
                sub
                    .setName("canal")
                    .setDescription(
                        "Bloquea este canal."
                    )
        )
        .addSubcommand(
            sub =>
                sub
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
        .addSubcommand(
            sub =>
                sub
                    .setName("canal")
                    .setDescription(
                        "Desbloquea este canal."
                    )
        )
        .addSubcommand(
            sub =>
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
    console.log("⚙️ /setup automático: ACTIVADO");
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

        const config =
            obtenerConfig(message.guild.id);

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

            const aviso =
                await message.channel.send({
                    content:
                        `🚫 ${message.author}, no está permitido enviar invitaciones de otros servidores.`
                });

            setTimeout(async () => {
                try {
                    await aviso.delete();
                } catch {}
            }, 5000);

            const embed =
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(
                        "🔗 INVITACIÓN BLOQUEADA"
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

        // ANTI SPAM

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

            const embed =
                new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(
                        "🛡️ ANTI-SPAM ACTIVADO"
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

        const avatar =
            member.displayAvatarURL({
                extension: "png",
                size: 1024
            });

        const embed =
            new EmbedBuilder()
                .setColor(0x8E44AD)
                .setTitle(
                    "🫶︱BIENVENIDO/A"
                )
                .setDescription(
                    `💜 **¡Bienvenido/a ${member} a ${member.guild.name}!**\n\n` +
                    "🫶 Esperamos que disfrutes del servidor."
                )
                .setThumbnail(avatar)
                .setFooter({
                    text: member.guild.name
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
});

// =====================================================
// INTERACCIONES
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {
        try {

            // =================================================
            // BOTÓN VERIFICAR
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
                        `✅ ¡Listo! Recibiste ${rol}.`,
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
                            "❌ La categoría de tickets no existe."
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
                    try {
                        await canal.permissionOverwrites.edit(
                            roleId,
                            {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true,
                                ManageMessages: true
                            }
                        );
                    } catch {}
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

                if (
                    !esStaff(interaction)
                ) {
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
                                value: canal.name
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

            if (
                !interaction.isChatInputCommand()
            ) {
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

                await interaction.deferReply({
                    ephemeral: true
                });

                try {
                    const resultado =
                        await ejecutarSetup(guild);

                    return interaction.editReply({
                        content:
                            "✅ **CONFIGURACIÓN COMPLETADA**\n\n" +
                            `🛡️ Rol verificado: ${resultado.rolVerificado}\n` +
                            `🛡️ Verificación: ${resultado.canalVerificacion}\n` +
                            `🎫 Tickets: ${resultado.canalTickets}\n` +
                            `📁 Categoría: ${resultado.categoriaTickets}\n` +
                            `👋 Bienvenida: ${resultado.canalBienvenida}\n` +
                            `📋 Logs: ${resultado.canalLogs}\n\n` +
                            "💾 Todos los IDs fueron guardados automáticamente en `data.json`.\n\n" +
                            "🎉 Ya no necesitás configurar los IDs manualmente."
                    });
                } catch (error) {
                    console.error(
                        "❌ ERROR SETUP:",
                        error
                    );

                    return interaction.editReply({
                        content:
                            "❌ No se pudo completar el setup. Revisá que el bot tenga permisos de Administrador."
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
                            "❌ Este servidor todavía no configuró su IP.",
                        ephemeral: true
                    });
                }

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
                if (
                    !esOwner(interaction)
                ) {
                    return interaction.reply({
                        content:
                            "❌ Solo el Owner o Administrador puede usar este comando.",
                        ephemeral: true
                    });
                }

                const sub =
                    interaction.options.getSubcommand();

                if (
                    sub ===
                    "verificacion"
                ) {
                    if (
                        !config.verification.enabled ||
                        !config.channels.verify ||
                        !config.roles.verify
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Primero ejecutá `/setup`.",
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
                            guild.name
                        )
                    );

                    return interaction.reply({
                        content:
                            `✅ Panel de verificación creado en ${canal}.`,
                        ephemeral: true
                    });
                }

                if (
                    sub ===
                    "tickets"
                ) {
                    if (
                        !config.channels.ticketPanel ||
                        !config.tickets.category
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Primero ejecutá `/setup`.",
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
                            guild.name
                        )
                    );

                    return interaction.reply({
                        content:
                            `✅ Panel de tickets creado en ${canal}.`,
                        ephemeral: true
                    });
                }

                if (
                    sub ===
                    "msj"
                ) {
                    const texto =
                        interaction.options.getString(
                            "texto"
                        );

                    if (
                        texto.length >
                        4096
                    ) {
                        return interaction.reply({
                            content:
                                "❌ El mensaje no puede superar 4096 caracteres.",
                            ephemeral: true
                        });
                    }

                    const embed =
                        new EmbedBuilder()
                            .setColor(0x8E44AD)
                            .setDescription(
                                texto
                            )
                            .setFooter({
                                text:
                                    guild.name
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
            }

            // =================================================
            // COMANDOS STAFF
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
                if (
                    !esStaff(interaction)
                ) {
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

                if (
                    !config.warnings[
                        usuario.id
                    ]
                ) {
                    config.warnings[
                        usuario.id
                    ] = [];
                }

                config.warnings[
                    usuario.id
                ].push({
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
                            "⚠️ ADVERTENCIA"
                        )
                        .addFields(
                            {
                                name: "👤 Usuario",
                                value:
                                    `${usuario}`
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
                    config.warnings[
                        usuario.id
                    ] || [];

                if (
                    lista.length ===
                    0
                ) {
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
                        `🔊 ${usuario} ya puede hablar nuevamente.`
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
                        `🔓 Usuario \`${id}\` desbaneado correctamente.`
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
                            "🧹 MENSAJES ELIMINADOS"
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

                if (
                    segundos >
                    21600
                ) {
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
                        `🐢 Slowmode configurado en ${segundos} segundos.`
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

                if (
                    sub ===
                    "canal"
                ) {
                    const canal =
                        interaction.channel;

                    if (!canal) {
                        return interaction.editReply({
                            content:
                                "❌ No se encontró el canal."
                        });
                    }

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
                                ? "🔒 Canal bloqueado."
                                : "🔓 Canal desbloqueado."
                    });
                }

                if (
                    sub ===
                    "general"
                ) {
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
                                ? `🔒 ${cantidad} canales bloqueados.`
                                : `🔓 ${cantidad} canales desbloqueados.`
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
    }
);

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
