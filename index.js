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

let database = {};

function cargarDatos() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify({}, null, 4)
            );
        }

        const contenido = fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

        database = contenido.trim()
            ? JSON.parse(contenido)
            : {};
    } catch (error) {
        console.error(
            "❌ Error leyendo data.json:",
            error
        );

        database = {};
    }
}

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
        guardarDatos();
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
    config.verification.title ??=
        "🛡️ VERIFICACIÓN";

    config.verification.message ??=
        "¡Bienvenido/a a **{servidor}**!\n\nPresioná el botón de abajo para verificarte.";

    config.ticket.title ??= "🎫 SOPORTE";

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

cargarDatos();

// =====================================================
// VARIABLES
// =====================================================

function reemplazarVariables(texto, datos = {}) {
    if (!texto) return "";

    return texto
        .replaceAll("{usuario}", datos.usuario || "")
        .replaceAll("{servidor}", datos.servidor || "")
        .replaceAll("{ip}", datos.ip || "")
        .replaceAll("{puerto}", String(datos.puerto || ""));
}

// =====================================================
// DURACIONES
// =====================================================

function convertirDuracion(texto) {
    if (!texto) return null;

    const match = texto
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
// SERVIDOR HTTP
// =====================================================

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Discord bot online");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 HTTP activo en puerto ${PORT}`);
});

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
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        ) ||
        (
            config.roles.owner &&
            interaction.member.roles.cache.has(
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
            interaction.member.roles.cache.has(
                config.roles.staff
            )
        ) ||
        (
            config.roles.mod &&
            interaction.member.roles.cache.has(
                config.roles.mod
            )
        )
    );
}

function puedeModerar(interaction, miembro) {
    if (!miembro) return false;

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

    return (
        miembro.roles.highest.position <
        interaction.member.roles.highest.position
    );
}

// =====================================================
// LOGS
// =====================================================

async function enviarLog(guild, embed) {
    try {
        const config = obtenerConfig(guild.id);

        if (!config.channels.logs) return;

        const canal = await guild.channels.fetch(
            config.channels.logs
        );

        if (!canal || !canal.isTextBased()) return;

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

function panelVerificacion(guild, config) {
    const embed = new EmbedBuilder()
        .setColor(0x8e44ad)
        .setTitle(
            reemplazarVariables(
                config.verification.title,
                {
                    servidor: guild.name
                }
            )
        )
        .setDescription(
            `${reemplazarVariables(
                config.verification.message,
                {
                    servidor: guild.name
                }
            )}\n\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 **Presioná el botón para verificarte.**`
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
            new ActionRowBuilder().addComponents(boton)
        ]
    };
}

function panelTickets(guild, config) {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(
            reemplazarVariables(
                config.ticket.title,
                {
                    servidor: guild.name
                }
            )
        )
        .setDescription(
            `${reemplazarVariables(
                config.ticket.message,
                {
                    servidor: guild.name
                }
            )}\n\n🔒 El ticket será privado.\n\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 **Presioná el botón para abrir un ticket.**`
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
            new ActionRowBuilder().addComponents(boton)
        ]
    };
}

function mensajeTicket(member) {
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
            new ActionRowBuilder().addComponents(cerrar)
        ]
    };
}

// =====================================================
// COMANDOS
// =====================================================

const commands = [
    new SlashCommandBuilder()
        .setName("ip")
        .setDescription("Muestra la IP configurada.")
        .setDMPermission(false),

    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configura el bot.")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName("bienvenida")
                .setDescription("Configura bienvenida.")
                .addChannelOption(opt =>
                    opt
                        .setName("canal")
                        .setDescription("Canal.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("verificacion")
                .setDescription("Configura verificación.")
                .addChannelOption(opt =>
                    opt
                        .setName("canal")
                        .setDescription("Canal.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt
                        .setName("rol")
                        .setDescription("Rol de verificación.")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("logs")
                .setDescription("Configura logs.")
                .addChannelOption(opt =>
                    opt
                        .setName("canal")
                        .setDescription("Canal.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("tickets")
                .setDescription("Configura tickets.")
                .addChannelOption(opt =>
                    opt
                        .setName("canal")
                        .setDescription("Canal del panel.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addChannelOption(opt =>
                    opt
                        .setName("categoria")
                        .setDescription("Categoría.")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("roles")
                .setDescription("Configura roles.")
                .addRoleOption(opt =>
                    opt
                        .setName("owner")
                        .setDescription("Rol Owner.")
                )
                .addRoleOption(opt =>
                    opt
                        .setName("staff")
                        .setDescription("Rol Staff.")
                )
                .addRoleOption(opt =>
                    opt
                        .setName("mod")
                        .setDescription("Rol Moderador.")
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("ip")
                .setDescription("Configura IP.")
                .addStringOption(opt =>
                    opt
                        .setName("direccion")
                        .setDescription("IP o dominio.")
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt
                        .setName("puerto")
                        .setDescription("Puerto.")
                        .setMinValue(1)
                        .setMaxValue(65535)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("mensajes")
                .setDescription("Personaliza mensajes.")
                .addStringOption(opt =>
                    opt
                        .setName("tipo")
                        .setDescription("Tipo.")
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
                .addStringOption(opt =>
                    opt
                        .setName("texto")
                        .setDescription("Nuevo texto.")
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName("create")
        .setDescription("Crea paneles.")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName("verificacion")
                .setDescription("Crea verificación.")
        )
        .addSubcommand(sub =>
            sub
                .setName("tickets")
                .setDescription("Crea tickets.")
        )
        .addSubcommand(sub =>
            sub
                .setName("msj")
                .setDescription("Crea un mensaje.")
                .addStringOption(opt =>
                    opt
                        .setName("texto")
                        .setDescription("Texto.")
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea un usuario.")
        .setDMPermission(false)
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Silencia un usuario.")
        .setDMPermission(false)
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("duracion")
                .setDescription("30s, 5m, 1h, 1d.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el mute.")
        .setDMPermission(false)
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea un usuario.")
        .setDMPermission(false)
        .addStringOption(opt =>
            opt
                .setName("id")
                .setDescription("ID.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Advierte a un usuario.")
        .setDMPermission(false)
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("motivo")
                .setDescription("Motivo.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("Muestra advertencias.")
        .setDMPermission(false)
        .addUserOption(opt =>
            opt
                .setName("usuario")
                .setDescription("Usuario.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes.")
        .setDMPermission(false)
        .addIntegerOption(opt =>
            opt
                .setName("cantidad")
                .setDescription("Cantidad.")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Configura slowmode.")
        .setDMPermission(false)
        .addStringOption(opt =>
            opt
                .setName("tiempo")
                .setDescription("5s, 1m, 5m.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Bloquea canales.")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName("canal")
                .setDescription("Bloquea este canal.")
        )
        .addSubcommand(sub =>
            sub
                .setName("general")
                .setDescription("Bloquea todos.")
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea canales.")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName("canal")
                .setDescription("Desbloquea este canal.")
        )
        .addSubcommand(sub =>
            sub
                .setName("general")
                .setDescription("Desbloquea todos.")
        )
].map(command => command.toJSON());

// =====================================================
// REGISTRO GLOBAL
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("🔄 Registrando comandos globalmente...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log(
            "✅ Comandos registrados globalmente."
        );
    } catch (error) {
        console.error(
            "❌ Error registrando comandos:",
            error
        );
    }
}

// =====================================================
// READY
// =====================================================

client.once("clientReady", () => {
    console.log("==================================");
    console.log(`✅ BOT: ${client.user.tag}`);
    console.log(
        `🏠 SERVIDORES: ${client.guilds.cache.size}`
    );
    console.log("🌎 MODO: TODOS LOS SERVIDORES");
    console.log("🎫 Tickets: ACTIVADOS");
    console.log("🛡️ Verificación: ACTIVADA");
    console.log("👋 Bienvenidas: ACTIVADAS");
    console.log("==================================");
});

// =====================================================
// BIENVENIDAS
// =====================================================

client.on("guildMemberAdd", async member => {
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

        const canal = await member.guild.channels.fetch(
            config.channels.welcome
        );

        if (!canal || !canal.isTextBased()) {
            return;
        }

        const mensaje = reemplazarVariables(
            config.welcome.message,
            {
                usuario: `${member}`,
                servidor: member.guild.name
            }
        );

        const embed = new EmbedBuilder()
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
            if (!interaction.guild) {
                return interaction.reply({
                    content:
                        "❌ Este botón debe utilizarse dentro de un servidor.",
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            const config = obtenerConfig(guild.id);

            // -----------------------------
            // VERIFICAR
            // -----------------------------

            if (
                interaction.customId ===
                "verificar_usuario"
            ) {
                if (!config.roles.verify) {
                    return interaction.reply({
                        content:
                            "❌ La verificación no está configurada.",
                        ephemeral: true
                    });
                }

                const rol = await guild.roles.fetch(
                    config.roles.verify
                );

                if (!rol) {
                    return interaction.reply({
                        content:
                            "❌ El rol configurado no existe.",
                        ephemeral: true
                    });
                }

                const miembro = interaction.member;

                if (
                    miembro.roles.cache.has(rol.id)
                ) {
                    return interaction.reply({
                        content:
                            "✅ Ya estás verificado.",
                        ephemeral: true
                    });
                }

                const bot = guild.members.me;

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

            // -----------------------------
            // CREAR TICKET
            // -----------------------------

            if (
                interaction.customId ===
                "crear_ticket"
            ) {
                await interaction.deferReply({
                    ephemeral: true
                });

                if (!config.tickets.category) {
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
                            "❌ La categoría no existe."
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
                        .substring(0, 70);

                const canal =
                    await guild.channels.create({
                        name:
                            nombre ||
                            `ticket-${interaction.user.id}`,

                        type: ChannelType.GuildText,

                        parent: config.tickets.category,

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

                const roles = [
                    config.roles.owner,
                    config.roles.staff,
                    config.roles.mod
                ].filter(Boolean);

                for (const roleId of roles) {
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
                    mensajeTicket(
                        interaction.member
                    )
                );

                return interaction.editReply({
                    content:
                        `🎫 Ticket creado: ${canal}`
                });
            }

            // -----------------------------
            // CERRAR TICKET
            // -----------------------------

            if (
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

                if (!esStaff(interaction)) {
                    return interaction.reply({
                        content:
                            "❌ Solo Staff, Moderador u Owner puede cerrar tickets.",
                        ephemeral: true
                    });
                }

                await interaction.reply({
                    content:
                        "🔒 Cerrando ticket..."
                });

                setTimeout(async () => {
                    try {
                        await canal.delete(
                            "Ticket cerrado"
                        );
                    } catch {}
                }, 2000);

                return;
            }

            return;
        }

        // =================================================
        // SLASH COMMANDS
        // =================================================

        if (!interaction.isChatInputCommand()) {
            return;
        }

        // ESTA ES LA ÚNICA COMPROBACIÓN
        // NECESARIA PARA COMANDOS DE SERVIDOR.
        if (!interaction.guild) {
            return interaction.reply({
                content:
                    "❌ Este comando debe utilizarse dentro de un servidor.",
                ephemeral: true
            });
        }

        const guild = interaction.guild;
        const config = obtenerConfig(guild.id);

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
                        `✅ Bienvenida configurada en ${canal}.`,
                    ephemeral: true
                });
            }

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
                        `✅ Verificación configurada.\n📍 ${canal}\n🛡️ ${rol}`,
                    ephemeral: true
                });
            }

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
                        `✅ Logs configurados en ${canal}.`,
                    ephemeral: true
                });
            }

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
                        `✅ Tickets configurados.\n🎫 Panel: ${canal}\n📁 Categoría: ${categoria}`,
                    ephemeral: true
                });
            }

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

                if (owner)
                    config.roles.owner =
                        owner.id;

                if (staff)
                    config.roles.staff =
                        staff.id;

                if (mod)
                    config.roles.mod =
                        mod.id;

                guardarDatos();

                return interaction.reply({
                    content:
                        "✅ Roles configurados correctamente.",
                    ephemeral: true
                });
            }

            if (sub === "ip") {
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
                        `✅ IP configurada:\n🌐 \`${direccion}\`\n🔌 \`${puerto}\``,
                    ephemeral: true
                });
            }

            if (sub === "mensajes") {
                const tipo =
                    interaction.options.getString(
                        "tipo"
                    );

                const texto =
                    interaction.options.getString(
                        "texto"
                    );

                if (texto.length > 4000) {
                    return interaction.reply({
                        content:
                            "❌ El mensaje supera los 4000 caracteres.",
                        ephemeral: true
                    });
                }

                if (tipo === "bienvenida")
                    config.welcome.message =
                        texto;

                if (tipo === "verificacion")
                    config.verification.message =
                        texto;

                if (tipo === "tickets")
                    config.ticket.message =
                        texto;

                if (tipo === "ip")
                    config.ip.message =
                        texto;

                guardarDatos();

                return interaction.reply({
                    content:
                        `✅ Mensaje de ${tipo} actualizado.`,
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
                        "❌ Este servidor no configuró una IP.\nUsá `/setup ip`.",
                    ephemeral: true
                });
            }

            const embed =
                new EmbedBuilder()
                    .setColor(0x57f287)
                    .setTitle(
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
                        )
                    )
                    .setDescription(
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
                        )
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
                        "❌ Solo Owner o Administrador puede utilizar este comando.",
                    ephemeral: true
                });
            }

            const sub =
                interaction.options.getSubcommand();

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
                            "❌ El canal no existe.",
                        ephemeral: true
                    });
                }

                await canal.send(
                    panelVerificacion(
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
                            "❌ El canal no existe.",
                        ephemeral: true
                    });
                }

                await canal.send(
                    panelTickets(
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

            if (sub === "msj") {
                const texto =
                    interaction.options.getString(
                        "texto"
                    );

                if (texto.length > 4096) {
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
                            text: guild.name
                        })
                        .setTimestamp();

                await interaction.channel.send({
                    embeds: [embed]
                });

                return interaction.reply({
                    content:
                        "✅ Mensaje enviado.",
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
                        "❌ No podés moderar a ese usuario.",
                    ephemeral: true
                });
            }

            config.warnings[usuario.id] ??= [];

            config.warnings[usuario.id].push({
                motivo,
                moderador:
                    interaction.user.id,
                fecha: Date.now()
            });

            guardarDatos();

            return interaction.reply({
                content:
                    `⚠️ ${usuario} recibió una advertencia.\n📝 Motivo: ${motivo}`
            });
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

            if (!lista.length) {
                return interaction.reply({
                    content:
                        `📋 ${usuario} no tiene advertencias.`,
                    ephemeral: true
                });
            }

            const texto = lista
                .map(
                    (warn, i) =>
                        `**${i + 1}.** ${warn.motivo}\n<@${warn.moderador}> • <t:${Math.floor(
                            warn.fecha / 1000
                        )}:R>`
                )
                .join("\n\n");

            const embed =
                new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle(
                        "📋 HISTORIAL DE ADVERTENCIAS"
                    )
                    .setDescription(
                        `**Usuario:** ${usuario}\n\n${texto}`
                    );

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
                !tiempo ||
                tiempo <= 0 ||
                tiempo > maximo
            ) {
                return interaction.reply({
                    content:
                        "❌ Duración inválida. Usá `30s`, `5m`, `1h` o `1d`.",
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

            return interaction.reply({
                content:
                    `🔇 ${usuario} fue silenciado durante ${duracion}.`
            });
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
                        "❌ No podés modificar a ese usuario.",
                    ephemeral: true
                });
            }

            await miembro.timeout(
                null,
                `Unmute por ${interaction.user.tag}`
            );

            return interaction.reply({
                content:
                    `🔊 ${usuario} ya no está silenciado.`
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

            if (!/^\d{17,20}$/.test(id)) {
                return interaction.reply({
                    content:
                        "❌ ID inválida.",
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
                        "❌ No se pudo desbanear a ese usuario.",
                    ephemeral: true
                });
            }

            return interaction.reply({
                content:
                    `🔓 Usuario \`${id}\` desbaneado.`
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

            return interaction.editReply({
                content:
                    `🧹 Se eliminaron ${mensajes.size} mensajes.`
            });
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

            if (!tiempo) {
                return interaction.reply({
                    content:
                        "❌ Usá `5s`, `1m`, `5m`, etc.",
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
                        "❌ Máximo 6 horas.",
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

            if (sub === "canal") {
                if (
                    !interaction.channel ||
                    !interaction.channel.permissionOverwrites
                ) {
                    return interaction.editReply({
                        content:
                            "❌ No se puede modificar este canal."
                    });
                }

                await interaction.channel.permissionOverwrites.edit(
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

            if (sub === "general") {
                const canales =
                    await guild.channels.fetch();

                let cantidad = 0;

                for (const [, canal] of canales) {
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
});

// =====================================================
// MENSAJES / ANTI INVITACIONES
// =====================================================

client.on("messageCreate", async message => {
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
                miembro.permissions.has(
                    PermissionFlagsBits.Administrator
                ) ||
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
                )
            );

        const invitacion =
            /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i.test(
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

            setTimeout(async () => {
                try {
                    await aviso.delete();
                } catch {}
            }, 5000);

            const embed =
                new EmbedBuilder()
                    .setColor(0xed4245)
                    .setTitle(
                        "🔗 INVITACIÓN BLOQUEADA"
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
// INICIO
// =====================================================

if (!TOKEN) {
    console.error(
        "❌ Falta la variable DISCORD_TOKEN."
    );

    process.exit(1);
}

(async () => {
    try {
        await registrarComandos();

        console.log(
            "🔐 Conectando con Discord..."
        );

        await client.login(TOKEN);
    } catch (error) {
        console.error(
            "❌ No se pudo iniciar el bot:"
        );

        console.error(error);

        process.exit(1);
    }
})();
