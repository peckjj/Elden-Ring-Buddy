const fs = require("fs");
const { Client, Intents } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
var db = new sqlite3.Database('./database.db');

const MY_USER_NAME = 'Elden-Ring-Buddy';
const TOKEN = fs.readFileSync('./token.txt', {encoding: 'utf-8', flag: 'r'}).split('\n').filter(line => line.trim().charAt(0) != '#')[0].trim();

const COMMANDS = [
    'search',
    's',
    'learn',
    'l'
];

const LEARNING_QUEUE = {};

async function searchEmptyWeaponUrls() {
    let sql = "SELECT * FROM weapons WHERE imageURL IS NULL;";
    return new Promise((res, rej) => {
        db.all(sql, [], (err, rows) => {
            if (err) {
                rej(err);
            }
            res(rows);
        })
    });
}

async function searchEmptyWeaponTypes() {
    let sql = "SELECT * FROM weapons WHERE weaponType IS NULL;";
    return new Promise((res, rej) => {
        db.all(sql, [], (err, rows) => {
            if (err) {
                rej(err);
            }
            res(rows);
        })
    });
}

async function getWeaponTypeNames() {
    let sql = "SELECT * FROM weaponType;";
    return new Promise((res, rej) => {
        db.all(sql, [], (err, rows) => {
            if (err) {
                rej(err);
            }
            res(rows);
        })
    });
}

async function searchWeaponNames(name) {
    return new Promise( (res, rej) => {
        let sql = `SELECT * FROM weapons WHERE name LIKE ${"'%" + name + "%'"};`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                rej(err);
            }
            console.log(rows);
            res(rows);
        });
    });
}

function rowsToString(rows) {
    let str;
    
    for (let row of rows) {
        console.log(row);
    }
}

function isCommand(message) {
    return message.content.substr(0, 1) == '!';
}

function parseCommand(message) {
    split = message.substr(1).split(' ');
    ret = {
        command: split[0],
        values: split.slice(1)
    };
    console.log("Parsed these values");
    console.log(ret);

    return ret;
}

async function handleCommand(command, values, message) {
    if (!COMMANDS.includes(command)) {
        console.log(`Can't handle command ${command}`);
        return;
    }

    let response;

    switch (command) {
        case 'search':
        case 's':
            console.log(`Handling search for ${values[0]}`);
            response = await new Promise( async (res, rej) => {
                let rows = await searchWeaponNames(values[0]);
                let ret = "";
                // ret += `Weapon search for \'${values[0]}\'\n\n`;
                for (let row of rows) {
                    ret += `[${row.name}](${row.url})\n`;
                }
                res(ret);
            });
            break;
        case 'l':
        case 'learn':
        response = await new Promise(async (res, rej) => {
            let rows = await searchEmptyWeaponUrls();
            if (rows.length === 0) {
                rows = await searchEmptyWeaponTypes();
            }
            ret = "Can you give me the weapon type for the " + rows[0].name + "?\n\nRespond with the number or name and @ me to reply!\n\n";
            ret += "Weapon Types:\n\n";
            let weaponTypes = await getWeaponTypeNames();
            console.log(weaponTypes);
            for (let row of weaponTypes) {
                ret += `- ${row.name} (${row.id})\n`;
            }
            LEARNING_QUEUE[message.author.username] = {
                sql: `UPDATE weapons SET weaponType = \"?\" WHERE name = \"${rows[0].name}\"`
            };
            res(ret);
        });
        default:
            break;
    }

    return response;
}

function isAtMe(message) {
    ret = false;
    
    if (message.mentions && message.mentions.users) {
        for (pair of message.mentions.users) {
            if (pair[1].username == MY_USER_NAME) {
                ret = true;
            }
        }
    }
    return ret;
}

function handleLearning(message) {
    console.log("Got: " + message.content.replace(/\<@![0-9]*\>/, '').trim());
    if (LEARNING_QUEUE[message.author.username]) {
        db.all(LEARNING_QUEUE[message.author.username].sql.replace('?', parseInt(message.content.replace(/\<@![0-9]*\>/, '').trim())), (err, rows) => {
            if (err) {
                console.log("Something didn't work!");
                return;
            }

            delete LEARNING_QUEUE[message.author.username];

            message.reply("Thanks!!");
        })
    }
}

client.on('ready', () => {
    console.log(`${client.user.tag} is ready!\nUsing token: ${TOKEN}`);
});

client.on('messageCreate', async message => {
    if (isAtMe(message)) {
        handleLearning(message);
        return;
    }
    if (message.author.username != MY_USER_NAME && isCommand(message)) {
        // Parse the command
        let {command, values} = parseCommand(message.content);
        // Execute the command
        let response = await handleCommand(command, values, message);
        // Return the reponse to the command
        if (response) {
            message.reply(response);
        }
        return;
    }
})

process.on('SIGINT', () => {
    db.close();
})

client.login(TOKEN);