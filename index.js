const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const http = require("http");

// ===============================
// SERVIDOR HTTP PARA RENDER
// ===============================

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("Discord bot online");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Servidor HTTP escuchando en el puerto ${PORT}`);
});

// ===============================
// CLIENTE DE DISCORD
// ===============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ID de tu aplicación
const CLIENT_ID = "1552817688378605650";

// El token se coloca mediante la variable de entorno DISCORD_TOKEN.
// NO pongas el token directamente aquí.
const TOKEN = process.env.DISCORD_TOKEN;

// ===============================
// COMANDOS
// ===============================

const commands = [
    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banea a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario que quieres banear")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("duracion")
                .setDescription("Ejemplo: 10d, 2h, 30m")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

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
                .setDescription("Ejemplo: 10m, 2h, 7d")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Quita el silencio a un usuario.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario al que quieres quitar el mute")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanea a un usuario mediante su ID.")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID del usuario")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
].map(command => command.toJSON());

// ===============================
// REST API DE DISCORD
// ===============================

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
    try {
        console.log("Registrando comandos...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log("✅ Comandos registrados correctamente.");
    } catch (error) {
        console.error("❌ Error registrando comandos:", error);
    }
}

// ===============================
// EVENTO DEL BOT
// ===============================

client.once("clientReady", () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
});

// ===============================
// INTERACCIONES
// ===============================

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        if (interaction.commandName === "ban") {
            await interaction.reply("🔨 Comando /ban recibido.");
        }

        if (interaction.commandName === "mute") {
            await interaction.reply("🔇 Comando /mute recibido.");
        }

        if (interaction.commandName === "unmute") {
            await interaction.reply("🔊 Comando /unmute recibido.");
        }

        if (interaction.commandName === "unban") {
            await interaction.reply("🔓 Comando /unban recibido.");
        }
    } catch (error) {
        console.error("❌ Error procesando interacción:", error);
    }
});

// ===============================
// INICIAR BOT
// ===============================

if (!TOKEN) {
    console.error("❌ Falta DISCORD_TOKEN.");
    process.exit(1);
}

registrarComandos();

client.login(TOKEN);

