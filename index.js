require("dotenv").config();

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
    PermissionsBitField
} = require("discord.js");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1552817688378605650";

// =====================================================
// ROLES
// =====================================================

const OWNER_ROLE_ID = "1553559027697320026";
const EVERYONE_ROLE_ID = "1553559599963963442";
const VERIFIED_ROLE_ID = "1553558969924984862";

// =====================================================
// CONFIGURACIÓN DEL BOT Y TEXTOS DINÁMICOS
// =====================================================

const BOT_COLOR = 0x3498DB;
const FOOTER = "Bot creado por DEVLVdarkkidd";

// IP Minecraft
let minecraftIp = "mc.eternalcraft.fun";
let minecraftPort = "10096";

// Bienvenidas
let welcomeChannelId = null;
let welcomeTitle = "💙 ETERNAL CRAFT NETWORK";
let welcomeText = "🎉 **¡Bienvenido/a a Eternal Craft Network, {user}!**\n\n💙 Esperamos que disfrutes de la comunidad.\n\n🔐 Recordá verificarte para poder participar en el servidor.";
let welcomeBanner = null;

// Verificación
let verifTitle = "🔵 ETERNAL CRAFT NETWORK";
let verifDesc = "¡Bienvenido/a a **Eternal Craft Network**! 💙\n\nPara poder hablar y participar en el servidor, primero tenés que verificarte.\n\nPresioná el botón **✅ Verificarse** de abajo.\n\n🔐 Una vez verificado/a recibirás automáticamente el rol correspondiente.\n\n━━━━━━━━━━━━━━━━━━━━\n\n🟢 **Presioná el botón para verificarse.**";
let verifBtnLabel = "Verificarse";

// Tickets
let ticketTitle = "🎫 SOPORTE TÉCNICO Y TICKETS";
let ticketDesc = "Si necesitas ayuda, reportar a un usuario o realizar una consulta al Staff, presiona el botón de abajo para abrir un ticket privado.";
let ticketBtnLabel = "Abrir Ticket";

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
// FUNCIONES AUXILIARES DE PERMISOS
// =====================================================

// Ahora permite ejecutar comandos si es Owner, si tiene el rol de Owner o si tiene el permiso de Administrar Servidor / Administrador
function esAdminOOwner(interaction) {
    if (!interaction.guild) return false;

    return (
        interaction.guild.ownerId === interaction.user.id ||
        interaction.member.roles.cache.has(OWNER_ROLE_ID) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
    );
}

function esStaff(interaction) {
    if (!interaction.guild) return false;

    return (
        esAdminOOwner(interaction) ||
        interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
    );
}

function puedeModerar(interaction, miembro) {
    if (!interaction.guild || !miembro) return false;
    if (interaction.guild.ownerId === interaction.user.id) return true;
    if (miembro.id === interaction.guild.ownerId) return false;
    if (miembro.id === interaction.user.id) return false;

    const ejecutor = interaction.member;
    if (!ejecutor) return false;

    return miembro.roles.highest.position < ejecutor.roles.highest.position;
}

function convertirDuracion(entrada) {
    if (!entrada) return null;

    const match = entrada.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
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
// LOGS
// =====================================================

async function enviarLog(guild, embed) {
    try {
        const canal = guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildText &&
                channel.name.toLowerCase() === "logs"
        );

        if (!canal) return;

        await canal.send({ embeds: [embed] });
    } catch (error) {
        console.error("Error enviando log:", error.message);
    }
}

// =====================================================
// GENERADORES DE PANELES
// =====================================================

function crearPanelVerificacion() {
    const embed = new EmbedBuilder()
        .setColor(BOT_COLOR)
        .setTitle(verifTitle)
        .setDescription(verifDesc)
        .setFooter({ text: FOOTER })
        .setTimestamp();

    const boton = new ButtonBuilder()
        .setCustomId("eternal_verificar")
        .setLabel(verifBtnLabel)
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);

    const fila = new ActionRowBuilder().addComponents(boton);

    return { embeds: [embed], components: [fila] };
}

function crearPanelTicket() {
    const embed = new EmbedBuilder()
        .setColor(BOT_COLOR)
        .setTitle(ticketTitle)
        .setDescription(ticketDesc)
        .setFooter({ text: FOOTER })
        .setTimestamp();

    const boton = new ButtonBuilder()
        .setCustomId("eternal_crear_ticket")
        .setLabel(ticketBtnLabel)
        .setEmoji("📩")
        .setStyle(ButtonStyle.Primary);

    const fila = new ActionRowBuilder().addComponents(boton);

    return { embeds: [embed], components: [fila] };
}

// =====================================================
// COMANDOS DE REGISTRO
// =====================================================

const commands = [
    new SlashCommandBuilder()
        .setName("ip")
        .setDescription("Muestra la IP del servidor de Minecraft."),

    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configuraciones dinámicas del servidor.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("ip")
                .setDescription("Cambia la IP y el Puerto del servidor de Minecraft.")
                .addStringOption(opt => opt.setName("ip").setDescription("Nueva IP").setRequired(true))
                .addStringOption(opt => opt.setName("puerto").setDescription("Nuevo Puerto").setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("bienvenidas")
                .setDescription("Configura el mensaje y banner de bienvenida.")
                .addStringOption(opt => opt.setName("titulo").setDescription("Nuevo título de bienvenida").setRequired(false))
                .addStringOption(opt => opt.setName("texto").setDescription("Usa {user} para mencionar al miembro").setRequired(false))
                .addStringOption(opt => opt.setName("banner").setDescription("URL de la imagen/GIF").setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("verificacion")
                .setDescription("Configura el texto del panel de verificación.")
                .addStringOption(opt => opt.setName("titulo").setDescription("Título del embed").setRequired(false))
                .addStringOption(opt => opt.setName("descripcion").setDescription("Cuerpo del mensaje").setRequired(false))
                .addStringOption(opt => opt.setName("boton").setDescription("Texto del botón").setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("ticket")
                .setDescription("Configura el panel y título del sistema de tickets.")
                .addStringOption(opt => opt.setName("titulo").setDescription("Título del embed").setRequired(false))
                .addStringOption(opt => opt.setName("descripcion").setDescription("Instrucciones del ticket").setRequired(false))
                .addStringOption(opt => opt.setName("boton").setDescription("Texto del botón").setRequired(false))
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Elimina mensajes del canal.")
        .addIntegerOption(opt => opt.setName("cantidad").setDescription("Cantidad de mensajes").setRequired(true).setMinValue(1).setMaxValue(100)),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Silencia temporalmente a un usuario.")
        .addUserOption(opt => opt.setName("usuario").setDescription("Usuario a silenciar").setRequired(true))
        .addStringOption(opt => opt.setName("duracion").setDescription("Ejemplo: 30s, 5m, 1h, 1d").setRequired(true)),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el silencio a un usuario.")
        .addUserOption(opt => opt.setName("usuario").setDescription("Usuario").setRequired(true)),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(opt => opt.setName("usuario").setDescription("Usuario a banear").setRequired(true)),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario.")
        .addStringOption(opt => opt.setName("id").setDescription("ID del usuario").setRequired(true)),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Bloquea canales.")
        .addSubcommand(sub => sub.setName("canal").setDescription("Bloquea este canal"))
        .addSubcommand(sub => sub.setName("general").setDescription("Bloquea todos los canales")),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Desbloquea canales.")
        .addSubcommand(sub => sub.setName("canal").setDescription("Desbloquea este canal"))
        .addSubcommand(sub => sub.setName("general").setDescription("Desbloquea todos los canales")),

    new SlashCommandBuilder()
        .setName("verificacion")
        .setDescription("Envía el panel de verificación.")
        .addSubcommand(sub => sub.setName("aqui").setDescription("Envía el panel en este canal")),

    new SlashCommandBuilder()
        .setName("bienvenidas")
        .setDescription("Establece este canal para recibir miembros.")
        .addSubcommand(sub => sub.setName("aqui").setDescription("Asigna este canal para bienvenidas")),

    new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Envía el panel de tickets.")
        .addSubcommand(sub => sub.setName("aqui").setDescription("Envía el panel de soporte aquí"))
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("🔄 Registrando comandos...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log(`✅ ${commands.length} comandos registrados.`);
    } catch (error) {
        console.error("❌ Error registrando comandos:", error);
    }
}

// =====================================================
// BOT LISTO
// =====================================================

client.once("ready", async () => {
    console.log("================================");
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log("🔵 Eternal Craft Network");
    console.log("================================");

    await registrarComandos();
});

// =====================================================
// NUEVO MIEMBRO
// =====================================================

client.on("guildMemberAdd", async member => {
    try {
        if (!welcomeChannelId) return;

        const canal = await member.guild.channels.fetch(welcomeChannelId);
        if (!canal || !canal.isTextBased()) return;

        const avatar = member.displayAvatarURL({ extension: "png", size: 512 });
        const textoPersonalizado = welcomeText.replace(/{user}/g, `${member}`);

        const embed = new EmbedBuilder()
            .setColor(BOT_COLOR)
            .setTitle(welcomeTitle)
            .setDescription(textoPersonalizado)
            .setThumbnail(avatar)
            .setFooter({ text: FOOTER })
            .setTimestamp();

        if (welcomeBanner) {
            embed.setImage(welcomeBanner);
        }

        await canal.send({
            content: `👋 ¡Bienvenido/a ${member}!`,
            embeds: [embed]
        });
    } catch (error) {
        console.error("❌ Error en bienvenida:", error);
    }
});

// =====================================================
// INTERACCIONES
// =====================================================

client.on("interactionCreate", async interaction => {
    try {
        // VERIFICACIÓN
        if (interaction.isButton() && interaction.customId === "eternal_verificar") {
            const miembro = interaction.member;
            const rol = await interaction.guild.roles.fetch(VERIFIED_ROLE_ID);

            if (!rol) {
                return interaction.reply({ content: "❌ No encontré el rol de verificado.", ephemeral: true });
            }

            if (miembro.roles.cache.has(VERIFIED_ROLE_ID)) {
                return interaction.reply({ content: "✅ Ya estás verificado/a.", ephemeral: true });
            }

            const bot = interaction.guild.members.me;

            if (!bot || rol.position >= bot.roles.highest.position) {
                return interaction.reply({ content: "❌ El rol del bot debe estar por encima del rol Verificado.", ephemeral: true });
            }

            await miembro.roles.add(rol, "Verificación de Eternal Craft Network");

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle("✅ VERIFICACIÓN COMPLETADA")
                .setDescription(`¡Listo ${interaction.user}! 💙\n\nRecibiste el rol ${rol} y ya podés participar en **Eternal Craft Network**.`)
                .setFooter({ text: FOOTER })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // TICKET: CREACIÓN
        if (interaction.isButton() && interaction.customId === "eternal_crear_ticket") {
            const guild = interaction.guild;
            const user = interaction.user;

            const canalExistente = guild.channels.cache.find(
                c => c.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`
            );

            if (canalExistente) {
                return interaction.reply({
                    content: `❌ Ya tenés un ticket abierto en ${canalExistente}`,
                    ephemeral: true
                });
            }

            const canalTicket = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: EVERYONE_ROLE_ID,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles]
                    },
                    {
                        id: OWNER_ROLE_ID,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels]
                    }
                ]
            });

            const embedTicket = new EmbedBuilder()
                .setColor(BOT_COLOR)
                .setTitle(`🎫 Ticket de ${user.username}`)
                .setDescription("Un miembro del Staff se pondrá en contacto contigo a la brevedad.\nPara cerrar este ticket presiona el botón de abajo.")
                .setFooter({ text: FOOTER })
                .setTimestamp();

            const btnCerrar = new ButtonBuilder()
                .setCustomId("eternal_cerrar_ticket")
                .setLabel("Cerrar Ticket")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger);

            const fila = new ActionRowBuilder().addComponents(btnCerrar);

            await canalTicket.send({ content: `${user} \vert{} <@&${OWNER_ROLE_ID}>`, embeds: [embedTicket], components: [fila] });

            return interaction.reply({
                content: `✅ Ticket creado exitosamente: ${canalTicket}`,
                ephemeral: true
            });
        }

        // TICKET: CERRAR
        if (interaction.isButton() && interaction.customId === "eternal_cerrar_ticket") {
            await interaction.reply({ content: "🔒 El ticket se cerrará en 5 segundos..." });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    console.error("Error al borrar canal de ticket:", e);
                }
            }, 5000);
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        // /IP
        if (interaction.commandName === "ip") {
            const embed = new EmbedBuilder()
                .setColor(BOT_COLOR)
                .setTitle("🎮 ETERNAL CRAFT NETWORK")
                .setDescription("Conectate a nuestro servidor de Minecraft:")
                .addFields(
                    { name: "🌐 IP", value: `\`${minecraftIp}\``, inline: true },
                    { name: "🔌 Puerto", value: `\`${minecraftPort}\``, inline: true }
                )
                .setFooter({ text: FOOTER })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // /SETUP (EDITAR TODO - REQUIERE PERMISO ADMINISTRAR SERVIDOR U OWNER)
        if (interaction.commandName === "setup") {
            if (!esAdminOOwner(interaction)) {
                return interaction.reply({ content: "❌ Necesitas el permiso de **Administrar Servidor** o ser Owner para usar este comando.", ephemeral: true });
            }

            const subcomando = interaction.options.getSubcommand();

            if (subcomando === "ip") {
                const nuevaIp = interaction.options.getString("ip");
                const nuevoPuerto = interaction.options.getString("puerto");

                minecraftIp = nuevaIp;
                if (nuevoPuerto) minecraftPort = nuevoPuerto;

                return interaction.reply({ content: `✅ **IP:** \`${minecraftIp}\` | **Puerto:** \`${minecraftPort}\``, ephemeral: true });
            }

            if (subcomando === "bienvenidas") {
                const titulo = interaction.options.getString("titulo");
                const texto = interaction.options.getString("texto");
                const banner = interaction.options.getString("banner");

                if (titulo) welcomeTitle = titulo;
                if (texto) welcomeText = texto;
                if (banner) welcomeBanner = banner;

                return interaction.reply({ content: "✅ Ajustes de **Bienvenidas** actualizados exitosamente.", ephemeral: true });
            }

            if (subcomando === "verificacion") {
                const titulo = interaction.options.getString("titulo");
                const desc = interaction.options.getString("descripcion");
                const boton = interaction.options.getString("boton");

                if (titulo) verifTitle = titulo;
                if (desc) verifDesc = desc;
                if (boton) verifBtnLabel = boton;

                return interaction.reply({ content: "✅ Ajustes de **Verificación** actualizados. Vuelve a enviar el panel con `/verificacion aqui`.", ephemeral: true });
            }

            if (subcomando === "ticket") {
                const titulo = interaction.options.getString("titulo");
                const desc = interaction.options.getString("descripcion");
                const boton = interaction.options.getString("boton");

                if (titulo) ticketTitle = titulo;
                if (desc) ticketDesc = desc;
                if (boton) ticketBtnLabel = boton;

                return interaction.reply({ content: "✅ Ajustes de **Tickets** actualizados. Vuelve a enviar el panel con `/ticket aqui`.", ephemeral: true });
            }
        }

        // /VERIFICACION
        if (interaction.commandName === "verificacion") {
            if (!esAdminOOwner(interaction)) {
                return interaction.reply({ content: "❌ Necesitas el permiso de **Administrar Servidor** o ser Owner para usar este comando.", ephemeral: true });
            }

            if (interaction.options.getSubcommand() === "aqui") {
                await interaction.channel.send(crearPanelVerificacion());
                return interaction.reply({ content: "✅ Panel de verificación enviado correctamente.", ephemeral: true });
            }
        }

        // /TICKET
        if (interaction.commandName === "ticket") {
            if (!esAdminOOwner(interaction)) {
                return interaction.reply({ content: "❌ Necesitas el permiso de **Administrar Servidor** o ser Owner para usar este comando.", ephemeral: true });
            }

            if (interaction.options.getSubcommand() === "aqui") {
                await interaction.channel.send(crearPanelTicket());
                return interaction.reply({ content: "✅ Panel de tickets enviado correctamente.", ephemeral: true });
            }
        }

        // /BIENVENIDAS
        if (interaction.commandName === "bienvenidas") {
            if (!esAdminOOwner(interaction)) {
                return interaction.reply({ content: "❌ Necesitas el permiso de **Administrar Servidor** o ser Owner para usar este comando.", ephemeral: true });
            }

            welcomeChannelId = interaction.channel.id;
            return interaction.reply({ content: `✅ Este canal quedó configurado para bienvenidas.\n\n📍 Canal: ${interaction.channel}`, ephemeral: true });
        }

        // COMANDOS DE MODERACIÓN Y STAFF
        const comandosStaff = ["clear", "mute", "unmute", "ban", "unban", "lock", "unlock"];
        if (comandosStaff.includes(interaction.commandName)) {
            if (!esStaff(interaction)) {
                return interaction.reply({ content: "❌ No tenés permisos para utilizar este comando.", ephemeral: true });
            }
        }

        // /CLEAR
        if (interaction.commandName === "clear") {
            const cantidad = interaction.options.getInteger("cantidad");
            await interaction.deferReply({ ephemeral: true });
            const mensajes = await interaction.channel.bulkDelete(cantidad, true);

            const embed = new EmbedBuilder()
                .setColor(BOT_COLOR)
                .setTitle("🧹 MENSAJES ELIMINADOS")
                .addFields(
                    { name: "📊 Cantidad", value: `${mensajes.size}`, inline: true },
                    { name: "👮 Moderador", value: `${interaction.user}`, inline: true },
                    { name: "📍 Canal", value: `${interaction.channel}`, inline: true }
                )
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /MUTE
        if (interaction.commandName === "mute") {
            const usuario = interaction.options.getUser("usuario");
            const duracion = interaction.options.getString("duracion");
            const miembro = await interaction.guild.members.fetch(usuario.id);

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({ content: "❌ No podés moderar a este usuario por su jerarquía.", ephemeral: true });
            }

            const tiempo = convertirDuracion(duracion);
            if (!tiempo || tiempo <= 0 || tiempo > 28 * 24 * 60 * 60 * 1000) {
                return interaction.reply({ content: "❌ Usa formatos como `30s`, `5m`, `1h` o `1d` (Máx 28d).", ephemeral: true });
            }

            await miembro.timeout(tiempo, `Mute por ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(BOT_COLOR)
                .setTitle("🔇 USUARIO SILENCIADO")
                .setDescription(`${usuario} fue silenciado correctamente.`)
                .addFields({ name: "⏱️ Duración", value: duracion }, { name: "👮 Moderador", value: `${interaction.user}` })
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /UNMUTE
        if (interaction.commandName === "unmute") {
            const usuario = interaction.options.getUser("usuario");
            const miembro = await interaction.guild.members.fetch(usuario.id);

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({ content: "❌ No podés modificar a este usuario.", ephemeral: true });
            }

            await miembro.timeout(null, `Unmute por ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle("🔊 MUTE REMOVIDO")
                .setDescription(`${usuario} ya puede volver a hablar.`)
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /BAN
        if (interaction.commandName === "ban") {
            const usuario = interaction.options.getUser("usuario");
            const miembro = await interaction.guild.members.fetch(usuario.id);

            if (!puedeModerar(interaction, miembro)) {
                return interaction.reply({ content: "❌ No podés banear a este usuario.", ephemeral: true });
            }

            await miembro.ban({ reason: `Ban por ${interaction.user.tag}` });

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle("🔨 USUARIO BANEADO")
                .setDescription(`${usuario} fue baneado del servidor.`)
                .addFields({ name: "👮 Moderador", value: `${interaction.user}` })
                .setFooter({ text: FOOTER })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            await enviarLog(interaction.guild, embed);
            return;
        }

        // /UNBAN
        if (interaction.commandName === "unban") {
            const id = interaction.options.getString("id").trim();

            if (!/^\d{17,20}$/.test(id)) {
                return interaction.reply({ content: "❌ La ID ingresada no es válida.", ephemeral: true });
            }

            try {
                await interaction.guild.members.unban(id, `Unban por ${interaction.user.tag}`);

                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle("🔓 USUARIO DESBANEADO")
                    .setDescription(`La ID \`${id}\` fue desbaneada exitosamente.`)
                    .setFooter({ text: FOOTER })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                await enviarLog(interaction.guild, embed);
            } catch (err) {
                return interaction.reply({ content: "❌ No se encontró ningún baneo activo para esa ID.", ephemeral: true });
            }
            return;
        }

        // /LOCK
        if (interaction.commandName === "lock") {
            const subcomando = interaction.options.getSubcommand();

            if (subcomando === "canal") {
                await interaction.channel.permissionOverwrites.edit(EVERYONE_ROLE_ID, { SendMessages: false });
                return interaction.reply({ content: "🔒 Canal bloqueado para `@everyone`." });
            }

            if (subcomando === "general") {
                await interaction.deferReply();
                const canales = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
                for (const [, canal] of canales) {
                    await canal.permissionOverwrites.edit(EVERYONE_ROLE_ID, { SendMessages: false });
                }
                return interaction.editReply({ content: "🔒 Todos los canales de texto fueron bloqueados." });
            }
        }

        // /UNLOCK
        if (interaction.commandName === "unlock") {
            const subcomando = interaction.options.getSubcommand();

            if (subcomando === "canal") {
                await interaction.channel.permissionOverwrites.edit(EVERYONE_ROLE_ID, { SendMessages: null });
                return interaction.reply({ content: "🔓 Canal desbloqueado." });
            }

            if (subcomando === "general") {
                await interaction.deferReply();
                const canales = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
                for (const [, canal] of canales) {
                    await canal.permissionOverwrites.edit(EVERYONE_ROLE_ID, { SendMessages: null });
                }
                return interaction.editReply({ content: "🔓 Todos los canales de texto fueron desbloqueados." });
            }
        }

    } catch (error) {
        console.error("Error al procesar la interacción:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Ocurrió un error inesperado.", ephemeral: true });
        }
    }
});

// =====================================================
// INICIAR SESIÓN
// =====================================================

client.login(TOKEN);
