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
// CONFIGURACIÓN GLOBAL
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1552817688378605650";
const PORT = Number(process.env.PORT) || 10000;
const DATA_FILE = path.join(__dirname, "data.json");

// =====================================================
// BASE DE DATOS (POR SERVIDOR)
// =====================================================

function crearConfig() {
    return {
        roles: { owner: null, staff: null, mod: null, verify: null },
        channels: { welcome: null, logs: null, verify: null, ticketPanel: null },
        tickets: { category: null },
        welcome: { enabled: false, message: "🎉 ¡Bienvenido/a {usuario} a **{servidor}**!" },
        verification: { enabled: false, title: "🛡️ VERIFICACIÓN", message: "¡Bienvenido/a a **{servidor}**!\n\nPresioná el botón para verificarte." },
        ticket: { title: "🎫 SOPORTE", message: "¿Necesitás ayuda en **{servidor}**?\n\nPresioná el botón para abrir un ticket." },
        ip: { enabled: false, address: null, port: null, title: "🎮 SERVIDOR DE MINECRAFT", message: "Conectate a nuestro servidor utilizando los siguientes datos:" },
        warnings: {}
    };
}

let database = {};

function cargarDatos() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 4));
        }
        const contenido = fs.readFileSync(DATA_FILE, "utf8");
        database = contenido.trim() ? JSON.parse(contenido) : {};
    } catch (error) {
        console.error("❌ Error leyendo data.json:", error);
        database = {};
    }
}

function guardarDatos() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 4));
    } catch (error) {
        console.error("❌ Error guardando data.json:", error);
    }
}

function obtenerConfig(guildId) {
    if (!database[guildId]) {
        database[guildId] = crearConfig();
        guardarDatos();
    }
    const config = database[guildId];
    
    // Asignación con fallback para evitar undefined en servidores existentes
    config.roles ??= {}; config.channels ??= {}; config.tickets ??= {};
    config.welcome ??= {}; config.verification ??= {}; config.ticket ??= {};
    config.ip ??= {}; config.warnings ??= {};

    return config;
}

cargarDatos();

// =====================================================
// UTILIDADES
// =====================================================

function reemplazarVariables(texto, datos = {}) {
    if (!texto) return "";
    return texto
        .replaceAll("{usuario}", datos.usuario || "")
        .replaceAll("{servidor}", datos.servidor || "")
        .replaceAll("{ip}", datos.ip || "")
        .replaceAll("{puerto}", String(datos.puerto || ""));
}

function convertirDuracion(texto) {
    if (!texto) return null;
    const match = texto.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!match) return null;
    const cantidad = Number(match[1]);
    const unidad = match[2].toLowerCase();
    const multiplicadores = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return cantidad * multiplicadores[unidad];
}

// =====================================================
// CLIENTE Y SERVIDOR HTTP (Mantiene activo el hosting)
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Discord Bot Global en línea");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor de monitoreo activo en puerto ${PORT}`);
});

// =====================================================
// PERMISOS
// =====================================================

function esOwner(interaction) {
    if (!interaction.guild || !interaction.member) return false;
    const config = obtenerConfig(interaction.guild.id);
    return (
        interaction.guild.ownerId === interaction.user.id ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        (config.roles.owner && interaction.member.roles.cache.has(config.roles.owner))
    );
}

function esStaff(interaction) {
    if (!interaction.guild || !interaction.member) return false;
    const config = obtenerConfig(interaction.guild.id);
    return (
        esOwner(interaction) ||
        (config.roles.staff && interaction.member.roles.cache.has(config.roles.staff)) ||
        (config.roles.mod && interaction.member.roles.cache.has(config.roles.mod))
    );
}

// =====================================================
// COMANDOS GLOBALES
// =====================================================

const commands = [
    new SlashCommandBuilder()
        .setName("ip")
        .setDescription("Muestra la IP configurada.")
        .setDMPermission(false),

    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configura el bot para este servidor.")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName("bienvenida").setDescription("Configura bienvenida.")
               .addChannelOption(opt => opt.setName("canal").setDescription("Canal de bienvenida.").addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("verificacion").setDescription("Configura verificación.")
               .addChannelOption(opt => opt.setName("canal").setDescription("Canal del panel.").addChannelTypes(ChannelType.GuildText).setRequired(true))
               .addRoleOption(opt => opt.setName("rol").setDescription("Rol entregado.").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("tickets").setDescription("Configura tickets.")
               .addChannelOption(opt => opt.setName("categoria").setDescription("Categoría donde se abrirán los tickets.").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("ip").setDescription("Configura la IP del servidor de Minecraft.")
               .addStringOption(opt => opt.setName("direccion").setDescription("IP o Dominio.").setRequired(true))
               .addIntegerOption(opt => opt.setName("puerto").setDescription("Puerto.").setMinValue(1).setMaxValue(65535).setRequired(true))
        ),

    new SlashCommandBuilder()
        .setName("create")
        .setDescription("Genera los paneles dinámicos.")
        .setDMPermission(false)
        .addSubcommand(sub => sub.setName("verificacion").setDescription("Crea el panel de verificación en el canal actual."))
        .addSubcommand(sub => sub.setName("tickets").setDescription("Crea el panel de soporte en el canal actual.")),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes del canal.")
        .setDMPermission(false)
        .addIntegerOption(opt => opt.setName("cantidad").setDescription("Número de mensajes (1-100).").setMinValue(1).setMaxValue(100).setRequired(true))
].map(command => command.toJSON());

// Registro global en la API de Discord
async function registrarComandos() {
    if (!TOKEN) throw new Error("Falta la variable de entorno DISCORD_TOKEN");
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    console.log("🔄 Registrando comandos Slash globalmente en todos los servidores...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Comandos globales actualizados exitosamente.");
}

// =====================================================
// EVENTOS PRINCIPALES
// =====================================================

client.once("ready", () => {
    console.log("==================================");
    console.log(`✅ BOT CONECTADO: ${client.user.tag}`);
    console.log(`🏠 SERVIDORES ACTIVOS: ${client.guilds.cache.size}`);
    console.log("🌎 DESPLIEGUE: GLOBAL");
    console.log("==================================");
});

// Evento de Bienvenida
client.on("guildMemberAdd", async member => {
    try {
        const config = obtenerConfig(member.guild.id);
        if (!config.welcome.enabled || !config.channels.welcome) return;

        const canal = await member.guild.channels.fetch(config.channels.welcome).catch(() => null);
        if (!canal || !canal.isTextBased()) return;

        const mensaje = reemplazarVariables(config.welcome.message, {
            usuario: `${member}`,
            servidor: member.guild.name
        });

        const embed = new EmbedBuilder()
            .setColor(0x8e44ad)
            .setDescription(mensaje)
            .setThumbnail(member.displayAvatarURL({ extension: "png", size: 1024 }))
            .setFooter({ text: member.guild.name })
            .setTimestamp();

        await canal.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Error enviando mensaje de bienvenida:", error);
    }
});

// Manejador de Interacciones (Comandos y Botones)
client.on("interactionCreate", async interaction => {
    try {
        if (!interaction.guild) {
            if (interaction.isRepliable()) {
                return interaction.reply({ content: "❌ Los comandos e interacciones solo funcionan dentro de un servidor.", ephemeral: true });
            }
            return;
        }

        const config = obtenerConfig(interaction.guild.id);

        // --- MANEJO DE BOTONES ---
        if (interaction.isButton()) {
            // Sistema de Verificación
            if (interaction.customId === "verificar_usuario") {
                if (!config.roles.verify) {
                    return interaction.reply({ content: "❌ El rol de verificación no ha sido configurado en este servidor.", ephemeral: true });
                }

                const rol = await interaction.guild.roles.fetch(config.roles.verify).catch(() => null);
                if (!rol) {
                    return interaction.reply({ content: "❌ El rol configurado ya no existe.", ephemeral: true });
                }

                if (interaction.member.roles.cache.has(rol.id)) {
                    return interaction.reply({ content: "✅ Ya estás verificado en este servidor.", ephemeral: true });
                }

                await interaction.member.roles.add(rol);
                return interaction.reply({ content: `✅ Te has verificado correctamente. Se te otorgó el rol **${rol.name}**.`, ephemeral: true });
            }

            // Crear Ticket
            if (interaction.customId === "crear_ticket") {
                await interaction.deferReply({ ephemeral: true });

                if (!config.tickets.category) {
                    return interaction.editReply({ content: "❌ El sistema de tickets no está configurado." });
                }

                const nombreCanal = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
                
                const canalTicket = await interaction.guild.channels.create({
                    name: nombreCanal,
                    type: ChannelType.GuildText,
                    parent: config.tickets.category,
                    permissionOverwrites: [
                        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle("🎫 SOPORTE")
                    .setDescription(`Hola ${interaction.user}, bienvenido a tu ticket.\nDescribe tu problema y el equipo te responderá a la brevedad.`)
                    .setTimestamp();

                const botonCerrar = new ButtonBuilder()
                    .setCustomId("cerrar_ticket")
                    .setLabel("Cerrar Ticket")
                    .setEmoji("🔒")
                    .setStyle(ButtonStyle.Danger);

                await canalTicket.send({
                    content: `${interaction.user}`,
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(botonCerrar)]
                });

                return interaction.editReply({ content: `🎫 Tu ticket ha sido creado en ${canalTicket}` });
            }

            // Cerrar Ticket
            if (interaction.customId === "cerrar_ticket") {
                if (!esStaff(interaction)) {
                    return interaction.reply({ content: "❌ Solo el personal del servidor puede cerrar tickets.", ephemeral: true });
                }

                await interaction.reply({ content: "🔒 El ticket se cerrará en 3 segundos..." });
                setTimeout(() => {
                    interaction.channel.delete().catch(() => {});
                }, 3000);
            }
        }

        // --- MANEJO DE COMANDOS SLASH ---
        if (interaction.isChatInputCommand()) {
            const { commandName, options, subcommand } = interaction;

            if (commandName === "ip") {
                if (!config.ip.enabled || !config.ip.address) {
                    return interaction.reply({ content: "❌ La IP del servidor no está configurada.", ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle(config.ip.title)
                    .setDescription(`${config.ip.message}\n\n📌 **IP:** \`${config.ip.address}\`\n🔌 **Puerto:** \`${config.ip.port}\``)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }

            if (commandName === "setup") {
                if (!esOwner(interaction)) {
                    return interaction.reply({ content: "❌ Requiere permisos de Administración o configuración de Owner.", ephemeral: true });
                }

                const sub = interaction.options.getSubcommand();

                if (sub === "bienvenida") {
                    const canal = options.getChannel("canal");
                    config.channels.welcome = canal.id;
                    config.welcome.enabled = true;
                    guardarDatos();
                    return interaction.reply({ content: `✅ Canal de bienvenidas configurado en ${canal}`, ephemeral: true });
                }

                if (sub === "verificacion") {
                    const canal = options.getChannel("canal");
                    const rol = options.getRole("rol");
                    config.channels.verify = canal.id;
                    config.roles.verify = rol.id;
                    config.verification.enabled = true;
                    guardarDatos();
                    return interaction.reply({ content: `✅ Verificación configurada en ${canal} otorgando el rol **${rol.name}**.`, ephemeral: true });
                }

                if (sub === "tickets") {
                    const cat = options.getChannel("categoria");
                    config.tickets.category = cat.id;
                    guardarDatos();
                    return interaction.reply({ content: `✅ Categoría de tickets configurada en **${cat.name}**.`, ephemeral: true });
                }

                if (sub === "ip") {
                    config.ip.address = options.getString("direccion");
                    config.ip.port = options.getInteger("puerto");
                    config.ip.enabled = true;
                    guardarDatos();
                    return interaction.reply({ content: `✅ Datos de servidor guardados: \`${config.ip.address}:${config.ip.port}\``, ephemeral: true });
                }
            }

            if (commandName === "create") {
                if (!esOwner(interaction)) {
                    return interaction.reply({ content: "❌ No tienes permisos para crear paneles.", ephemeral: true });
                }

                const sub = interaction.options.getSubcommand();

                if (sub === "verificacion") {
                    const embed = new EmbedBuilder()
                        .setColor(0x8e44ad)
                        .setTitle(config.verification.title)
                        .setDescription(reemplazarVariables(config.verification.message, { servidor: interaction.guild.name }))
                        .setFooter({ text: `${interaction.guild.name} • Verificación` });

                    const btn = new ButtonBuilder()
                        .setCustomId("verificar_usuario")
                        .setLabel("Verificarse")
                        .setEmoji("✅")
                        .setStyle(ButtonStyle.Success);

                    await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
                    return interaction.reply({ content: "✅ Panel de verificación enviado.", ephemeral: true });
                }

                if (sub === "tickets") {
                    const embed = new EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(config.ticket.title)
                        .setDescription(reemplazarVariables(config.ticket.message, { servidor: interaction.guild.name }))
                        .setFooter({ text: `${interaction.guild.name} • Soporte` });

                    const btn = new ButtonBuilder()
                        .setCustomId("crear_ticket")
                        .setLabel("Abrir Ticket")
                        .setEmoji("🎫")
                        .setStyle(ButtonStyle.Primary);

                    await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
                    return interaction.reply({ content: "✅ Panel de tickets enviado.", ephemeral: true });
                }
            }

            if (commandName === "clear") {
                if (!esStaff(interaction)) {
                    return interaction.reply({ content: "❌ No tienes permisos para borrar mensajes.", ephemeral: true });
                }

                const cantidad = options.getInteger("cantidad");
                await interaction.channel.bulkDelete(cantidad, true);
                return interaction.reply({ content: `🧹 Se han borrado **${cantidad}** mensajes.`, ephemeral: true });
            }
        }
    } catch (error) {
        console.error("❌ Error procesando la interacción:", error);
        if (interaction.isRepliable() && !interaction.replied) {
            interaction.reply({ content: "❌ Ocurrió un error inesperado al procesar la acción.", ephemeral: true }).catch(() => {});
        }
    }
});

// =====================================================
// INICIALIZACIÓN
// =====================================================

(async () => {
    try {
        await registrarComandos();
        await client.login(TOKEN);
    } catch (error) {
        console.error("❌ Error fatal al iniciar el bot:", error);
    }
})();
