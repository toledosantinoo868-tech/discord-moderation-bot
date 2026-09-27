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
const GUILD_ID = process.env.GUILD_ID || null;
const PORT = Number(process.env.PORT) || 10000;

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
            message: "🎉 ¡Bienvenido/a {usuario} a **{servidor}**!"
        },

        verification: {
            enabled: false,
            title: "🛡️ VERIFICACIÓN",
            message:
                "¡Bienvenido/a a **{servidor}**!\n\nPresioná el botón de abajo para verificarte."
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
            return {};
        }

        const contenido = fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

        if (!contenido.trim()) {
            return {};
        }

        return JSON.parse(contenido);
    } catch (error) {
        console.error(
            "❌ Error leyendo data.json:",
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
            JSON.stringify(database, null, 4)
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
    }

    const config = database[guildId];

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
    config.verification.title ??= "🛡️ VERIFICACIÓN";
    config.verification.message ??=
        "¡Bienvenido/a a **{servidor}**!\n\nPresioná el botón de abajo para verificarte.";

    config.ticket.title ??= "🎫 SOPORTE";
    config.ticket.message ??=
        "¿Necesitás ayuda en **{servidor}**?\n\nPresioná el botón para crear un ticket privado.";

    config.ip.enabled ??= false;
    config.ip.address ??= null;
    config.ip.port ??= null;
    config.ip.title ??= "🎮 SERVIDOR DE MINECRAFT";
    config.ip.message ??=
        "Conectate a nuestro servidor utilizando los siguientes datos:";

    guardarDatos();

    return config;
}

// =====================================================
// FUNCIONES
// =====================================================

function reemplazarVariables(texto, datos = {}) {
    if (!texto) return "";

    return String(texto)
        .replaceAll("{usuario}", datos.usuario || "")
        .replaceAll("{servidor}", datos.servidor || "")
        .replaceAll("{ip}", datos.ip || "")
        .replaceAll("{puerto}", String(datos.puerto || ""));
}

function convertirDuracion(valor) {
    if (!valor || typeof valor !== "string") {
        return null;
    }

    const match = valor
        .trim()
        .match(/^(\d+)\s*(s|m|h|d)$/i);

    if (!match) {
        return null;
    }

    const cantidad = Number(match[1]);
    const unidad = match[2].toLowerCase();

    const unidades = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return cantidad * unidades[unidad];
}

function esOwner(interaction) {
    if (!interaction.guild) {
        return false;
    }

    const config = obtenerConfig(
        interaction.guild.id
    );

    return (
        interaction.guild.ownerId === interaction.user.id ||
        interaction.member?.permissions?.has(
            PermissionFlagsBits.Administrator
        ) ||
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

    if (!interaction.member) {
        return false;
    }

    return (
        miembro.roles.highest.position <
        interaction.member.roles.highest.position
    );
}

// =====================================================
// SERVIDOR HTTP
// =====================================================

const httpServer = http.createServer(
    (req, res) => {
        res.writeHead(200, {
            "Content-Type":
                "text/plain; charset=utf-8"
        });

        res.end("Discord bot online");
    }
);

httpServer.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `🌐 HTTP activo en puerto ${PORT}`
        );
    }
);

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
            error.message
        );
    }
}

// =====================================================
// PANELES
// =====================================================

function crearPanelVerificacion(guild, config) {
    const titulo = reemplazarVariables(
        config.verification.title,
        {
            servidor: guild.name
        }
    );

    const mensaje = reemplazarVariables(
        config.verification.message,
        {
            servidor: guild.name
        }
    );

    const embed = new EmbedBuilder()
        .setColor(0x8e44ad)
        .setTitle(titulo)
        .setDescription(
            `${mensaje}\n\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 **Presioná el botón de abajo para verificarte.**`
        )
        .setFooter({
            text: `${guild.name} • Verificación`
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
            new ActionRowBuilder().addComponents(
                boton
            )
        ]
    };
}

function crearPanelTickets(guild, config) {
    const titulo = reemplazarVariables(
        config.ticket.title,
        {
            servidor: guild.name
        }
    );

    const mensaje = reemplazarVariables(
        config.ticket.message,
        {
            servidor: guild.name
        }
    );

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(titulo)
        .setDescription(
            `${mensaje}\n\n🔒 El ticket será privado.\n\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 **Presioná el botón para abrir un ticket.**`
        )
        .setFooter({
            text: `${guild.name} • Soporte`
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
            new ActionRowBuilder().addComponents(
                boton
            )
        ]
    };
}

function crearMensajeTicket(member) {
    const embed = new EmbedBuilder()
        .setColor(0x8e44ad)
        .setTitle("🎫 TICKET DE SOPORTE")
        .setDescription(
            `Hola ${member} 💜\n\n` +
            "Tu ticket fue creado correctamente.\n\n" +
            "📌 Explicá detalladamente tu consulta.\n\n" +
            "🛡️ El equipo te atenderá lo antes posible."
        )
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
            new ActionRowBuilder().addComponents(
                cerrar
            )
        ]
    };
}

// =====================================================
// COMANDOS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("ip")
        .setDescription("Muestra la IP del servidor.")
        .setDMPermission(false),

    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configura el bot.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )
        .setDMPermission(false)

        .addSubcommand(sub =>
            sub
                .setName("bienvenida")
                .setDescription(
                    "Configura la bienvenida."
                )
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(
                            "Canal de bienvenida."
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
                    "Configura la verificación."
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
                            "Rol de verificación."
                        )
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("logs")
                .setDescription(
                    "Configura los logs."
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
                    "Configura los tickets."
                )
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(
                            "Canal del panel."
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
                            "Categoría de tickets."
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
                    "Configura los roles."
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
                    "Configura la IP."
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
        )

        .addSubcommand(sub =>
            sub
                .setName("mensajes")
                .setDescription(
                    "Personaliza mensajes."
                )
                .addStringOption(option =>
                    option
                        .setName("tipo")
                        .setDescription(
                            "Mensaje a modificar."
                        )
                        .addChoices(
                            {
                                name: "Bienvenida",
                                value: "bienvenida"
                            },
                            {
                                name: "Verificación",
                                value: "verificacion"
                            },
                            {
                                name: "Tickets",
                                value: "tickets"
                            },
                            {
                                name: "IP",
                                value: "ip"
                            }
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("texto")
                        .setDescription(
                            "Nuevo texto."
                        )
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName("create")
        .setDescription(
            "Crea paneles."
        )
        .setDMPermission(false)

        .addSubcommand(sub =>
            sub
                .setName("verificacion")
                .setDescription(
                    "Crea panel de verificación."
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("tickets")
                .setDescription(
                    "Crea panel de tickets."
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("msj")
                .setDescription(
                    "Crea un mensaje."
                )
                .addStringOption(option =>
                    option
                        .setName("texto")
                        .setDescription(
                            "Texto."
                        )
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea un usuario.")
        .setDMPermission(false)
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Silencia un usuario.")
        .setDMPermission(false)
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
        .setDMPermission(false)
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea un usuario.")
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID del usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Advierte un usuario.")
        .setDMPermission(false)
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
            "Muestra advertencias."
        )
        .setDMPermission(false)
        .addUserOption(option =>
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
        .setDMPermission(false)
        .addIntegerOption(option =>
            option
                .setName("cantidad")
                .setDescription(
                    "Cantidad de mensajes."
                )
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription(
            "Configura slowmode."
        )
        .setDMPermission(false)
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
        .setDescription(
            "Bloquea canales."
        )
        .setDMPermission(false)
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
        .setDescription(
            "Desbloquea canales."
        )
        .setDMPermission(false)
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
// REGISTRO DE COMANDOS
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

async function registrarComandos() {
    if (!TOKEN) {
        throw new Error(
            "Falta la variable DISCORD_TOKEN."
        );
    }

    if (!CLIENT_ID) {
        throw new Error(
            "Falta CLIENT_ID."
        );
    }

    console.log("🔄 Registrando comandos...");

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
    }
}

// =====================================================
// READY
// =====================================================

client.once(
    "clientReady",
    () => {
        console.log(
            "===================================="
        );

        console.log(
            `✅ BOT CONECTADO: ${client.user.tag}`
        );

        console.log(
            `🏠 SERVIDORES: ${client.guilds.cache.size}`
        );

        console.log(
            "🎫 Tickets: ACTIVADOS"
        );

        console.log(
            "🛡️ Verificación: ACTIVADA"
        );

        console.log(
            "👋 Bienvenidas: ACTIVADAS"
        );

        console.log(
            "===================================="
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
            const config = obtenerConfig(
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
                        usuario: `${member}`,
                        servidor: member.guild.name
                    }
                );

            const embed =
                new EmbedBuilder()
                    .setColor(0x8e44ad)
                    .setDescription(mensaje)
                    .setThumbnail(
                        member.displayAvatarURL({
                            extension: "png",
                            size: 1024
                        })
                    )
                    .setFooter({
                        text: member.guild.name
                    })
                    .setTimestamp();

            await canal.send({
                embeds: [embed]
            });
        } catch (error) {
            console.error(
                "❌ Error bienvenida:",
                error
            );
        }
    }
);

// =====================================================
// ANTI INVITACIONES
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

            const protegido =
                message.member?.permissions?.has(
                    PermissionFlagsBits.Administrator
                ) ||
                (
                    config.roles.owner &&
                    message.member?.roles.cache.has(
                        config.roles.owner
                    )
                ) ||
                (
                    config.roles.staff &&
                    message.member?.roles.cache.has(
                        config.roles.staff
                    )
                ) ||
                (
                    config.roles.mod &&
                    message.member?.roles.cache.has(
                        config.roles.mod
                    )
                );

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
                    await message.channel.send(
                        `🚫 ${message.author}, no está permitido enviar invitaciones de otros servidores.`
                    );

                setTimeout(
                    async () => {
                        try {
                            await aviso.delete();
                        } catch {}
                    },
                    5000
                );
            }
        } catch (error) {
            console.error(
                "❌ Error messageCreate:",
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
            // BOTONES
            // =================================================

            if (interaction.isButton()) {

                // ---------------------------------------------
                // VERIFICAR
                // ---------------------------------------------

                if (
                    interaction.customId ===
                    "verificar_usuario"
                ) {
                    if (!interaction.guild) {
                        return interaction.reply({
                            content:
                                "❌ Este botón solo funciona dentro de un servidor.",
                            ephemeral: true
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
                                "❌ La verificación no está configurada.",
                            ephemeral: true
                        });
                    }

                    const rol =
                        await guild.roles.fetch(
                            config.roles.verify
                        );

                    if (!rol) {
                        return interaction.reply({
                            content:
                                "❌ El rol configurado no existe.",
                            ephemeral: true
                        });
                    }

                    const miembro =
                        interaction.member;

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
                        guild.members.me;

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
                        "Verificación"
                    );

                    return interaction.reply({
                        content:
                            `✅ Verificación completada. Recibiste ${rol}.`,
                        ephemeral: true
                    });
                }

                // ---------------------------------------------
                // CREAR TICKET
                // ---------------------------------------------

                if (
                    interaction.customId ===
                    "crear_ticket"
                ) {
                    if (!interaction.guild) {
                        return interaction.reply({
                            content:
                                "❌ Este botón solo funciona dentro de un servidor.",
                            ephemeral: true
                        });
                    }

                    await interaction.deferReply({
                        ephemeral: true
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

                    let nombre =
                        `ticket-${interaction.user.username}`
                            .toLowerCase()
                            .replace(
                                /[^a-z0-9-]/g,
                                ""
                            )
                            .substring(0, 70);

                    if (!nombre) {
                        nombre =
                            `ticket-${interaction.user.id}`;
                    }

                    const canal =
                        await guild.channels.create({
                            name: nombre,
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

                    return interaction.editReply({
                        content:
                            `🎫 Ticket creado correctamente: ${canal}`
                    });
                }

                // ---------------------------------------------
                // CERRAR TICKET
                // ---------------------------------------------

                if (
                    interaction.customId ===
                    "cerrar_ticket"
                ) {
                    if (!interaction.guild) {
                        return interaction.reply({
                            content:
                                "❌ Este botón solo funciona dentro de un servidor.",
                            ephemeral: true
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

                    setTimeout(
                        async () => {
                            try {
                                await canal.delete(
                                    "Ticket cerrado"
                                );
                            } catch {}
                        },
                        2000
                    );

                    return;
                }
            }

            // =================================================
            // SLASH COMMANDS
            // =================================================

            if (
                !interaction.isChatInputCommand()
            ) {
                return;
            }

            // TODOS LOS COMANDOS SON DE SERVIDOR

            if (!interaction.guildId) {
                return interaction.reply({
                    content:
                        "❌ Este comando solo puede utilizarse dentro de un servidor de Discord.",
                    ephemeral: true
                });
            }

            const guild =
                interaction.guild;

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
                        ephemeral: true
                    });
                }

                const sub =
                    interaction.options.getSubcommand();

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
                            `✅ Bienvenida configurada en ${canal}.`,
                        ephemeral: true
                    });
                }

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
                            `✅ Verificación configurada.\n\n📍 Canal: ${canal}\n🛡️ Rol: ${rol}`,
                        ephemeral: true
                    });
                }

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
                        ephemeral: true
                    });
                }

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
                            `✅ Tickets configurados.\n\n🎫 Panel: ${canal}\n📁 Categoría: ${categoria}`,
                        ephemeral: true
                    });
                }

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
                        ephemeral: true
                    });
                }

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
                            `✅ IP configurada.\n\n🌐 IP: \`${direccion}\`\n🔌 Puerto: \`${puerto}\``,
                        ephemeral: true
                    });
                }

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
                                "❌ El texto no puede superar 4000 caracteres.",
                            ephemeral: true
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
                            `✅ Mensaje de **${tipo}** actualizado.`,
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
                        .setColor(0x57f287)
                        .setTitle(titulo)
                        .setDescription(mensaje)
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
                            "❌ Solo Owner o Administrador puede utilizar este comando.",
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
                                "❌ El canal no existe.",
                            ephemeral: true
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
                            `✅ Panel creado en ${canal}.`,
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
                                "❌ El canal no existe.",
                            ephemeral: true
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
                                "❌ El mensaje es demasiado largo.",
                            ephemeral: true
                        });
                    }

                    const embed =
                        new EmbedBuilder()
                            .setColor(0x8e44ad)
                            .setDescription(texto)
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
                            "✅ Mensaje creado.",
                        ephemeral: true
                    });
                }
            }

            // =================================================
            // PERMISOS STAFF
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
                !esStaff(interaction)
            ) {
                return interaction.reply({
                    content:
                        "❌ No tenés permisos para utilizar este comando.",
                    ephemeral: true
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
                            "❌ No podés moderar a este usuario.",
                        ephemeral: true
                    });
                }

                config.warnings[usuario.id] ??= [];

                config.warnings[usuario.id].push({
                    motivo: motivo,
                    moderador:
                        interaction.user.id,
                    fecha: Date.now()
                });

                guardarDatos();

                const cantidad =
                    config.warnings[
                        usuario.id
                    ].length;

                const embed =
                    new EmbedBuilder()
                        .setColor(0xf1c40f)
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
                        .join(
                            "\n\n"
                        );

                const embed =
                    new EmbedBuilder()
                        .setColor(0xf1c40f)
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
                        .setColor(0xed4245)
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
                            "❌ Duración inválida. Usá `30s`, `5m`, `1h` o `1d`. Máximo 28 días.",
                        ephemeral: true
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
                        ephemeral: true
                    });
                }

                await miembro.timeout(
                    tiempo,
                    `Mute por ${interaction.user.tag}`
                );

                const embed =
                    new EmbedBuilder()
                        .setColor(0x5865f2)
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

                try {
                    await guild.members.unban(
                        id,
                        `Unban por ${interaction.user.tag}`
                    );
                } catch {
                    return interaction.reply({
                        content:
                            "❌ Ese usuario no está baneado o no se pudo quitar el ban.",
                        ephemeral: true
                    });
                }

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
                        .setColor(0x57f287)
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

                if (
                    tiempo === null
                ) {
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

                await interaction.deferReply({
                    ephemeral: true
                });

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

                if (
                    sub ===
                    "general"
                ) {
                    const canales =
                        await guild.channels.fetch();

                    let cantidad = 0;

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
                "❌ ERROR EN INTERACCIÓN:",
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
// INICIAR
// =====================================================

if (!TOKEN) {
    console.error(
        "❌ Falta DISCORD_TOKEN en las variables de entorno."
    );

    process.exit(1);
}

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

        console.error(error);

        process.exit(1);
    }
})();
