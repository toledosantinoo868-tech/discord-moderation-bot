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

// Opcional:
// Si ponés GUILD_ID como variable de entorno,
// los comandos se registran instantáneamente en ese servidor.
// Si no existe, se registran globalmente.
const GUILD_ID = process.env.GUILD_ID || null;

const DATA_FILE = path.join(__dirname, "data.json");

// =====================================================
// BASE DE DATOS
// =====================================================

function crearConfig() {
    return {
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
            enabled: false,
            message:
                "🎉 ¡Bienvenido/a {usuario} a **{servidor}**!"
        },

        verification: {
            enabled: false,
            title: "🛡️ VERIFICACIÓN",
            message:
                "¡Bienvenido/a a **{servidor}**!\n\nPara acceder al servidor, presioná el botón de abajo para verificarte."
        },

        ticket: {
            title: "🎫 SOPORTE",
            message:
                "¿Necesitás ayuda en **{servidor}**?\n\nPresioná el botón para crear un ticket privado."
        },

        ip: {
            enabled: false,
            address: null,
            port: null,
            title: "🎮 SERVIDOR DE MINECRAFT",
            message:
                "Conectate a nuestro servidor utilizando los siguientes datos:"
        },

        warnings: {}
    };
}

function cargarDatos() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify({}, null, 4)
            );
        }

        const contenido =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );

        return contenido.trim()
            ? JSON.parse(contenido)
            : {};
    } catch (error) {
        console.error(
            "❌ Error cargando data.json:",
            error
        );

        return {};
    }
}

const database = cargarDatos();

function guardarDatos() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                database,
                null,
                4
            )
        );
    } catch (error) {
        console.error(
            "❌ Error guardando data.json:",
            error
        );
    }
}

function obtenerConfig(guildId) {
    if (!database[guildId]) {
        database[guildId] = crearConfig();
        guardarDatos();
    }

    const config = database[guildId];

    // Compatibilidad con configuraciones viejas
    config.roles ??= {};
    config.channels ??= {};
    config.tickets ??= {};
    config.welcome ??= {};
    config.verification ??= {};
    config.ticket ??= {};
    config.ip ??= {};
    config.warnings ??= {};

    config.roles.owner ??= null;
    config.roles.staff ??= null;
    config.roles.mod ??= null;
    config.roles.verify ??= null;

    config.channels.welcome ??= null;
    config.channels.logs ??= null;
    config.channels.verify ??= null;
    config.channels.ticketPanel ??= null;

    config.tickets.category ??= null;

    config.welcome.enabled ??= false;
    config.welcome.message ??=
        "🎉 ¡Bienvenido/a {usuario} a **{servidor}**!";

    config.verification.enabled ??= false;
    config.verification.title ??=
        "🛡️ VERIFICACIÓN";
    config.verification.message ??=
        "¡Bienvenido/a a **{servidor}**!\n\nPara acceder al servidor, presioná el botón de abajo para verificarte.";

    config.ticket.title ??=
        "🎫 SOPORTE";
    config.ticket.message ??=
        "¿Necesitás ayuda en **{servidor}**?\n\nPresioná el botón para crear un ticket privado.";

    config.ip.enabled ??= false;
    config.ip.address ??= null;
    config.ip.port ??= null;
    config.ip.title ??=
        "🎮 SERVIDOR DE MINECRAFT";
    config.ip.message ??=
        "Conectate a nuestro servidor utilizando los siguientes datos:";

    return config;
}

// =====================================================
// FUNCIONES GENERALES
// =====================================================

function reemplazarVariables(texto, datos) {
    if (!texto) return "";

    return texto
        .replaceAll(
            "{usuario}",
            datos.usuario || ""
        )
        .replaceAll(
            "{servidor}",
            datos.servidor || ""
        )
        .replaceAll(
            "{ip}",
            datos.ip || ""
        )
        .replaceAll(
            "{puerto}",
            String(datos.puerto || "")
        );
}

function convertirDuracion(entrada) {
    if (
        !entrada ||
        typeof entrada !== "string"
    ) {
        return null;
    }

    const match =
        entrada
            .trim()
            .match(
                /^(\d+)\s*(s|m|h|d)$/i
            );

    if (!match) {
        return null;
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

    return (
        cantidad *
        multiplicadores[unidad]
    );
}

// =====================================================
// PERMISOS
// =====================================================

function esOwner(interaction) {
    if (!interaction.guild) {
        return false;
    }

    const config =
        obtenerConfig(
            interaction.guild.id
        );

    return (
        interaction.guild.ownerId ===
            interaction.user.id ||

        (
            config.roles.owner &&
            interaction.member?.roles?.cache?.has(
                config.roles.owner
            )
        ) ||

        interaction.member?.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

function esStaff(interaction) {
    if (!interaction.guild) {
        return false;
    }

    const config =
        obtenerConfig(
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
        )
    );
}

function puedeModerar(
    interaction,
    miembro
) {
    if (
        !interaction.guild ||
        !miembro
    ) {
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

    const ejecutor =
        interaction.member;

    if (!ejecutor) {
        return false;
    }

    return (
        miembro.roles.highest.position <
        ejecutor.roles.highest.position
    );
}

// =====================================================
// HTTP
// =====================================================

const httpServer =
    http.createServer(
        (req, res) => {
            res.writeHead(
                200,
                {
                    "Content-Type":
                        "text/plain; charset=utf-8"
                }
            );

            res.end(
                "Discord bot online"
            );
        }
    );

httpServer.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `🌐 Servidor HTTP escuchando en puerto ${PORT}`
        );
    }
);

// =====================================================
// CLIENTE DISCORD
// =====================================================

const client =
    new Client({
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
// LOGS
// =====================================================

async function enviarLog(
    guild,
    embed
) {
    try {
        if (!guild) return;

        const config =
            obtenerConfig(
                guild.id
            );

        if (
            !config.channels.logs
        ) {
            return;
        }

        const canal =
            await guild.channels.fetch(
                config.channels.logs
            );

        if (
            !canal ||
            !canal.isTextBased()
        ) {
            return;
        }

        await canal.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error(
            "❌ Error enviando log:",
            error.message ||
            error
        );
    }
}

// =====================================================
// PANELES
// =====================================================

function crearPanelVerificacion(
    guild,
    config
) {
    const titulo =
        reemplazarVariables(
            config.verification.title,
            {
                servidor:
                    guild.name
            }
        );

    const mensaje =
        reemplazarVariables(
            config.verification.message,
            {
                servidor:
                    guild.name
            }
        );

    const embed =
        new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle(titulo)
            .setDescription(
                `${mensaje}\n\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 **Presioná el botón de abajo para verificarte.**`
            )
            .setFooter({
                text:
                    `${guild.name} • Verificación`
            })
            .setTimestamp();

    const boton =
        new ButtonBuilder()
            .setCustomId(
                "verificar_usuario"
            )
            .setLabel(
                "Verificar"
            )
            .setEmoji("✅")
            .setStyle(
                ButtonStyle.Success
            );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    boton
                )
        ]
    };
}

function crearPanelTickets(
    guild,
    config
) {
    const titulo =
        reemplazarVariables(
            config.ticket.title,
            {
                servidor:
                    guild.name
            }
        );

    const mensaje =
        reemplazarVariables(
            config.ticket.message,
            {
                servidor:
                    guild.name
            }
        );

    const embed =
        new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(titulo)
            .setDescription(
                `${mensaje}\n\n🔒 El ticket será privado.\n\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 **Presioná el botón para abrir un ticket.**`
            )
            .setFooter({
                text:
                    `${guild.name} • Soporte`
            })
            .setTimestamp();

    const boton =
        new ButtonBuilder()
            .setCustomId(
                "crear_ticket"
            )
            .setLabel(
                "Crear ticket"
            )
            .setEmoji("🎫")
            .setStyle(
                ButtonStyle.Success
            );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    boton
                )
        ]
    };
}

function crearMensajeTicket(
    member
) {
    const embed =
        new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle(
                "🎫 TICKET DE SOPORTE"
            )
            .setDescription(
                `Hola ${member} 💜\n\n` +
                "Tu ticket fue creado correctamente.\n\n" +
                "📌 Explicá detalladamente tu consulta.\n\n" +
                "🛡️ El equipo te atenderá lo antes posible."
            )
            .setTimestamp();

    const cerrar =
        new ButtonBuilder()
            .setCustomId(
                "cerrar_ticket"
            )
            .setLabel(
                "Cerrar ticket"
            )
            .setEmoji("🔒")
            .setStyle(
                ButtonStyle.Danger
            );

    return {
        content:
            `${member}`,

        embeds: [embed],

        components: [
            new ActionRowBuilder()
                .addComponents(
                    cerrar
                )
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
            "Muestra la IP del servidor."
        )
        .setDMPermission(false),

    // SETUP
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription(
            "Configura el bot para este servidor."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )
        .setDMPermission(false)

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "bienvenida"
                    )
                    .setDescription(
                        "Configura el canal de bienvenida."
                    )
                    .addChannelOption(
                        option =>
                            option
                                .setName(
                                    "canal"
                                )
                                .setDescription(
                                    "Canal de bienvenida."
                                )
                                .addChannelTypes(
                                    ChannelType.GuildText
                                )
                                .setRequired(
                                    true
                                )
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "verificacion"
                    )
                    .setDescription(
                        "Configura la verificación."
                    )
                    .addChannelOption(
                        option =>
                            option
                                .setName(
                                    "canal"
                                )
                                .setDescription(
                                    "Canal de verificación."
                                )
                                .addChannelTypes(
                                    ChannelType.GuildText
                                )
                                .setRequired(
                                    true
                                )
                    )
                    .addRoleOption(
                        option =>
                            option
                                .setName(
                                    "rol"
                                )
                                .setDescription(
                                    "Rol que recibirá el usuario."
                                )
                                .setRequired(
                                    true
                                )
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "logs"
                    )
                    .setDescription(
                        "Configura los logs."
                    )
                    .addChannelOption(
                        option =>
                            option
                                .setName(
                                    "canal"
                                )
                                .setDescription(
                                    "Canal de logs."
                                )
                                .addChannelTypes(
                                    ChannelType.GuildText
                                )
                                .setRequired(
                                    true
                                )
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "tickets"
                    )
                    .setDescription(
                        "Configura los tickets."
                    )
                    .addChannelOption(
                        option =>
                            option
                                .setName(
                                    "canal"
                                )
                                .setDescription(
                                    "Canal del panel."
                                )
                                .addChannelTypes(
                                    ChannelType.GuildText
                                )
                                .setRequired(
                                    true
                                )
                    )
                    .addChannelOption(
                        option =>
                            option
                                .setName(
                                    "categoria"
                                )
                                .setDescription(
                                    "Categoría de los tickets."
                                )
                                .addChannelTypes(
                                    ChannelType.GuildCategory
                                )
                                .setRequired(
                                    true
                                )
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "roles"
                    )
                    .setDescription(
                        "Configura los roles."
                    )
                    .addRoleOption(
                        option =>
                            option
                                .setName(
                                    "owner"
                                )
                                .setDescription(
                                    "Rol Owner."
                                )
                                .setRequired(
                                    false
                                )
                    )
                    .addRoleOption(
                        option =>
                            option
                                .setName(
                                    "staff"
                                )
                                .setDescription(
                                    "Rol Staff."
                                )
                                .setRequired(
                                    false
                                )
                    )
                    .addRoleOption(
                        option =>
                            option
                                .setName(
                                    "mod"
                                )
                                .setDescription(
                                    "Rol Moderador."
                                )
                                .setRequired(
                                    false
                                )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "ip"
                    )
                    .setDescription(
                        "Configura la IP."
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName(
                                    "direccion"
                                )
                                .setDescription(
                                    "IP o dominio."
                                )
                                .setRequired(
                                    true
                                )
                    )
                    .addIntegerOption(
                        option =>
                            option
                                .setName(
                                    "puerto"
                                )
                                .setDescription(
                                    "Puerto."
                                )
                                .setMinValue(
                                    1
                                )
                                .setMaxValue(
                                    65535
                                )
                                .setRequired(
                                    true
                                )
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "mensajes"
                    )
                    .setDescription(
                        "Personaliza los mensajes del servidor."
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName(
                                    "tipo"
                                )
                                .setDescription(
                                    "Mensaje que querés modificar."
                                )
                                .addChoices(
                                    {
                                        name:
                                            "Bienvenida",
                                        value:
                                            "bienvenida"
                                    },
                                    {
                                        name:
                                            "Verificación",
                                        value:
                                            "verificacion"
                                    },
                                    {
                                        name:
                                            "Tickets",
                                        value:
                                            "tickets"
                                    },
                                    {
                                        name:
                                            "IP",
                                        value:
                                            "ip"
                                    }
                                )
                                .setRequired(
                                    true
                                )
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName(
                                    "texto"
                                )
                                .setDescription(
                                    "Nuevo texto."
                                )
                                .setRequired(
                                    true
                                )
                    )
        ),

    // CREATE
    new SlashCommandBuilder()
        .setName("create")
        .setDescription(
            "Crea paneles y mensajes."
        )
        .setDMPermission(false)

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "verificacion"
                    )
                    .setDescription(
                        "Crea el panel de verificación."
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "tickets"
                    )
                    .setDescription(
                        "Crea el panel de tickets."
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "msj"
                    )
                    .setDescription(
                        "Crea un mensaje personalizado."
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName(
                                    "texto"
                                )
                                .setDescription(
                                    "Texto del mensaje."
                                )
                                .setRequired(
                                    true
                                )
                    )
        ),

    // BAN
    new SlashCommandBuilder()
        .setName("ban")
        .setDescription(
            "Banea a un usuario."
        )
        .setDMPermission(false)
        .addUserOption(
            option =>
                option
                    .setName(
                        "usuario"
                    )
                    .setDescription(
                        "Usuario."
                    )
                    .setRequired(
                        true
                    )
        ),

    // MUTE
    new SlashCommandBuilder()
        .setName("mute")
        .setDescription(
            "Silencia temporalmente."
        )
        .setDMPermission(false)
        .addUserOption(
            option =>
                option
                    .setName(
                        "usuario"
                    )
                    .setDescription(
                        "Usuario."
                    )
                    .setRequired(
                        true
                    )
        )
        .addStringOption(
            option =>
                option
                    .setName(
                        "duracion"
                    )
                    .setDescription(
                        "Ej: 30s, 5m, 1h, 1d."
                    )
                    .setRequired(
                        true
                    )
        ),

    // UNMUTE
    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription(
            "Quita el mute."
        )
        .setDMPermission(false)
        .addUserOption(
            option =>
                option
                    .setName(
                        "usuario"
                    )
                    .setDescription(
                        "Usuario."
                    )
                    .setRequired(
                        true
                    )
        ),

    // UNBAN
    new SlashCommandBuilder()
        .setName("unban")
        .setDescription(
            "Desbanea a un usuario."
        )
        .setDMPermission(false)
        .addStringOption(
            option =>
                option
                    .setName(
                        "id"
                    )
                    .setDescription(
                        "ID del usuario."
                    )
                    .setRequired(
                        true
                    )
        ),

    // WARN
    new SlashCommandBuilder()
        .setName("warn")
        .setDescription(
            "Advierte a un usuario."
        )
        .setDMPermission(false)
        .addUserOption(
            option =>
                option
                    .setName(
                        "usuario"
                    )
                    .setDescription(
                        "Usuario."
                    )
                    .setRequired(
                        true
                    )
        )
        .addStringOption(
            option =>
                option
                    .setName(
                        "motivo"
                    )
                    .setDescription(
                        "Motivo."
                    )
                    .setRequired(
                        true
                    )
        ),

    // WARNINGS
    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription(
            "Muestra las advertencias."
        )
        .setDMPermission(false)
        .addUserOption(
            option =>
                option
                    .setName(
                        "usuario"
                    )
                    .setDescription(
                        "Usuario."
                    )
                    .setRequired(
                        true
                    )
        ),

    // CLEAR
    new SlashCommandBuilder()
        .setName("clear")
        .setDescription(
            "Elimina mensajes."
        )
        .setDMPermission(false)
        .addIntegerOption(
            option =>
                option
                    .setName(
                        "cantidad"
                    )
                    .setDescription(
                        "Cantidad de mensajes."
                    )
                    .setMinValue(
                        1
                    )
                    .setMaxValue(
                        100
                    )
                    .setRequired(
                        true
                    )
        ),

    // SLOWMODE
    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription(
            "Configura el slowmode."
        )
        .setDMPermission(false)
        .addStringOption(
            option =>
                option
                    .setName(
                        "tiempo"
                    )
                    .setDescription(
                        "Ej: 5s, 1m, 5m."
                    )
                    .setRequired(
                        true
                    )
        ),

    // LOCK
    new SlashCommandBuilder()
        .setName("lock")
        .setDescription(
            "Bloquea canales."
        )
        .setDMPermission(false)
        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "canal"
                    )
                    .setDescription(
                        "Bloquea este canal."
                    )
        )
        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "general"
                    )
                    .setDescription(
                        "Bloquea todos los canales."
                    )
        ),

    // UNLOCK
    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription(
            "Desbloquea canales."
        )
        .setDMPermission(false)
        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "canal"
                    )
                    .setDescription(
                        "Desbloquea este canal."
                    )
        )
        .addSubcommand(
            sub =>
                sub
                    .setName(
                        "general"
                    )
                    .setDescription(
                        "Desbloquea todos los canales."
                    )
        )

].map(
    command =>
        command.toJSON()
    );

// =====================================================
// REGISTRO DE COMANDOS
// =====================================================

const rest =
    new REST({
        version: "10"
    }).setToken(
        TOKEN
    );

async function registrarComandos() {
    try {
        console.log(
            "🔄 Registrando comandos..."
        );

        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(
                    CLIENT_ID,
                    GUILD_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                `✅ Comandos registrados en el servidor ${GUILD_ID}`
            );
        } else {
            await rest.put(
                Routes.applicationCommands(
                    CLIENT_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                "✅ Comandos registrados globalmente."
            );

            console.log(
                "ℹ️ Los comandos globales pueden tardar en actualizarse."
            );
        }
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

client.once(
    "clientReady",
    () => {
        console.log(
            "======================================"
        );

        console.log(
            `✅ BOT CONECTADO: ${client.user.tag}`
        );

        console.log(
            `🏠 SERVIDORES: ${client.guilds.cache.size}`
        );

        console.log(
            "⚙️ /setup ACTIVADO"
        );

        console.log(
            "🎫 Tickets ACTIVADOS"
        );

        console.log(
            "🛡️ Verificación ACTIVADA"
        );

        console.log(
            "👋 Bienvenidas ACTIVADAS"
        );

        console.log(
            "======================================"
        );
    }
);

// =====================================================
// BIENVENIDAS
// =====================================================

client.on(
    "guildMemberAdd",
    async member => {
        try {
            const config =
                obtenerConfig(
                    member.guild.id
                );

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

            if (
                !canal ||
                !canal.isTextBased()
            ) {
                return;
            }

            const mensaje =
                reemplazarVariables(
                    config.welcome.message,
                    {
                        usuario:
                            `${member}`,
                        servidor:
                            member.guild.name
                    }
                );

            const avatar =
                member.displayAvatarURL({
                    extension: "png",
                    size: 1024
                });

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0x8E44AD
                    )
                    .setDescription(
                        mensaje
                    )
                    .setThumbnail(
                        avatar
                    )
                    .setFooter({
                        text:
                            member.guild.name
                    })
                    .setTimestamp();

            await canal.send({
                embeds: [
                    embed
                ]
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
// MENSAJES
// =====================================================

client.on(
    "messageCreate",
    async message => {
        try {
            if (
                !message.guild ||
                message.author.bot
            ) {
                return;
            }

            const config =
                obtenerConfig(
                    message.guild.id
                );

            const miembro =
                message.member;

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

            // Anti invitaciones
            const invitacion =
                /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i
                    .test(
                        message.content || ""
                    );

            if (
                invitacion &&
                !protegido
            ) {
                try {
                    await message.delete();
                } catch {}

                const aviso =
                    await message.channel.send({
                        content:
                            `🚫 ${message.author}, no está permitido enviar invitaciones de otros servidores.`
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
                        .setColor(
                            0xED4245
                        )
                        .setTitle(
                            "🔗 INVITACIÓN BLOQUEADA"
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Usuario",
                                value:
                                    `${message.author}`
                            },
                            {
                                name:
                                    "📍 Canal",
                                value:
                                    `${message.channel}`
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    message.guild,
                    embed
                );
            }

        } catch (error) {
            console.error(
                "❌ ERROR MESSAGE:",
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

            // =================================================
            // BOTÓN VERIFICAR
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "verificar_usuario"
            ) {
                if (!interaction.guildId) {
                    return interaction.reply({
                        content:
                            "❌ Este botón solo puede utilizarse dentro de un servidor.",
                        ephemeral:
                            true
                    });
                }

                const guild =
                    interaction.guild;

                const config =
                    obtenerConfig(
                        guild.id
                    );

                if (
                    !config.roles.verify
                ) {
                    return interaction.reply({
                        content:
                            "❌ La verificación todavía no está configurada.",
                        ephemeral:
                            true
                    });
                }

                const miembro =
                    interaction.member;

                const rol =
                    await guild.roles.fetch(
                        config.roles.verify
                    );

                if (!rol) {
                    return interaction.reply({
                        content:
                            "❌ El rol de verificación ya no existe.",
                        ephemeral:
                            true
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
                        ephemeral:
                            true
                    });
                }

                const bot =
                    guild.members.me;

                if (
                    !bot ||
                    rol.position >=
                        bot.roles.highest.position
                ) {
                    return interaction.reply({
                        content:
                            "❌ El rol de verificación tiene que estar debajo del rol más alto del bot.",
                        ephemeral:
                            true
                    });
                }

                await miembro.roles.add(
                    rol,
                    "Verificación mediante botón"
                );

                await interaction.reply({
                    content:
                        `✅ ¡Listo! Recibiste ${rol}.`,
                    ephemeral:
                        true
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0x57F287
                        )
                        .setTitle(
                            "🛡️ USUARIO VERIFICADO"
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Usuario",
                                value:
                                    `${interaction.user}`
                            },
                            {
                                name:
                                    "🆔 ID",
                                value:
                                    interaction.user.id
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    guild,
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
                if (!interaction.guildId) {
                    return interaction.reply({
                        content:
                            "❌ Este botón solo puede utilizarse dentro de un servidor.",
                        ephemeral:
                            true
                    });
                }

                await interaction.deferReply({
                    ephemeral:
                        true
                });

                const guild =
                    interaction.guild;

                const config =
                    obtenerConfig(
                        guild.id
                    );

                if (
                    !config.tickets.category
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Primero configurá `/setup tickets`."
                    });
                }

                const categoria =
                    await guild.channels.fetch(
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
                    guild.channels.cache.find(
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
                        .substring(
                            0,
                            70
                        );

                const canal =
                    await guild.channels.create({
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
                        .setColor(
                            0x57F287
                        )
                        .setTitle(
                            "🎫 TICKET CREADO"
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Usuario",
                                value:
                                    `${interaction.user}`
                            },
                            {
                                name:
                                    "📍 Ticket",
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

            // =================================================
            // CERRAR TICKET
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "cerrar_ticket"
            ) {
                if (!interaction.guildId) {
                    return interaction.reply({
                        content:
                            "❌ Este botón solo funciona dentro de un servidor.",
                        ephemeral:
                            true
                    });
                }

                const guild =
                    interaction.guild;

                const canal =
                    interaction.channel;

                const config =
                    obtenerConfig(
                        guild.id
                    );

                if (
                    !canal ||
                    canal.type !==
                        ChannelType.GuildText
                ) {
                    return interaction.reply({
                        content:
                            "❌ Este canal no es válido.",
                        ephemeral:
                            true
                    });
                }

                if (
                    canal.parentId !==
                    config.tickets.category
                ) {
                    return interaction.reply({
                        content:
                            "❌ Este canal no es un ticket.",
                        ephemeral:
                            true
                    });
                }

                if (
                    !esStaff(
                        interaction
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Solo Staff, Moderadores u Owner pueden cerrar tickets.",
                        ephemeral:
                            true
                    });
                }

                await interaction.reply({
                    content:
                        "🔒 Cerrando ticket..."
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0xED4245
                        )
                        .setTitle(
                            "🔒 TICKET CERRADO"
                        )
                        .addFields(
                            {
                                name:
                                    "📍 Ticket",
                                value:
                                    canal.name
                            },
                            {
                                name:
                                    "👤 Cerrado por",
                                value:
                                    `${interaction.user}`
                            }
                        )
                        .setTimestamp();

                await enviarLog(
                    guild,
                    embed
                );

                setTimeout(
                    async () => {
                        try {
                            await canal.delete(
                                "Ticket cerrado"
                            );
                        } catch {}
                    },
                    2500
                );

                return;
            }

            // =================================================
            // IMPORTANTE:
            // TODOS LOS SLASH COMMANDS DE ABAJO
            // SOLO FUNCIONAN EN SERVIDORES.
            // =================================================

            if (
                !interaction.isChatInputCommand()
            ) {
                return;
            }

            if (!interaction.guildId) {
                return interaction.reply({
                    content:
                        "❌ Este comando solo puede utilizarse dentro de un servidor de Discord.",
                    ephemeral:
                        true
                });
            }

            const guild =
                interaction.guild;

            if (!guild) {
                return interaction.reply({
                    content:
                        "❌ No se pudo obtener el servidor.",
                    ephemeral:
                        true
                });
            }

            const config =
                obtenerConfig(
                    guild.id
                );

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
                        ephemeral:
                            true
                    });
                }

                const sub =
                    interaction.options.getSubcommand();

                // -----------------------------------------
                // BIENVENIDA
                // -----------------------------------------

                if (
                    sub ===
                    "bienvenida"
                ) {
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
                            `✅ Bienvenidas configuradas.\n\n👋 Canal: ${canal}`,
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // VERIFICACIÓN
                // -----------------------------------------

                if (
                    sub ===
                    "verificacion"
                ) {
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
                            `✅ Verificación configurada.\n\n` +
                            `📍 Canal: ${canal}\n` +
                            `🛡️ Rol: ${rol}`,
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // LOGS
                // -----------------------------------------

                if (
                    sub ===
                    "logs"
                ) {
                    const canal =
                        interaction.options.getChannel(
                            "canal"
                        );

                    config.channels.logs =
                        canal.id;

                    guardarDatos();

                    return interaction.reply({
                        content:
                            `✅ Logs configurados en ${canal}.`,
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // TICKETS
                // -----------------------------------------

                if (
                    sub ===
                    "tickets"
                ) {
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
                            `✅ Tickets configurados.\n\n` +
                            `🎫 Panel: ${canal}\n` +
                            `📁 Categoría: ${categoria}`,
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // ROLES
                // -----------------------------------------

                if (
                    sub ===
                    "roles"
                ) {
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
                            "✅ Roles configurados correctamente.",
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // IP
                // -----------------------------------------

                if (
                    sub ===
                    "ip"
                ) {
                    const direccion =
                        interaction.options.getString(
                            "direccion"
                        );

                    const puerto =
                        interaction.options.getInteger(
                            "puerto"
                        );

                    config.ip.enabled =
                        true;

                    config.ip.address =
                        direccion;

                    config.ip.port =
                        puerto;

                    guardarDatos();

                    return interaction.reply({
                        content:
                            `✅ IP configurada.\n\n` +
                            `🌐 IP: \`${direccion}\`\n` +
                            `🔌 Puerto: \`${puerto}\``,
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // MENSAJES PERSONALIZADOS
                // -----------------------------------------

                if (
                    sub ===
                    "mensajes"
                ) {
                    const tipo =
                        interaction.options.getString(
                            "tipo"
                        );

                    const texto =
                        interaction.options.getString(
                            "texto"
                        );

                    if (
                        texto.length >
                        4000
                    ) {
                        return interaction.reply({
                            content:
                                "❌ El texto no puede superar los 4000 caracteres.",
                            ephemeral:
                                true
                        });
                    }

                    if (
                        tipo ===
                        "bienvenida"
                    ) {
                        config.welcome.message =
                            texto;
                    }

                    if (
                        tipo ===
                        "verificacion"
                    ) {
                        config.verification.message =
                            texto;
                    }

                    if (
                        tipo ===
                        "tickets"
                    ) {
                        config.ticket.message =
                            texto;
                    }

                    if (
                        tipo ===
                        "ip"
                    ) {
                        config.ip.message =
                            texto;
                    }

                    guardarDatos();

                    return interaction.reply({
                        content:
                            `✅ Mensaje de **${tipo}** personalizado correctamente.`,
                        ephemeral:
                            true
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
                        ephemeral:
                            true
                    });
                }

                const titulo =
                    reemplazarVariables(
                        config.ip.title,
                        {
                            servidor:
                                guild.name,
                            ip:
                                config.ip.address,
                            puerto:
                                config.ip.port
                        }
                    );

                const mensaje =
                    reemplazarVariables(
                        config.ip.message,
                        {
                            servidor:
                                guild.name,
                            ip:
                                config.ip.address,
                            puerto:
                                config.ip.port
                        }
                    );

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0x57F287
                        )
                        .setTitle(
                            titulo
                        )
                        .setDescription(
                            mensaje
                        )
                        .addFields(
                            {
                                name:
                                    "🌐 IP",
                                value:
                                    `\`${config.ip.address}\``
                            },
                            {
                                name:
                                    "🔌 PUERTO",
                                value:
                                    `\`${config.ip.port}\``
                            }
                        )
                        .setFooter({
                            text:
                                guild.name
                        })
                        .setTimestamp();

                return interaction.reply({
                    embeds: [
                        embed
                    ]
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
                    !esOwner(
                        interaction
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Solo el Owner, Administrador o rol Owner puede utilizar este comando.",
                        ephemeral:
                            true
                    });
                }

                const sub =
                    interaction.options.getSubcommand();

                // -----------------------------------------
                // VERIFICACIÓN
                // -----------------------------------------

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
                                "❌ Primero configurá `/setup verificacion`.",
                            ephemeral:
                                true
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
                            ephemeral:
                                true
                        });
                    }

                    await canal.send(
                        crearPanelVerificacion(
                            guild,
                            config
                        )
                    );

                    return interaction.reply({
                        content:
                            `✅ Panel de verificación creado en ${canal}.`,
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // TICKETS
                // -----------------------------------------

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
                                "❌ Primero configurá `/setup tickets`.",
                            ephemeral:
                                true
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
                                "❌ El canal configurado no existe.",
                            ephemeral:
                                true
                        });
                    }

                    await canal.send(
                        crearPanelTickets(
                            guild,
                            config
                        )
                    );

                    return interaction.reply({
                        content:
                            `✅ Panel de tickets creado en ${canal}.`,
                        ephemeral:
                            true
                    });
                }

                // -----------------------------------------
                // MENSAJE
                // -----------------------------------------

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
                            ephemeral:
                                true
                        });
                    }

                    const embed =
                        new EmbedBuilder()
                            .setColor(
                                0x8E44AD
                            )
                            .setDescription(
                                texto
                            )
                            .setFooter({
                                text:
                                    guild.name
                            })
                            .setTimestamp();

                    await interaction.channel.send({
                        embeds: [
                            embed
                        ]
                    });

                    return interaction.reply({
                        content:
                            "✅ Mensaje creado correctamente.",
                        ephemeral:
                            true
                    });
                }
            }

            // =================================================
            // COMANDOS DE STAFF
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
                ) &&
                !esStaff(
                    interaction
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ No tenés permisos para utilizar este comando.",
                    ephemeral:
                        true
                });
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
                        ephemeral:
                            true
                    });
                }

                config.warnings[
                    usuario.id
                ] ??= [];

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

                const cantidad =
                    config.warnings[
                        usuario.id
                    ].length;

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0xF1C40F
                        )
                        .setTitle(
                            "⚠️ ADVERTENCIA"
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Usuario",
                                value:
                                    `${usuario}`
                            },
                            {
                                name:
                                    "📝 Motivo",
                                value:
                                    motivo
                            },
                            {
                                name:
                                    "📊 Advertencias",
                                value:
                                    `${cantidad}`
                            },
                            {
                                name:
                                    "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
                        .setTimestamp();

                await interaction.reply({
                    embeds: [
                        embed
                    ]
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
                        ephemeral:
                            true
                    });
                }

                const texto =
                    lista
                        .map(
                            (warn, index) =>
                                `**${index + 1}.** ${warn.motivo}\n<@${warn.moderador}> • <t:${Math.floor(warn.fecha / 1000)}:R>`
                        )
                        .join(
                            "\n\n"
                        );

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0xF1C40F
                        )
                        .setTitle(
                            "📋 HISTORIAL DE ADVERTENCIAS"
                        )
                        .setDescription(
                            `**Usuario:** ${usuario}\n\n${texto}`
                        )
                        .setTimestamp();

                return interaction.reply({
                    embeds: [
                        embed
                    ],
                    ephemeral:
                        true
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
                        ephemeral:
                            true
                    });
                }

                await miembro.ban({
                    reason:
                        `Ban por ${interaction.user.tag}`
                });

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0xED4245
                        )
                        .setTitle(
                            "🔨 USUARIO BANEADO"
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Usuario",
                                value:
                                    `${usuario}`
                            },
                            {
                                name:
                                    "🆔 ID",
                                value:
                                    usuario.id
                            },
                            {
                                name:
                                    "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
                        .setTimestamp();

                await interaction.reply({
                    embeds: [
                        embed
                    ]
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
                            "❌ Usá una duración válida: `30s`, `5m`, `1h` o `1d`. Máximo 28 días.",
                        ephemeral:
                            true
                    });
                }

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
                        ephemeral:
                            true
                    });
                }

                await miembro.timeout(
                    tiempo,
                    `Mute por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0x5865F2
                        )
                        .setTitle(
                            "🔇 USUARIO SILENCIADO"
                        )
                        .addFields(
                            {
                                name:
                                    "👤 Usuario",
                                value:
                                    `${usuario}`
                            },
                            {
                                name:
                                    "⏱️ Duración",
                                value:
                                    duracion
                            },
                            {
                                name:
                                    "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            }
                        )
                        .setTimestamp();

                await interaction.reply({
                    embeds: [
                        embed
                    ]
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
                        ephemeral:
                            true
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
                    interaction.options.getString(
                        "id"
                    ).trim();

                if (
                    !/^\d{17,20}$/.test(
                        id
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ ID de Discord inválida.",
                        ephemeral:
                            true
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
                        ephemeral:
                            true
                    });
                }

                await interaction.deferReply({
                    ephemeral:
                        true
                });

                const mensajes =
                    await interaction.channel.bulkDelete(
                        cantidad,
                        true
                    );

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            0x57F287
                        )
                        .setTitle(
                            "🧹 MENSAJES ELIMINADOS"
                        )
                        .addFields(
                            {
                                name:
                                    "📊 Cantidad",
                                value:
                                    `${mensajes.size}`
                            },
                            {
                                name:
                                    "🛡️ Moderador",
                                value:
                                    `${interaction.user}`
                            },
                            {
                                name:
                                    "📍 Canal",
                                value:
                                    `${interaction.channel}`
                            }
                        )
                        .setTimestamp();

                await interaction.editReply({
                    embeds: [
                        embed
                    ]
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

                if (
                    tiempo === null
                ) {
                    return interaction.reply({
                        content:
                            "❌ Usá `5s`, `10s`, `1m`, `5m` o `1h`.",
                        ephemeral:
                            true
                    });
                }

                const segundos =
                    Math.floor(
                        tiempo /
                        1000
                    );

                if (
                    segundos >
                    21600
                ) {
                    return interaction.reply({
                        content:
                            "❌ El máximo es 6 horas.",
                        ephemeral:
                            true
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

                await interaction.deferReply({
                    ephemeral:
                        true
                });

                // -----------------------------------------
                // CANAL ACTUAL
                // -----------------------------------------

                if (
                    sub ===
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
                                "❌ No se puede modificar este canal."
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

                // -----------------------------------------
                // TODOS LOS CANALES
                // -----------------------------------------

                if (
                    sub ===
                    "general"
                ) {
                    const canales =
                        await guild.channels.fetch();

                    let cantidad =
                        0;

                    for (
                        const [
                            ,
                            canal
                        ] of canales
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
                        ephemeral:
                            true
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
            "❌ ERROR DISCORD:",
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
// INICIAR BOT
// =====================================================

(async () => {
    try {
        await registrarComandos();

        console.log(
            "🔐 Iniciando sesión..."
        );

        await client.login(
            TOKEN
        );

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
