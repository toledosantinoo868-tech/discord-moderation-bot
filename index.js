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

// ID DE LA APLICACIÓN / BOT
const CLIENT_ID = "1552817688378605650";

// ID DEL SERVIDOR
const GUILD_ID = "1504878187383885956";

// ÚNICA PERSONA QUE PUEDE USAR LOS COMANDOS
const OWNER_USER_ID = "1531489394127536188";

// CANALES FIJOS
const CHANNELS = {
    VERIFICACION: "1544523269376450590",
    LOGS: "1544504719047917610",
    BIENVENIDAS: "1531493723840450580",
    TICKETS: "1533646002878283936"
};

// ROL QUE SE ENTREGA AL VERIFICARSE
const VERIFIED_ROLE_ID = "1544521207708131409";

// SERVIDOR MINECRAFT
const SERVER_IP = "mc.laordenmorada.lat";
const SERVER_PORT = "19527";

// ESTILO
const BOT_COLOR = 0x8E44AD;
const SUCCESS_COLOR = 0x2ECC71;
const ERROR_COLOR = 0xE74C3C;
const WARNING_COLOR = 0xF1C40F;
const INFO_COLOR = 0x3498DB;

const FOOTER = "La Orden Morada";

// =====================================================
// MAPAS
// =====================================================

const spamMap = new Map();
const antiLinkMap = new Map();
const raidMap = new Map();
const warnMap = new Map();
const activeRaid = new Map();

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

function crearEmbed(color = BOT_COLOR) {
    return new EmbedBuilder()
        .setColor(color)
        .setFooter({
            text: FOOTER
        })
        .setTimestamp();
}

// =====================================================
// COMPROBAR OWNER
// =====================================================

function esOwner(interaction) {

    const userId = String(interaction.user.id).trim();
    const ownerId = String(OWNER_USER_ID).trim();

    console.log("");
    console.log("========================================");
    console.log("🔎 COMPROBACIÓN DE PERMISOS");
    console.log("👤 Usuario:", interaction.user.tag);
    console.log("🆔 ID USUARIO:", userId);
    console.log("👑 ID OWNER:", ownerId);
    console.log("🔐 ¿COINCIDEN?:", userId === ownerId);
    console.log("========================================");
    console.log("");

    return userId === ownerId;
}

// =====================================================
// MODERACIÓN
// =====================================================

function puedeModerar(interaction, miembro) {

    if (!interaction.guild || !miembro) {
        return false;
    }

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

    if (!ejecutor) {
        return false;
    }

    return miembro.roles.highest.position <
        ejecutor.roles.highest.position;
}

// =====================================================
// DURACIÓN
// =====================================================

function convertirDuracion(entrada) {

    if (!entrada) {
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
// LOGS
// =====================================================

async function enviarLog(guild, embed) {

    try {

        const canal = guild.channels.cache.get(
            CHANNELS.LOGS
        );

        if (!canal) {
            console.error(
                `❌ No se encontró el canal de logs: ${CHANNELS.LOGS}`
            );
            return;
        }

        if (!canal.isTextBased()) {
            console.error(
                "❌ El canal de logs no es de texto."
            );
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
// BUSCAR MENSAJES
// =====================================================

async function buscarPanel(canal, customId) {

    try {

        const mensajes = await canal.messages.fetch({
            limit: 100
        });

        return mensajes.find(mensaje =>
            mensaje.author.id === client.user.id &&
            mensaje.components?.some(row =>
                row.components?.some(
                    componente =>
                        componente.customId === customId
                )
            )
        );

    } catch (error) {

        console.error(
            `❌ Error buscando panel ${customId}:`,
            error.message
        );

        return null;
    }
}

// =====================================================
// PANEL VERIFICACIÓN
// =====================================================

async function crearPanelVerificacion() {

    try {

        const canal = client.channels.cache.get(
            CHANNELS.VERIFICACION
        );

        if (!canal || !canal.isTextBased()) {

            console.error(
                "❌ No se encontró el canal de verificación."
            );

            return;
        }

        const existente = await buscarPanel(
            canal,
            "verificar_usuario"
        );

        if (existente) {

            console.log(
                "✅ Panel de verificación ya existe."
            );

            return;
        }

        const embed = crearEmbed(BOT_COLOR)
            .setTitle("🛡️ VERIFICACIÓN")
            .setDescription(
                "## 🟣 LA ORDEN MORADA\n\n" +
                "Para acceder al servidor debes verificarte.\n\n" +
                "Pulsa el botón **✅ VERIFICARME** para obtener acceso.\n\n" +
                "Una vez verificado recibirás automáticamente " +
                "el rol correspondiente."
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("verificar_usuario")
                    .setLabel("VERIFICARME")
                    .setEmoji("✅")
                    .setStyle(ButtonStyle.Success)
            );

        await canal.send({
            embeds: [embed],
            components: [row]
        });

        console.log(
            "✅ Panel de verificación enviado."
        );

    } catch (error) {

        console.error(
            "❌ Error enviando panel de verificación:",
            error
        );
    }
}

// =====================================================
// PANEL TICKETS
// =====================================================

async function crearPanelTickets() {

    try {

        const canal = client.channels.cache.get(
            CHANNELS.TICKETS
        );

        if (!canal || !canal.isTextBased()) {

            console.error(
                "❌ No se encontró el canal de tickets."
            );

            return;
        }

        const existente = await buscarPanel(
            canal,
            "crear_ticket"
        );

        if (existente) {

            console.log(
                "✅ Panel de tickets ya existe."
            );

            return;
        }

        const embed = crearEmbed(BOT_COLOR)
            .setTitle(
                "🎫 CENTRO DE SOPORTE — LA ORDEN MORADA"
            )
            .setDescription(
                "¿**NECESITÁS AYUDA?**\n\n" +
                "Si tenés algún problema, consulta o necesitás " +
                "contactar con el Staff, podés abrir un ticket " +
                "privado y recibir asistencia.\n\n" +

                "📌 **Podés utilizar un ticket para:**\n" +
                "• Reportar jugadores o situaciones.\n" +
                "• Solicitar ayuda con el servidor.\n" +
                "• Resolver problemas o dudas.\n" +
                "• Apelar una sanción.\n" +
                "• Consultar cualquier inconveniente.\n\n" +

                "⚠️ **IMPORTANTE**\n" +
                "Explicá claramente tu situación y proporcioná " +
                "toda la información necesaria. No abras varios " +
                "tickets por el mismo problema.\n\n" +

                "🔒 Tu ticket será privado y solamente podrá ser " +
                "visto por vos y el Staff correspondiente.\n\n" +

                "Cuando estés listo, presioná el botón de abajo " +
                "para crear tu ticket."
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("crear_ticket")
                    .setLabel("CREAR TICKET")
                    .setEmoji("🎫")
                    .setStyle(ButtonStyle.Primary)
            );

        await canal.send({
            embeds: [embed],
            components: [row]
        });

        console.log(
            "✅ Panel de tickets enviado."
        );

    } catch (error) {

        console.error(
            "❌ Error enviando panel de tickets:",
            error
        );
    }
}

// =====================================================
// COMANDOS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes del canal.")
        .addIntegerOption(option =>
            option
                .setName("cantidad")
                .setDescription("Cantidad de mensajes")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Aplica timeout a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duracion")
                .setDescription(
                    "Ejemplo: 30s, 5m, 1h, 1d"
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription(
            "Quita el timeout a un usuario."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("motivo")
                .setDescription("Motivo del baneo")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario.")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID del usuario")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Expulsa a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("motivo")
                .setDescription("Motivo")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Advierte a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("motivo")
                .setDescription("Motivo")
                .setRequired(true)
        ),

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
                .setDescription(
                    "Bloquea todos los canales"
                )
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea canales.")
        .addSubcommand(sub =>
            sub
                .setName("canal")
                .setDescription(
                    "Desbloquea este canal"
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("general")
                .setDescription(
                    "Desbloquea todos los canales"
                )
        ),

    new SlashCommandBuilder()
        .setName("create_msj")
        .setDescription("Crea un mensaje embed.")
        .addStringOption(option =>
            option
                .setName("titulo")
                .setDescription("Título")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("contenido")
                .setDescription("Contenido")
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName("canal")
                .setDescription(
                    "Canal de destino"
                )
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("ip")
        .setDescription(
            "Muestra la IP del servidor."
        )

].map(command => command.toJSON());

// =====================================================
// REST
// =====================================================

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

// =====================================================
// REGISTRAR COMANDOS
// =====================================================

async function registrarComandos() {

    try {

        console.log("");
        console.log("🔄 Registrando comandos...");
        console.log("🤖 CLIENT ID:", CLIENT_ID);
        console.log("🏠 GUILD ID:", GUILD_ID);

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
            "✅ Comandos registrados correctamente."
        );

        console.log(
            "📌 Registro realizado específicamente en tu servidor."
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

client.once("ready", async () => {

    console.log("");
    console.log("========================================");
    console.log("🟣 LA ORDEN MORADA");
    console.log("========================================");
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`👑 Owner ID: ${OWNER_USER_ID}`);
    console.log(`🏠 Guild ID: ${GUILD_ID}`);
    console.log("========================================");
    console.log("");

    // COMPROBAR QUE EL BOT CORRESPONDA AL CLIENT ID

    if (client.user.id !== CLIENT_ID) {

        console.error("");
        console.error(
            "🚨🚨🚨 ATENCIÓN 🚨🚨🚨"
        );

        console.error(
            "El CLIENT_ID configurado NO coincide con el bot conectado."
        );

        console.error(
            "CLIENT_ID configurado:",
            CLIENT_ID
        );

        console.error(
            "BOT CONECTADO:",
            client.user.id
        );

        console.error("");

    } else {

        console.log(
            "✅ CLIENT_ID coincide con el bot conectado."
        );
    }

    await registrarComandos();

    console.log("");

    // CANALES

    for (
        const [nombre, id] of Object.entries(CHANNELS)
    ) {

        const canal =
            client.channels.cache.get(id);

        if (canal) {

            console.log(
                `✅ ${nombre}: ${canal.name}`
            );

        } else {

            console.log(
                `❌ ${nombre}: NO ENCONTRADO (${id})`
            );
        }
    }

    console.log("");

    await crearPanelVerificacion();
    await crearPanelTickets();

    console.log("");
    console.log(
        "🟣 Bot completamente iniciado."
    );
    console.log("");
});

// =====================================================
// BIENVENIDA
// =====================================================

client.on("guildMemberAdd", async member => {

    try {

        const canal =
            member.guild.channels.cache.get(
                CHANNELS.BIENVENIDAS
            );

        if (canal && canal.isTextBased()) {

            const embed = crearEmbed(BOT_COLOR)
                .setTitle(
                    "🟣 BIENVENIDO A LA ORDEN MORADA"
                )
                .setDescription(
                    `👋 ¡Bienvenido ${member}!\n\n` +
                    "Nos alegra tenerte con nosotros.\n\n" +
                    `🎉 Sos nuestro miembro **#${member.guild.memberCount}**.\n\n` +
                    "🛡️ No olvides pasar por el canal de " +
                    "verificación para obtener acceso al servidor."
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
        }

        const logEmbed = crearEmbed(SUCCESS_COLOR)
            .setTitle("📥 NUEVO MIEMBRO")
            .setDescription(
                `${member} se unió al servidor.`
            )
            .addFields(
                {
                    name: "👤 Usuario",
                    value: member.user.tag,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: member.id,
                    inline: true
                },
                {
                    name: "👥 Miembros",
                    value:
                        `${member.guild.memberCount}`,
                    inline: true
                }
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size: 512
                })
            );

        await enviarLog(
            member.guild,
            logEmbed
        );

        const guildId = member.guild.id;
        const ahora = Date.now();

        let entradas =
            raidMap.get(guildId) || [];

        entradas = entradas.filter(
            timestamp =>
                ahora - timestamp < 10000
        );

        entradas.push(ahora);

        raidMap.set(
            guildId,
            entradas
        );

        if (
            entradas.length >= 5 &&
            !activeRaid.get(guildId)
        ) {

            activeRaid.set(
                guildId,
                true
            );

            const raidEmbed =
                crearEmbed(ERROR_COLOR)
                    .setTitle(
                        "🚨 ANTI-RAID ACTIVADO"
                    )
                    .setDescription(
                        "Se detectaron múltiples entradas " +
                        "al servidor en un período muy corto."
                    )
                    .addFields(
                        {
                            name: "👥 Entradas",
                            value: `${entradas.length}`,
                            inline: true
                        },
                        {
                            name: "⏱️ Tiempo",
                            value: "10 segundos",
                            inline: true
                        }
                    );

            await enviarLog(
                member.guild,
                raidEmbed
            );

            setTimeout(() => {

                activeRaid.set(
                    guildId,
                    false
                );

                raidMap.set(
                    guildId,
                    []
                );

            }, 60000);
        }

    } catch (error) {

        console.error(
            "❌ Error procesando entrada:",
            error
        );
    }
});

// =====================================================
// DESPEDIDA
// =====================================================

client.on("guildMemberRemove", async member => {

    try {

        const embed = crearEmbed(ERROR_COLOR)
            .setTitle("📤 MIEMBRO SALIÓ")
            .setDescription(
                `${member.user} salió del servidor.`
            )
            .addFields(
                {
                    name: "👤 Usuario",
                    value: member.user.tag,
                    inline: true
                },
                {
                    name: "🆔 ID",
                    value: member.id,
                    inline: true
                }
            )
            .setThumbnail(
                member.user.displayAvatarURL({
                    size: 512
                })
            );

        await enviarLog(
            member.guild,
            embed
        );

    } catch (error) {

        console.error(
            "❌ Error en despedida:",
            error
        );
    }
});

// =====================================================
// ANTI-SPAM + ANTI-LINKS
// =====================================================

client.on("messageCreate", async message => {

    if (
        !message.guild ||
        message.author.bot
    ) {
        return;
    }

    const member = message.member;

    if (!member) {
        return;
    }

    if (
        message.author.id === OWNER_USER_ID
    ) {
        return;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return;
    }

    const linkRegex =
        /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

    if (linkRegex.test(message.content)) {

        try {

            await message.delete()
                .catch(() => {});

            const cooldownKey =
                `${message.guild.id}:${message.author.id}`;

            const ahora = Date.now();

            const ultimo =
                antiLinkMap.get(cooldownKey) || 0;

            if (
                ahora - ultimo > 5000
            ) {

                antiLinkMap.set(
                    cooldownKey,
                    ahora
                );

                const aviso =
                    await message.channel.send({
                        embeds: [
                            crearEmbed(WARNING_COLOR)
                                .setTitle(
                                    "🔗 ENLACE BLOQUEADO"
                                )
                                .setDescription(
                                    `${message.author}, los enlaces ` +
                                    "no están permitidos en este canal."
                                )
                        ]
                    })
                    .catch(() => null);

                if (aviso) {

                    setTimeout(() => {

                        aviso.delete()
                            .catch(() => {});

                    }, 4000);
                }
            }

            await enviarLog(
                message.guild,
                crearEmbed(WARNING_COLOR)
                    .setTitle("🔗 ANTI-LINKS")
                    .setDescription(
                        `Se eliminó un enlace enviado por ${message.author}.`
                    )
                    .addFields({
                        name: "📍 Canal",
                        value: `${message.channel}`,
                        inline: true
                    })
            );

        } catch (error) {

            console.error(
                "❌ Error Anti-Links:",
                error
            );
        }

        return;
    }

    const key =
        `${message.guild.id}:${message.author.id}`;

    let timestamps =
        spamMap.get(key) || [];

    const ahora = Date.now();

    timestamps =
        timestamps.filter(
            timestamp =>
                ahora - timestamp < 3000
        );

    timestamps.push(ahora);

    spamMap.set(
        key,
        timestamps
    );

    if (timestamps.length >= 6) {

        spamMap.set(key, []);

        await message.delete()
            .catch(() => {});

        const aviso =
            await message.channel.send({
                embeds: [
                    crearEmbed(WARNING_COLOR)
                        .setTitle("⚠️ ANTI-SPAM")
                        .setDescription(
                            `${message.author}, estás enviando ` +
                            "mensajes demasiado rápido."
                        )
                ]
            })
            .catch(() => null);

        if (aviso) {

            setTimeout(() => {

                aviso.delete()
                    .catch(() => {});

            }, 4000);
        }

        try {

            await member.timeout(
                30 * 1000,
                "Anti-Spam automático"
            );

            await enviarLog(
                message.guild,
                crearEmbed(ERROR_COLOR)
                    .setTitle(
                        "🚨 ANTI-SPAM ACTIVADO"
                    )
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

            console.error(
                "❌ Error aplicando Anti-Spam:",
                error
            );
        }
    }
});

// =====================================================
// MENSAJE ELIMINADO
// =====================================================

client.on("messageDelete", async message => {

    try {

        if (
            !message.guild ||
            message.author?.bot
        ) {
            return;
        }

        const contenido =
            message.content?.trim() ||
            "Contenido no disponible";

        const texto =
            contenido.length > 900
                ? contenido.substring(0, 900) + "..."
                : contenido;

        const embed = crearEmbed(ERROR_COLOR)
            .setTitle(
                "🗑️ MENSAJE ELIMINADO"
            )
            .addFields(
                {
                    name: "👤 Usuario",
                    value: message.author
                        ? `${message.author}`
                        : "Desconocido",
                    inline: true
                },
                {
                    name: "📍 Canal",
                    value: `${message.channel}`,
                    inline: true
                },
                {
                    name: "💬 Contenido",
                    value: texto
                }
            );

        await enviarLog(
            message.guild,
            embed
        );

    } catch (error) {

        console.error(
            "❌ Error en messageDelete:",
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
        // DEBUG
        // =================================================

        if (interaction.isChatInputCommand()) {

            console.log("");
            console.log("========================================");
            console.log("📥 COMANDO RECIBIDO");
            console.log("👤 Usuario:", interaction.user.tag);
            console.log(
                "🆔 ID USUARIO:",
                interaction.user.id
            );
            console.log(
                "🤖 Bot:",
                client.user.tag
            );
            console.log(
                "🆔 ID BOT:",
                client.user.id
            );
            console.log(
                "🏠 Servidor:",
                interaction.guild?.name
            );
            console.log(
                "🆔 SERVIDOR ID:",
                interaction.guild?.id
            );
            console.log(
                "📌 Comando:",
                interaction.commandName
            );
            console.log("========================================");
            console.log("");
        }

        // =================================================
        // BOTONES
        // =================================================

        if (interaction.isButton()) {

            // =============================================
            // VERIFICACIÓN
            // =============================================

            if (
                interaction.customId ===
                "verificar_usuario"
            ) {

                const rol =
                    interaction.guild.roles.cache.get(
                        VERIFIED_ROLE_ID
                    );

                if (!rol) {

                    return interaction.reply({
                        embeds: [
                            crearEmbed(ERROR_COLOR)
                                .setTitle("❌ ERROR")
                                .setDescription(
                                    "No encontré el rol de verificado."
                                )
                        ],
                        ephemeral: true
                    });
                }

                if (
                    interaction.member.roles.cache.has(
                        VERIFIED_ROLE_ID
                    )
                ) {

                    return interaction.reply({
                        embeds: [
                            crearEmbed(INFO_COLOR)
                                .setTitle(
                                    "🛡️ YA ESTÁS VERIFICADO"
                                )
                                .setDescription(
                                    "Tu cuenta ya está verificada."
                                )
                        ],
                        ephemeral: true
                    });
                }

                try {

                    await interaction.member.roles.add(
                        VERIFIED_ROLE_ID,
                        "Verificación mediante botón"
                    );

                    const embed =
                        crearEmbed(SUCCESS_COLOR)
                            .setTitle(
                                "✅ VERIFICACIÓN COMPLETADA"
                            )
                            .setDescription(
                                `¡Bienvenido ${interaction.user}!\n\n` +
                                "Tu cuenta fue verificada correctamente " +
                                "en **La Orden Morada**.\n\n" +
                                "Ya tenés acceso al servidor."
                            );

                    await interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });

                    await enviarLog(
                        interaction.guild,
                        crearEmbed(SUCCESS_COLOR)
                            .setTitle(
                                "✅ USUARIO VERIFICADO"
                            )
                            .setDescription(
                                `${interaction.user} completó la verificación.`
                            )
                            .addFields(
                                {
                                    name: "🛡️ Rol entregado",
                                    value:
                                        `<@&${VERIFIED_ROLE_ID}>`
                                },
                                {
                                    name: "🆔 ID",
                                    value:
                                        interaction.user.id
                                }
                            )
                    );

                } catch (error) {

                    console.error(
                        "❌ Error de verificación:",
                        error
                    );

                    if (
                        !interaction.replied &&
                        !interaction.deferred
                    ) {

                        await interaction.reply({
                            embeds: [
                                crearEmbed(ERROR_COLOR)
                                    .setTitle(
                                        "❌ NO SE PUDO VERIFICAR"
                                    )
                                    .setDescription(
                                        "No pude asignarte el rol. " +
                                        "Revisá que el rol del bot esté " +
                                        "por encima del rol de verificado."
                                    )
                            ],
                            ephemeral: true
                        });
                    }
                }

                return;
            }

            // =============================================
            // CREAR TICKET
            // =============================================

            if (
                interaction.customId ===
                "crear_ticket"
            ) {

                const guild =
                    interaction.guild;

                const nombre =
                    `ticket-${interaction.user.id}`;

                const existente =
                    guild.channels.cache.find(
                        channel =>
                            channel.name === nombre
                    );

                if (existente) {

                    return interaction.reply({
                        embeds: [
                            crearEmbed(WARNING_COLOR)
                                .setTitle(
                                    "🎫 YA TENÉS UN TICKET"
                                )
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

                const categoria =
                    panel?.parentId || null;

                const ticket =
                    await guild.channels.create({
                        name: nombre,
                        type: ChannelType.GuildText,
                        parent: categoria,
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
                                id: OWNER_USER_ID,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageMessages
                                ]
                            },
                            {
                                id: client.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory,
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.ManageMessages
                                ]
                            }
                        ]
                    });

                const embed =
                    crearEmbed(BOT_COLOR)
                        .setTitle(
                            "🎫 TICKET CREADO"
                        )
                        .setDescription(
                            `¡Hola ${interaction.user}!\n\n` +
                            "Tu ticket fue creado correctamente. " +
                            "Explicá detalladamente el motivo de tu " +
                            "consulta para que el Staff pueda ayudarte.\n\n" +
                            "📌 Si corresponde, podés enviar capturas, " +
                            "IDs, nombres de usuarios u otra información " +
                            "que ayude a resolver el problema.\n\n" +
                            "🛡️ Un miembro del Staff atenderá tu solicitud.\n\n" +
                            "Cuando el problema esté solucionado, utilizá " +
                            "el botón para cerrar el ticket."
                        );

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    "cerrar_ticket"
                                )
                                .setLabel(
                                    "CERRAR TICKET"
                                )
                                .setEmoji("🔒")
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                await ticket.send({
                    content:
                        `${interaction.user}`,
                    embeds: [embed],
                    components: [row]
                });

                await interaction.reply({
                    embeds: [
                        crearEmbed(SUCCESS_COLOR)
                            .setTitle(
                                "🎫 TICKET CREADO"
                            )
                            .setDescription(
                                `Tu ticket fue creado correctamente:\n${ticket}`
                            )
                    ],
                    ephemeral: true
                });

                await enviarLog(
                    guild,
                    crearEmbed(BOT_COLOR)
                        .setTitle(
                            "🎫 TICKET CREADO"
                        )
                        .setDescription(
                            `${interaction.user} creó un ticket.`
                        )
                        .addFields(
                            {
                                name: "📁 Canal",
                                value: `${ticket}`,
                                inline: true
                            },
                            {
                                name: "🆔 Usuario",
                                value:
                                    interaction.user.id,
                                inline: true
                            }
                        )
                );

                return;
            }

            // =============================================
            // CERRAR TICKET
            // =============================================

            if (
                interaction.customId ===
                "cerrar_ticket"
            ) {

                if (
                    !interaction.channel.name.startsWith(
                        "ticket-"
                    )
                ) {

                    return interaction.reply({
                        embeds: [
                            crearEmbed(ERROR_COLOR)
                                .setTitle("❌ ERROR")
                                .setDescription(
                                    "Este canal no es un ticket."
                                )
                        ],
                        ephemeral: true
                    });
                }

                const embed =
                    crearEmbed(ERROR_COLOR)
                        .setTitle(
                            "🔒 TICKET CERRADO"
                        )
                        .setDescription(
                            "El ticket será eliminado en **5 segundos**."
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    crearEmbed(ERROR_COLOR)
                        .setTitle(
                            "🔒 TICKET CERRADO"
                        )
                        .setDescription(
                            `${interaction.user} cerró un ticket.`
                        )
                        .addFields({
                            name: "📁 Canal",
                            value:
                                interaction.channel.name
                        })
                );

                setTimeout(() => {

                    interaction.channel
                        .delete()
                        .catch(() => {});

                }, 5000);

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

        if (!interaction.guild) {

            return interaction.reply({
                embeds: [
                    crearEmbed(ERROR_COLOR)
                        .setTitle(
                            "❌ COMANDO NO DISPONIBLE"
                        )
                        .setDescription(
                            "Este comando solamente puede utilizarse dentro de un servidor."
                        )
                ],
                ephemeral: true
            });
        }

        // =================================================
        // COMPROBAR SERVIDOR
        // =================================================

        if (interaction.guild.id !== GUILD_ID) {

            console.log(
                "❌ Comando ejecutado en un servidor no autorizado:",
                interaction.guild.id
            );

            return interaction.reply({
                embeds: [
                    crearEmbed(ERROR_COLOR)
                        .setTitle(
                            "❌ SERVIDOR NO AUTORIZADO"
                        )
                        .setDescription(
                            "Este bot no está configurado para utilizarse en este servidor."
                        )
                ],
                ephemeral: true
            });
        }

        // =================================================
        // SOLO OWNER
        // =================================================

        console.log(
            "🔐 Verificando permisos del comando..."
        );

        const tienePermiso =
            esOwner(interaction);

        console.log(
            "🔐 Resultado:",
            tienePermiso
                ? "PERMITIDO ✅"
                : "DENEGADO ❌"
        );

        if (!tienePermiso) {

            console.log(
                "❌ Comando bloqueado para:",
                interaction.user.tag,
                interaction.user.id
            );

            return interaction.reply({
                embeds: [
                    crearEmbed(ERROR_COLOR)
                        .setTitle(
                            "🚫 ACCESO DENEGADO"
                        )
                        .setDescription(
                            "No tenés permiso para utilizar los comandos de este bot."
                        )
                        .addFields(
                            {
                                name: "🆔 Tu ID",
                                value:
                                    `\`${interaction.user.id}\``
                            },
                            {
                                name: "👑 ID autorizado",
                                value:
                                    `\`${OWNER_USER_ID}\``
                            }
                        )
                ],
                ephemeral: true
            });
        }

        console.log(
            "✅ Permiso concedido a:",
            interaction.user.tag
        );

        // =================================================
        // /IP
        // =================================================

        if (
            interaction.commandName === "ip"
        ) {

            const embed =
                crearEmbed(BOT_COLOR)
                    .setTitle(
                        "🟣 LA ORDEN MORADA"
                    )
                    .setDescription(
                        "## 🎮 INFORMACIÓN DEL SERVIDOR\n\n" +
                        "🌐 **IP**\n" +
                        `\`${SERVER_IP}\`\n\n` +
                        "🔌 **Puerto**\n" +
                        `\`${SERVER_PORT}\`\n\n` +
                        "🟣 ¡Te esperamos dentro!"
                    );

            return interaction.reply({
                embeds: [embed]
            });
        }

        // =================================================
        // /CLEAR
        // =================================================

        if (
            interaction.commandName === "clear"
        ) {

            const cantidad =
                interaction.options.getInteger(
                    "cantidad"
                );

            await interaction.deferReply({
                ephemeral: true
            });

            const mensajes =
                await interaction.channel.bulkDelete(
                    cantidad,
                    true
                );

            const embed =
                crearEmbed(INFO_COLOR)
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

        if (
            interaction.commandName === "mute"
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
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ USUARIO NO ENCONTRADO"
                            )
                            .setDescription(
                                "El usuario no pertenece al servidor."
                            )
                    ],
                    ephemeral: true
                });
            }

            if (
                !puedeModerar(
                    interaction,
                    miembro
                )
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "🚫 ACCIÓN DENEGADA"
                            )
                            .setDescription(
                                "No podés moderar a este usuario por su jerarquía."
                            )
                    ],
                    ephemeral: true
                });
            }

            const tiempo =
                convertirDuracion(
                    duracion
                );

            if (
                !tiempo ||
                tiempo <= 0 ||
                tiempo >
                    28 *
                    24 *
                    60 *
                    60 *
                    1000
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ DURACIÓN INVÁLIDA"
                            )
                            .setDescription(
                                "Usá `30s`, `5m`, `1h` o `1d`.\n\n" +
                                "Máximo: **28 días**."
                            )
                    ],
                    ephemeral: true
                });
            }

            await miembro.timeout(
                tiempo,
                `Timeout aplicado por ${interaction.user.tag}`
            );

            const embed =
                crearEmbed(WARNING_COLOR)
                    .setTitle(
                        "🔇 USUARIO SILENCIADO"
                    )
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
                            value:
                                `${interaction.user}`,
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

        if (
            interaction.commandName === "unmute"
        ) {

            const usuario =
                interaction.options.getUser(
                    "usuario"
                );

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ USUARIO NO ENCONTRADO"
                            )
                    ],
                    ephemeral: true
                });
            }

            if (
                !puedeModerar(
                    interaction,
                    miembro
                )
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "🚫 ACCIÓN DENEGADA"
                            )
                            .setDescription(
                                "No podés modificar a este usuario."
                            )
                    ],
                    ephemeral: true
                });
            }

            await miembro.timeout(
                null,
                `Timeout removido por ${interaction.user.tag}`
            );

            const embed =
                crearEmbed(SUCCESS_COLOR)
                    .setTitle(
                        "🔊 TIMEOUT REMOVIDO"
                    )
                    .setDescription(
                        `${usuario} ya no está silenciado.`
                    )
                    .addFields({
                        name: "👮 Moderador",
                        value:
                            `${interaction.user}`
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

        if (
            interaction.commandName === "ban"
        ) {

            const usuario =
                interaction.options.getUser(
                    "usuario"
                );

            const motivo =
                interaction.options.getString(
                    "motivo"
                ) ||
                "Sin motivo especificado";

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (
                miembro &&
                !puedeModerar(
                    interaction,
                    miembro
                )
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "🚫 ACCIÓN DENEGADA"
                            )
                            .setDescription(
                                "No podés banear a este usuario."
                            )
                    ],
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

            const embed =
                crearEmbed(ERROR_COLOR)
                    .setTitle(
                        "🔨 USUARIO BANEADO"
                    )
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
                            value:
                                `${interaction.user}`
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

        if (
            interaction.commandName === "unban"
        ) {

            const id =
                interaction.options.getString(
                    "id"
                ).trim();

            if (
                !/^\d{17,20}$/.test(id)
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ ID INVÁLIDA"
                            )
                    ],
                    ephemeral: true
                });
            }

            try {

                await interaction.guild.members.unban(
                    id,
                    `Desbaneado por ${interaction.user.tag}`
                );

                const embed =
                    crearEmbed(SUCCESS_COLOR)
                        .setTitle(
                            "🔓 USUARIO DESBANEADO"
                        )
                        .setDescription(
                            `La ID \`${id}\` fue desbaneada.`
                        )
                        .addFields({
                            name: "👮 Moderador",
                            value:
                                `${interaction.user}`
                        });

                await interaction.reply({
                    embeds: [embed]
                });

                await enviarLog(
                    interaction.guild,
                    embed
                );

            } catch (error) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ NO ENCONTRADO"
                            )
                            .setDescription(
                                "No existe un baneo activo para esa ID."
                            )
                    ],
                    ephemeral: true
                });
            }

            return;
        }

        // =================================================
        // /KICK
        // =================================================

        if (
            interaction.commandName === "kick"
        ) {

            const usuario =
                interaction.options.getUser(
                    "usuario"
                );

            const motivo =
                interaction.options.getString(
                    "motivo"
                ) ||
                "Sin motivo especificado";

            const miembro =
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ USUARIO NO ENCONTRADO"
                            )
                    ],
                    ephemeral: true
                });
            }

            if (
                !puedeModerar(
                    interaction,
                    miembro
                )
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "🚫 ACCIÓN DENEGADA"
                            )
                            .setDescription(
                                "No podés expulsar a este usuario."
                            )
                    ],
                    ephemeral: true
                });
            }

            await miembro.kick(
                `${motivo} | Por ${interaction.user.tag}`
            );

            const embed =
                crearEmbed(ERROR_COLOR)
                    .setTitle(
                        "👢 USUARIO EXPULSADO"
                    )
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
                            value:
                                `${interaction.user}`
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

        if (
            interaction.commandName === "warn"
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
                await interaction.guild.members
                    .fetch(usuario.id)
                    .catch(() => null);

            if (!miembro) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ USUARIO NO ENCONTRADO"
                            )
                    ],
                    ephemeral: true
                });
            }

            if (
                !puedeModerar(
                    interaction,
                    miembro
                )
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "🚫 ACCIÓN DENEGADA"
                            )
                    ],
                    ephemeral: true
                });
            }

            const key =
                `${interaction.guild.id}:${usuario.id}`;

            const cantidad =
                (warnMap.get(key) || 0) + 1;

            warnMap.set(
                key,
                cantidad
            );

            const embed =
                crearEmbed(WARNING_COLOR)
                    .setTitle(
                        "⚠️ ADVERTENCIA"
                    )
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
                            value:
                                `${interaction.user}`,
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

        if (
            interaction.commandName === "lock"
        ) {

            const subcomando =
                interaction.options.getSubcommand();

            if (
                subcomando === "canal"
            ) {

                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: false
                    }
                );

                const embed =
                    crearEmbed(ERROR_COLOR)
                        .setTitle(
                            "🔒 CANAL BLOQUEADO"
                        )
                        .setDescription(
                            `${interaction.channel} fue bloqueado.`
                        )
                        .addFields({
                            name: "👮 Moderador",
                            value:
                                `${interaction.user}`
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

            if (
                subcomando === "general"
            ) {

                await interaction.deferReply();

                const canales =
                    interaction.guild.channels.cache.filter(
                        channel =>
                            channel.type ===
                            ChannelType.GuildText
                    );

                for (
                    const [, canal] of canales
                ) {

                    await canal.permissionOverwrites
                        .edit(
                            interaction.guild.roles.everyone,
                            {
                                SendMessages: false
                            }
                        )
                        .catch(() => {});
                }

                const embed =
                    crearEmbed(ERROR_COLOR)
                        .setTitle(
                            "🔒 BLOQUEO GENERAL"
                        )
                        .setDescription(
                            "Todos los canales de texto fueron bloqueados."
                        )
                        .addFields({
                            name: "👮 Moderador",
                            value:
                                `${interaction.user}`
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

        if (
            interaction.commandName === "unlock"
        ) {

            const subcomando =
                interaction.options.getSubcommand();

            if (
                subcomando === "canal"
            ) {

                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: null
                    }
                );

                const embed =
                    crearEmbed(SUCCESS_COLOR)
                        .setTitle(
                            "🔓 CANAL DESBLOQUEADO"
                        )
                        .setDescription(
                            `${interaction.channel} fue desbloqueado.`
                        )
                        .addFields({
                            name: "👮 Moderador",
                            value:
                                `${interaction.user}`
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

            if (
                subcomando === "general"
            ) {

                await interaction.deferReply();

                const canales =
                    interaction.guild.channels.cache.filter(
                        channel =>
                            channel.type ===
                            ChannelType.GuildText
                    );

                for (
                    const [, canal] of canales
                ) {

                    await canal.permissionOverwrites
                        .edit(
                            interaction.guild.roles.everyone,
                            {
                                SendMessages: null
                            }
                        )
                        .catch(() => {});
                }

                const embed =
                    crearEmbed(SUCCESS_COLOR)
                        .setTitle(
                            "🔓 DESBLOQUEO GENERAL"
                        )
                        .setDescription(
                            "Todos los canales de texto fueron desbloqueados."
                        )
                        .addFields({
                            name: "👮 Moderador",
                            value:
                                `${interaction.user}`
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

        if (
            interaction.commandName ===
            "create_msj"
        ) {

            const titulo =
                interaction.options.getString(
                    "titulo"
                );

            const contenido =
                interaction.options.getString(
                    "contenido"
                );

            const canalDestino =
                interaction.options.getChannel(
                    "canal"
                ) ||
                interaction.channel;

            if (
                !canalDestino.isTextBased()
            ) {

                return interaction.reply({
                    embeds: [
                        crearEmbed(ERROR_COLOR)
                            .setTitle(
                                "❌ CANAL INVÁLIDO"
                            )
                    ],
                    ephemeral: true
                });
            }

            const embed =
                crearEmbed(BOT_COLOR)
                    .setTitle(titulo)
                    .setDescription(
                        contenido.replace(
                            /\\n/g,
                            "\n"
                        )
                    );

            await canalDestino.send({
                embeds: [embed]
            });

            return interaction.reply({
                embeds: [
                    crearEmbed(SUCCESS_COLOR)
                        .setTitle(
                            "✅ MENSAJE CREADO"
                        )
                        .setDescription(
                            `El mensaje fue enviado en ${canalDestino}.`
                        )
                ],
                ephemeral: true
            });
        }

    } catch (error) {

        console.error(
            "❌ ERROR EN INTERACTION:",
            error
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {

            await interaction.reply({
                embeds: [
                    crearEmbed(ERROR_COLOR)
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
// ERRORES DEL CLIENTE
// =====================================================

client.on("error", error => {

    console.error(
        "❌ Discord Client Error:",
        error
    );
});

process.on("unhandledRejection", error => {

    console.error(
        "❌ Unhandled Rejection:",
        error
    );
});

process.on("uncaughtException", error => {

    console.error(
        "❌ Uncaught Exception:",
        error
    );
});

// =====================================================
// COMPROBAR TOKEN
// =====================================================

if (!TOKEN) {

    console.error(
        "❌ No se encontró DISCORD_TOKEN en las variables de entorno."
    );

    process.exit(1);
}

// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN);
