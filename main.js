const fs = require("fs");
const { Client, Intents } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
var db = new sqlite3.Database('./database.db');

const MY_USER_NAME = 'Elden-Ring-Buddy';
const MY_TEXT_ID = '@&955996044422959177';
const TOKEN = fs.readFileSync('./token.txt', {encoding: 'utf-8', flag: 'r'}).split('\n').filter(line => line.trim().charAt(0) != '#')[0].trim();

const COMMANDS = [
    'search',
    's',
    'learn',
    'l',
    'help',
    'h'
];

const ACTIVE_LEARNING_RECORDS = {};

const LEARNING_QUEUE = [];

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

async function searchEmptyItemEffects() {
    let sql = "SELECT * FROM items WHERE effect IS NULL;";
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
        let sql = `SELECT * FROM weapons WHERE name LIKE ?;`;
        db.all(sql, ["%"+name+"%"], (err, rows) => {
            if (err) {
                rej(err);
            }
            res(rows);
        });
    });
}

function rowsToString(rows) {
    let str;
    
    for (let row of rows) {
        str += `${row.toString()}\n`;
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
        message.reply(help());
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
        case 'learn':
        case 'l':
            if (LEARNING_QUEUE.length > 0) {
                let prompt = LEARNING_QUEUE.pop();
                response = prompt.prompt;
                ACTIVE_LEARNING_RECORDS[message.author.username] = prompt.sql;
            } else {
                response = "Whoops! You taught me so much, I'm not smart enough to say what I don't know, so check back later!";
            }
            break;
        case 'help':
        case 'h':
            response = help();
            break;    
        default:
            break;
    }

    return response;
}

function help() {
    let response = "I'm Elden-Ring-Buddy, or ERB!\n";
    response += "\n";
    response += "__Commands:__\n";
    response += "\n";
    response += "**!h or !help:**\n";
    response += "\tDisplay this help message.\n\n";
    response += "**!s or !search**\n";
    response += "\tSearch for items (Currently only supports weapons).\n\n";
    response += "**!l or !learn**\n";
    response += "\tHelp ERB learn! ERB will prompt you to help expand his knowledge! Reply by putting @Elden-Ring-Buddy somewhere in your message along with your reply to respond.";
    return response;
}

function isAtMe(message) {
    ret = false;
    
    if (message.mentions && message.mentions.users) {
        ret = message.content.includes(MY_TEXT_ID);
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
    const learningRecord = ACTIVE_LEARNING_RECORDS[message.author.username];
    if (learningRecord) {
        db.all(learningRecord, [message.content.replace(/\<@![0-9]*\>/, '').trim()], (err, rows) => {
            if (err) {
                console.log("Something didn't work!");
                console.log(err);
                console.log(learningRecord);
                console.log(message.content.replace(/\<@![0-9]*\>/, '').trim());
                message.reply("Oops... Something didn't work!");
                return;
            }

            delete ACTIVE_LEARNING_RECORDS[message.author.username];

            message.reply("Thanks!!");
            console.log("updated database");
        });
    }
}

async function buildLearningQueue() {
    let emptyWeaponUrls = await searchEmptyWeaponUrls();
    for (let row of emptyWeaponUrls) {
        LEARNING_QUEUE.push({
            prompt: `Can you give me the URL for the ${row.name}? Reply to me with an @ to submit your response!`,
            sql: `UPDATE items SET url = \"?\" WHERE name = \"${row.name}\"`
        });
    }

    let emptyWeaponTypes = await searchEmptyWeaponTypes();
    for (let row of emptyWeaponTypes) {
        LEARNING_QUEUE.push({
            prompt: `Can you give me the weapon Type for the ${row.name}?\nWeapon Types Include:\nAxes\nBallistas\nBows\nClaws\nColossal Swords\nCollosal Weapons\nCrossbows\nCurved Greatswords\nCurved Swords\nDaggers\nFists\nFlails\nGlintstone Staffs\nGreataxes\nGreatbows\nGreat Spears\nGreatswords\nHalberds\nHammers\nHeavy Thrusting Swords\nKatanas\nLight Bows\nReapers\nSacred Seals\nSpears\nStraight Swords\nThrusting Swords\nTorches\nTwinblades\nWhips\n\nReply to me with an @ to submit your response!`,
            sql: `UPDATE items SET weaponType = \"?\" WHERE name = \"${row.name}\"`
        });
    }

    let emptyItemEffects = await searchEmptyItemEffects();
    for (let row of emptyItemEffects) {
        LEARNING_QUEUE.push({
            prompt: `Can you give me the "effect" for the ${row.name}? Reply to me with an @ to submit your response!`,
            sql: `UPDATE items SET effect = ? WHERE name = \"${row.name}\"`
        });
    }
}

client.on('ready', () => {
    buildLearningQueue().then(() => {
        console.log(`${client.user.tag} is ready!\nUsing token: ${TOKEN}`);
    });
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