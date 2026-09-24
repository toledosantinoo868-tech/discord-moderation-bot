const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

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

client.once("ready", () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
});

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
        console.error(error);
    }
});

registrarComandos();

if (!TOKEN) {
    console.error("❌ Falta DISCORD_TOKEN.");
    process.exit(1);
}

client.login(TOKEN);
