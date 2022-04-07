const fs = require("fs");
const { Client, Intents } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
var db = new sqlite3.Database('./database.db');

let MY_USER_NAME;
let MY_TEXT_ID;
let MY_AT;
const TOKEN = fs.readFileSync('./token.txt', {encoding: 'utf-8', flag: 'r'}).split('\n').filter(line => line.trim().charAt(0) != '#')[0].trim();

const SEARCH_COMMANDS = {
    "--url": false,
    "-u": false
}

const COMMANDS = {
    'search': SEARCH_COMMANDS,
    's': SEARCH_COMMANDS,
    'learn': {},
    'l': {},
    'help': {},
    'h': {}
};

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

async function searchItemNames(name) {
    return new Promise( (res, rej) => {
        let sql = `SELECT * FROM items WHERE name LIKE ?;`;
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

function parseCommand(messageObj) {
    try {
        let fname = "parseCommand";

        split = messageObj.content.substr(1).split(' ');

        let command = split[0];

        let options = {};

        // Defined here for use outside of loop's scope
        let i = 1;
        // Loop ends when non-option is encountered
        for (  ; i < split.length && split[i].substr(0, 1) === '-'; i++) {
            
            // If we can handle the option... (ignore unhandled options)
            if (Object.keys(COMMANDS[command]).includes(split[i])) {
                options[split[i]] = true;

                // If the option takes an argument
                if (COMMANDS[command][split[i]]) {
                    if (i >= split.length) {
                        // If we reach end of input too soon...
                        messageObj.reply(help());
                        return;
                    }
                    // Attach the next token to the option map
                    options[split[i]] = split[i + 1];
                    i++;
                }
            }
        }

        ret = {
            command: command,
            options: options,
            values: i < split.length ? split.slice(i) : []
        };
        log(fname, "ParseCommand:\tParsed these values");
        log(fname, ret);
        
        return ret;
    } catch (err) {
         console.log(JSON.stringify(err));
        }
    return;
}

function log(fname, obj) {
    let tag = new Date().toLocaleString();
    let objStr = JSON.stringify(obj, null, 2);
    if (typeof obj === 'string') {
        console.log(tag + '|' + fname + '|' + obj);
    } else {
        console.log(tag + '|' + fname + '|' + objStr);
    }
}

async function handleSearch(command, values, options) {
    let fname = 'handleSearch';
    
    let search = values.join(' ');
    log(fname, `Handling search for ${search}`);
    let rows = await searchWeaponNames(search);
    let ret = rows.length > 0 ? `Weapon search for \'${search}\'\n\n` : "";
    if (rows.length > 10) {
        ret += '\n[Too many results]\n';
    } else {
        for (let row of rows) {
            ret += `[${row.name}]${(options['-u'] || options['--url']) && row.url ? '(' + row.url + ')' : ''}\n`;
        }
    }
    rows = await searchItemNames(values[0]);
    ret += rows.length > 0 ? `\nItem search for \'${search}\'\n\n` : '';
    if (rows.length > 10) {
        ret += '\n[Too many results]\n';
    } else {
        for (let row of rows) {
            ret += `[${row.name}]${(options['-u'] || options['--url']) && row.url ? '(' + row.url + ')' : ''}\n`;
        }
    }
    if (ret === "") {
        return "No results found...";
    }
    return ret;
}

async function handleCommand(command, values, message, options) {
    let fname = 'handleCommand';
    
    if (!COMMANDS[command]) {
        log(fname, `Can't handle command ${command}`);
        message.reply(help());
        return;
    }

    let response;

    switch (command) {
        case 'search':
        case 's':
            response = handleSearch(command, values, options);
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
    response += "\tSearch for items (Currently only supports weapons and items).\n\n";
    response += "\t-u\t:\n";
    response += "\t--url\t:  Include the URLs to the results if the data is present.\n\n";
    response += "**!l or !learn**\n";
    response += "\tHelp ERB learn! ERB will prompt you to help expand his knowledge! Reply by putting @Elden-Ring-Buddy somewhere in your message along with your reply to respond.";
    return response;
}

function isAtMe(message) {
    ret = false;
    // console.log(`isAtMe: Received this message content:${message.content}`);
    if (message.mentions && message.mentions.users) {
        ret = message.content.includes(MY_TEXT_ID) || message.content.includes(MY_AT);
        for (pair of message.mentions.users) {
            if (pair[1].username == MY_USER_NAME) {
                ret = true;
            }
        }
    }
    return ret;
}

function handleLearning(message) {
    let fname = 'handleLearning';
    
    log(fname, "Got: " + message.content.replace(/\<@![0-9]*\>/, '').trim());
    const learningRecord = ACTIVE_LEARNING_RECORDS[message.author.username];
    if (learningRecord) {
        db.all(learningRecord, [message.content.replace(/\<@![0-9]*\>/, '').trim()], (err, rows) => {
            if (err) {
                log(fname, "Something didn't work!");
                log(fname, err);
                log(fname, learningRecord);
                log(fname, message.content.replace(/\<@![0-9]*\>/, '').trim());
                message.reply("Oops... Something didn't work!");
                return;
            }

            delete ACTIVE_LEARNING_RECORDS[message.author.username];

            message.reply("Thanks!!");
            log(fname, "updated database");
        });
    } else {
        log(fname, "no learning record");
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
            prompt: `Can you give me the "effect" for the ${row.name} (${encodeURI(`https://eldenring.wiki.fextralife.com/${row.name}`)}  )? Reply to me with an @ to submit your response!`,
            sql: `UPDATE items SET effect = ? WHERE name = \"${row.name}\"`
        });
    }
}

client.on('ready', () => {
    let fname = "client.on('ready'...";
    buildLearningQueue().then(() => {
        log(fname, `${client.user.tag} is ready!\nUsing token: ${TOKEN}`);
        MY_TEXT_ID = `<@${client.user.id}>`
        MY_USER_NAME = client.user.username.slice(0);
        MY_AT = '@' + MY_USER_NAME;
        log(fname, MY_TEXT_ID);
        log(fname, client.user);
    });
});

client.on('messageCreate', async message => {
    let fname = 'client.on(\'messageCreate\'...';
    if (message.author.username != MY_USER_NAME && isAtMe(message)) {
        log(fname, "Handling learning...");
        handleLearning(message);
        return;
    }
    if (isCommand(message)) {
        // Parse the command, steps in this phase are responsible for replying to the message themselves
        let parsed = parseCommand(message);
        if (!parsed) {
            return;
        }
        let {command, values, options} = parsed;
        // Execute the command
        let response = await handleCommand(command, values, message, options);
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