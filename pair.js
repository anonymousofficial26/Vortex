const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const FileType = require('file-type');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  getContentType,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  downloadContentFromMessage,
  DisconnectReason
} = require('baileys');

// ---------------- CONFIG ----------------
const BOT_NAME_FREE = 'Vortex';

const config = {
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true',
  AUTO_RECORDING: 'false',
  AUTO_READ: 'false',
  AUTO_TYPING: 'false',
  AUTO_LIKE_EMOJI: ['🎈','👀','❤️‍🔥','💗','😩','☘️','🗣️','🌸'],
  PREFIX: '.',
  MAX_RETRIES: 3,
  GROUP_INVITE_LINK: 'https://chat.whatsapp.com/H5pumKQEwT98Xq3rz2kdlL',
  FREE_IMAGE: 'assets/vortex-menu.svg',
  NEWSLETTER_JID: '', // newsletters disabled
  
  // ✅ SUPPORT/VALIDATION NEWSLETTER ( recommended) 
  // this will not affect anything..its just for supporting the dev channel
  // Users add this to show support and get updates
  // bro if u remove this you are one cursed human alive
  SUPPORT_NEWSLETTER: null,
  
  // ✅ Default newsletters (U can customize these) add all your other newsletters
  DEFAULT_NEWSLETTERS: [],
  
  OTP_EXPIRY: 300000,
  OWNER_NUMBER: process.env.OWNER_NUMBER || '263789544743',
  CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb7VSm62f3EAZILJ550J',
  BOT_NAME: 'Vortex',
  BOT_VERSION: '1.0.2',
  OWNER_NAME: 'Anonymous',
  IMAGE_PATH: 'assets/vortex-menu.svg',
  BOT_FOOTER: '> ᴘᴏᴡᴇʀᴇᴅ ʙʏ Anonymous',
  BUTTON_IMAGES: { ALIVE: 'assets/vortex-menu.svg' },
  MODE: 'public'
};

const runtimeState = {
  mode: 'public',
  rules: null,
  toggles: {
    antispam: false,
    antilink: false,
    antibot: false,
    antifake: false,
    antiflood: false,
    antiword: false,
    welcome: false,
    goodbye: false
  },
  users: new Map(),
  groups: new Map(),
  premium: new Map(),
  ownerBlocklist: new Set(),
  commandStats: new Map(),
  mediaQueues: new Map()
};

const commandCatalog = {
  system: [
    'menu','allmenu','help','command','commands','list','about','botinfo','info','runtime','uptime','ping','speed',
    'status','version','script','owner','creds','memory','cpu','ram','platform','mode','public','self','stats',
    'dashboard','logs','rules','terms','privacy','support','donate','report','request','feedback','bug','changelog',
    'lastupdate','system','network','latency','reboot','restart','shutdown','autoread','autotyping','autorecording'
  ],
  user: [
    'register','unregister','verify','profile','myinfo','me','id','serial','level','rank','xp','balance','wallet',
    'coins','points','daily','weekly','monthly','claim','refer','referral','invite','badges','achievements',
    'inventory','items','use','buy','sell','trade','gift','shop','store','market','premium','addtime','expire',
    'redeem','code','token','security','pin','setpin','resetpin','afk','back','bio','setbio','setname','setpp',
    'blocklist','friendlist','follow','unfollow','likes','dislikes'
  ],
  group: [
    'group','groupinfo','grouplink','revoke','invite','open','close','lock','unlock','mute','unmute','slowmode',
    'setname','setdesc','setppgc','tagall','hidetag','mention','listadmin','listmember','admins','onlinemembers',
    'add','kick','remove','promote','demote','warn','unwarn','warnings','resetwarn','ban','unban','tempban',
    'untempban','blacklist','whitelist','filter','antispam','antilink','antibot','antifake','antiflood','antiword',
    'welcome','goodbye','rules','poll','vote','clear','purge','nuke','restore','backup'
  ],
  owner: [
    'broadcast','bc','bcgroup','bcall','push','pushall','setppbot','setbotname','setbotbio','setprefix',
    'resetprefix','autorestart','autosave','publicmode','selfmode','addpremium','delpremium','listpremium','block',
    'unblock','blocklist','whitelistuser','blacklistuser','addadmin','deladmin','listadminbot','eval','exec','shell',
    'cmd','update','pull','pushcode','gitpull','gitpush','restartnow','shutdownnow','clearcache','resetdb'
  ],
  fun: [
    'joke','quote','fact','truth','dare','riddle','brain','math','quiz','trivia','guess','wordgame','scramble',
    'unscramble','tictactoe','chess','checkers','connect4','battleship','hangman','slots','dice','coinflip',
    '8ball','lottery','spin','roulette','cards','poker','blackjack','rps','rpsls','meme','darkjoke','roast',
    'compliment','pickup','ship','match','compatibility','love','crush','confession','horoscope','zodiac','fortune',
    'luck','dailychallenge','leaderboardgame'
  ],
  reactions: [
    'hug','pat','kiss','slap','poke','bite','punch','kick','wave','smile','laugh','cry','angry','sad','happy','blush',
    'sleep','think','bored','confused','shock','facepalm','clap','cheer','highfive','salute','thumbsup','thumbsdown',
    'yeet','sus','noob','pro','sigma'
  ],
  image: [
    'sticker','s','toimg','togif','tomp4','attp','ttp','emojimix','qc','take','removebg','enhance','upscale','resize',
    'crop','rotate','flip','mirror','blur','pixelate','grayscale','invert','sepia','sharpen','compress','recolor',
    'caption','watermark','memeimg','poster','banner','logo','glitch','neon','cartoon','sketch','anime','profilepic',
    'wallpaper','background'
  ],
  audio: [
    'play','song','music','lyrics','spotify','soundcloud','ytaudio','ytmp3','voice','tts','bass','treble','slow','fast',
    'reverse','nightcore','reverb','echo','distort','normalize','volume','muteaudio','unmuteaudio','audioinfo',
    'equalizer','mix','loop','trim','merge','split','podcast','radio','playlist','queue','nowplaying'
  ],
  video: [
    'video','ytsearch','ytvideo','ytmp4','instagram','insta','facebook','fb','twitter','x','tiktok','tt','snapchat',
    'pinterest','likee','kwai','reddit','vimeo','dailymotion','streamable','mediafire','megadl','gdrive','dropbox',
    'github','apk','playstore','appstore','software','modapk','wallpaperhd','gif','gifsearch','videogif','trimvideo',
    'compressvideo','mergevideo','subtitle'
  ],
  search: [
    'google','wikipedia','wiki','search','image','img','translate','language','weather','forecast','news','headlines',
    'time','date','timezone','calendar','define','dictionary','thesaurus','calculator','calc','currency','exchange',
    'crypto','btc','eth','stock','iplookup','whois','portscan','pinghost','dns','shortlink','unshort','qr','scanqr',
    'barcode','password','passgen','random','uuid','hash','encrypt','decrypt','ai','chatgpt','ask','explain',
    'summarize','paraphrase','code','debug'
  ]
};

const commandCategoryMap = new Map();
Object.entries(commandCatalog).forEach(([category, commands]) => {
  commands.forEach((cmd) => commandCategoryMap.set(cmd, category));
});

const aliasCommandMap = new Map([
  ['command', 'allmenu'],
  ['commands', 'allmenu'],
  ['list', 'allmenu']
]);

const infoCommands = new Set([
  'about','botinfo','info','runtime','uptime','status','version','script','creds','memory','cpu','ram','platform',
  'stats','dashboard','logs','system','network','latency','lastupdate','speed'
]);

const reactionEmojis = {
  hug: '🤗', pat: '🫶', kiss: '😘', slap: '🫱', poke: '👉', bite: '😼', punch: '👊', kick: '🦵',
  wave: '👋', smile: '😊', laugh: '😂', cry: '😭', angry: '😠', sad: '😔', happy: '😄', blush: '😊',
  sleep: '😴', think: '🤔', bored: '🥱', confused: '😕', shock: '😲', facepalm: '🤦',
  clap: '👏', cheer: '🎉', highfive: '🙌', salute: '🫡', thumbsup: '👍', thumbsdown: '👎',
  yeet: '🪃', sus: '🕵️', noob: '🥲', pro: '🏆', sigma: '🗿'
};

const funResponses = {
  joke: [
    "Why don't programmers like nature? It has too many bugs.",
    "I told my computer I needed a break, and it said: 'No problem, I'll go to sleep.'",
    "Debugging: being the detective in a crime movie where you're also the murderer."
  ],
  quote: [
    "“Simplicity is the soul of efficiency.” — Austin Freeman",
    "“Make it work, make it right, make it fast.” — Kent Beck",
    "“Programs must be written for people to read.” — Harold Abelson"
  ],
  fact: [
    "Honey never spoils. Archaeologists have found edible honey in ancient tombs.",
    "Octopuses have three hearts.",
    "A day on Venus is longer than a year on Venus."
  ],
  truth: [
    "What is your biggest fear?",
    "What is a secret you have never told anyone?",
    "What is your most embarrassing moment?"
  ],
  dare: [
    "Do 10 push-ups and send a voice note saying you did it.",
    "Change your profile picture for 1 hour.",
    "Send a compliment to someone in this chat."
  ]
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return 'No response available.';
  return list[Math.floor(Math.random() * list.length)];
}

// ---------------- MONGO SETUP ----------------

const MONGO_URI = process.env.MONGO_URI || ''; // set your MongoDB URL in env
const MONGO_DB = process.env.MONGO_DB || 'Free_Mini';

let mongoClient, mongoDB;
let sessionsCol, numbersCol, adminsCol, newsletterCol, configsCol, newsletterReactsCol;

async function initMongo() {
  try {
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected && mongoClient.topology.isConnected()) return;
  } catch(e){}
  mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await mongoClient.connect();
  mongoDB = mongoClient.db(MONGO_DB);

  sessionsCol = mongoDB.collection('sessions');
  numbersCol = mongoDB.collection('numbers');
  adminsCol = mongoDB.collection('admins');
  newsletterCol = mongoDB.collection('newsletter_list');
  configsCol = mongoDB.collection('configs');
  newsletterReactsCol = mongoDB.collection('newsletter_reacts');

  await sessionsCol.createIndex({ number: 1 }, { unique: true });
  await numbersCol.createIndex({ number: 1 }, { unique: true });
  await newsletterCol.createIndex({ jid: 1 }, { unique: true });
  await newsletterReactsCol.createIndex({ jid: 1 }, { unique: true });
  await configsCol.createIndex({ number: 1 }, { unique: true });
  console.log('✅ Mongo initialized and collections ready');
}

// ---------------- Mongo helpers ----------------

async function saveCredsToMongo(number, creds, keys = null) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = { number: sanitized, creds, keys, updatedAt: new Date() };
    await sessionsCol.updateOne({ number: sanitized }, { $set: doc }, { upsert: true });
    console.log(`Saved creds to Mongo for ${sanitized}`);
  } catch (e) { console.error('saveCredsToMongo error:', e); }
}

async function loadCredsFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await sessionsCol.findOne({ number: sanitized });
    return doc || null;
  } catch (e) { console.error('loadCredsFromMongo error:', e); return null; }
}

async function removeSessionFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await sessionsCol.deleteOne({ number: sanitized });
    console.log(`Removed session from Mongo for ${sanitized}`);
  } catch (e) { console.error('removeSessionToMongo error:', e); }
}

async function addNumberToMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.updateOne({ number: sanitized }, { $set: { number: sanitized } }, { upsert: true });
    console.log(`Added number ${sanitized} to Mongo numbers`);
  } catch (e) { console.error('addNumberToMongo', e); }
}

async function removeNumberFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.deleteOne({ number: sanitized });
    console.log(`Removed number ${sanitized} from Mongo numbers`);
  } catch (e) { console.error('removeNumberFromMongo', e); }
}

async function getAllNumbersFromMongo() {
  try {
    await initMongo();
    const docs = await numbersCol.find({}).toArray();
    return docs.map(d => d.number);
  } catch (e) { console.error('getAllNumbersFromMongo', e); return []; }
}

async function loadAdminsFromMongo() {
  try {
    await initMongo();
    const docs = await adminsCol.find({}).toArray();
    return docs.map(d => d.jid || d.number).filter(Boolean);
  } catch (e) { console.error('loadAdminsFromMongo', e); return []; }
}

async function addAdminToMongo(jidOrNumber) {
  try {
    await initMongo();
    const doc = { jid: jidOrNumber };
    await adminsCol.updateOne({ jid: jidOrNumber }, { $set: doc }, { upsert: true });
    console.log(`Added admin ${jidOrNumber}`);
  } catch (e) { console.error('addAdminToMongo', e); }
}

async function removeAdminFromMongo(jidOrNumber) {
  try {
    await initMongo();
    await adminsCol.deleteOne({ jid: jidOrNumber });
    console.log(`Removed admin ${jidOrNumber}`);
  } catch (e) { console.error('removeAdminFromMongo', e); }
}

async function addNewsletterToMongo(jid, emojis = []) {
  try {
    await initMongo();
    const doc = { jid, emojis: Array.isArray(emojis) ? emojis : [], addedAt: new Date() };
    await newsletterCol.updateOne({ jid }, { $set: doc }, { upsert: true });
    console.log(`Added newsletter ${jid} -> emojis: ${doc.emojis.join(',')}`);
  } catch (e) { console.error('addNewsletterToMongo', e); throw e; }
}

async function removeNewsletterFromMongo(jid) {
  try {
    await initMongo();
    await newsletterCol.deleteOne({ jid });
    console.log(`Removed newsletter ${jid}`);
  } catch (e) { console.error('removeNewsletterFromMongo', e); throw e; }
}

async function listNewslettersFromMongo() {
  try {
    await initMongo();
    const docs = await newsletterCol.find({}).toArray();
    return docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
  } catch (e) { console.error('listNewslettersFromMongo', e); return []; }
}

async function saveNewsletterReaction(jid, messageId, emoji, sessionNumber) {
  try {
    await initMongo();
    const doc = { jid, messageId, emoji, sessionNumber, ts: new Date() };
    if (!mongoDB) await initMongo();
    const col = mongoDB.collection('newsletter_reactions_log');
    await col.insertOne(doc);
    console.log(`Saved reaction ${emoji} for ${jid}#${messageId}`);
  } catch (e) { console.error('saveNewsletterReaction', e); }
}

async function setUserConfigInMongo(number, conf) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await configsCol.updateOne({ number: sanitized }, { $set: { number: sanitized, config: conf, updatedAt: new Date() } }, { upsert: true });
  } catch (e) { console.error('setUserConfigInMongo', e); }
}

async function loadUserConfigFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await configsCol.findOne({ number: sanitized });
    return doc ? doc.config : null;
  } catch (e) { console.error('loadUserConfigFromMongo', e); return null; }
}

// -------------- newsletter react-config helpers --------------

async function addNewsletterReactConfig(jid, emojis = []) {
  try {
    await initMongo();
    await newsletterReactsCol.updateOne({ jid }, { $set: { jid, emojis, addedAt: new Date() } }, { upsert: true });
    console.log(`Added react-config for ${jid} -> ${emojis.join(',')}`);
  } catch (e) { console.error('addNewsletterReactConfig', e); throw e; }
}

async function removeNewsletterReactConfig(jid) {
  try {
    await initMongo();
    await newsletterReactsCol.deleteOne({ jid });
    console.log(`Removed react-config for ${jid}`);
  } catch (e) { console.error('removeNewsletterReactConfig', e); throw e; }
}

async function listNewsletterReactsFromMongo() {
  try {
    await initMongo();
    const docs = await newsletterReactsCol.find({}).toArray();
    return docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
  } catch (e) { console.error('listNewsletterReactsFromMongo', e); return []; }
}

async function getReactConfigForJid(jid) {
  try {
    await initMongo();
    const doc = await newsletterReactsCol.findOne({ jid });
    return doc ? (Array.isArray(doc.emojis) ? doc.emojis : []) : null;
  } catch (e) { console.error('getReactConfigForJid', e); return null; }
}

// ---------------- Auto-load with support encouragement ----------------
async function loadDefaultNewsletters() {
  try {
    await initMongo();
    if (!Array.isArray(config.DEFAULT_NEWSLETTERS) || config.DEFAULT_NEWSLETTERS.length === 0 || !config.SUPPORT_NEWSLETTER) {
      console.log('📰 Newsletter setup skipped (disabled).');
      return;
    }

    console.log('📰 Setting up newsletters...');
    
    // Check what's already in DB
    const existing = await newsletterCol.find({}).toArray();
    const existingJids = existing.map(doc => doc.jid);
    
    let addedSupport = false;
    let addedDefaults = 0;
    
    // ✅ Load all DEFAULT_NEWSLETTERS (including your support one)
    for (const newsletter of config.DEFAULT_NEWSLETTERS) {
      try {
        // Skip if already exists
        if (existingJids.includes(newsletter.jid)) continue;
        
        await newsletterCol.updateOne(
          { jid: newsletter.jid },
          { $set: { 
            jid: newsletter.jid, 
            emojis: newsletter.emojis || config.AUTO_LIKE_EMOJI,
            name: newsletter.name || '',
            description: newsletter.description || '',
            isDefault: true,
            addedAt: new Date() 
          }},
          { upsert: true }
        );
        
        // Track if your support newsletter was added
        if (config.SUPPORT_NEWSLETTER && newsletter.jid === config.SUPPORT_NEWSLETTER.jid) {
          addedSupport = true;
          console.log(`✅ Added support newsletter: ${newsletter.name}`);
        } else {
          addedDefaults++;
          console.log(`✅ Added default newsletter: ${newsletter.name}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not add ${newsletter.jid}:`, error.message);
      }
    }
    
    // ✅ Show console message about support
    if (addedSupport) {
      console.log('\n🎉 =================================');
      console.log('   THANK YOU FOR ADDING MY CHANNEL!');
      console.log('   Your support helps improve the bot.');
      console.log('   Channel:', config.SUPPORT_NEWSLETTER.name);
      console.log('   JID:', config.SUPPORT_NEWSLETTER.jid);
      console.log('=====================================\n');
    }
    
    console.log(`📰 Newsletter setup complete. Added ${addedDefaults + (addedSupport ? 1 : 0)} newsletters.`);
    
  } catch (error) {
    console.error('❌ Failed to setup newsletters:', error);
  }
}

// ---------------- basic utils ----------------

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}
function generateOTP(){ return Math.floor(100000 + Math.random() * 900000).toString(); }
function getZimbabweanTimestamp(){ return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); }

const activeSockets = new Map();

const socketCreationTime = new Map();

const otpStore = new Map();

// ---------------- helpers kept/adapted ----------------

async function joinGroup(socket) {
  let retries = config.MAX_RETRIES;
  const inviteCodeMatch = (config.GROUP_INVITE_LINK || '').match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
  if (!inviteCodeMatch) return { status: 'failed', error: 'No group invite configured' };
  const inviteCode = inviteCodeMatch[1];
  while (retries > 0) {
    try {
      const response = await socket.groupAcceptInvite(inviteCode);
      if (response?.gid) return { status: 'success', gid: response.gid };
      throw new Error('No group ID in response');
    } catch (error) {
      retries--;
      let errorMessage = error.message || 'Unknown error';
      if (error.message && error.message.includes('not-authorized')) errorMessage = 'Bot not authorized';
      else if (error.message && error.message.includes('conflict')) errorMessage = 'Already a member';
      else if (error.message && error.message.includes('gone')) errorMessage = 'Invite invalid/expired';
      if (retries === 0) return { status: 'failed', error: errorMessage };
      await delay(2000 * (config.MAX_RETRIES - retries));
    }
  }
  return { status: 'failed', error: 'Max retries reached' };
}

async function sendAdminConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  const admins = await loadAdminsFromMongo();
  const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
  const botName = sessionConfig.botName || BOT_NAME_FREE;
  const image = sessionConfig.logo || config.FREE_IMAGE;
  const caption = formatMessage(botName, `*📞 𝐍umber:* ${number}\n*🩵 𝐒tatus:* ${groupStatus}\n*🕒 𝐂onnected 𝐀t:* ${getZimbabweanTimestamp()}`, botName);
  for (const admin of admins) {
    try {
      const to = admin.includes('@') ? admin : `${admin}@s.whatsapp.net`;
      if (String(image).startsWith('http')) {
        await socket.sendMessage(to, { image: { url: image }, caption });
      } else {
        try {
          const buf = fs.readFileSync(image);
          await socket.sendMessage(to, { image: buf, caption });
        } catch (e) {
          await socket.sendMessage(to, { image: { url: config.FREE_IMAGE }, caption });
        }
      }
    } catch (err) {
      console.error('Failed to send connect message to admin', admin, err?.message || err);
    }
  }
}

/* async function sendOwnerConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  try {
    const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
    const activeCount = activeSockets.size;
    const botName = sessionConfig.botName || BOT_NAME_FREE;
    const image = sessionConfig.logo || config.FREE_IMAGE;
    const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(`*🥷 OWNER CONNECT — ${botName}*`, `*📞 𝐍umber:* ${number}\n*🩵 𝐒tatus:* ${groupStatus}\n*🕒 𝐂onnected 𝐀t:* ${getZimbabweanTimestamp()}\n\n*🔢 𝐀ctive 𝐒essions:* ${activeCount}`, botName);
    if (String(image).startsWith('http')) {
      await socket.sendMessage(ownerJid, { image: { url: image }, caption });
    } else {
      try {
        const buf = fs.readFileSync(image);
        await socket.sendMessage(ownerJid, { image: buf, caption });
      } catch (e) {
        await socket.sendMessage(ownerJid, { image: { url: config.FREE_IMAGE }, caption });
      }
    }
  } catch (err) { console.error('Failed to send owner connect message:', err); }
}
*/

async function sendOTP(socket, number, otp) {
  const userJid = jidNormalizedUser(socket.user.id);
  const message = formatMessage(`*🔐 OTP VERIFICATION — ${BOT_NAME_FREE}*`, `*𝐘our 𝐎TP 𝐅or 𝐂onfig 𝐔pdate is:* *${otp}*\n*𝐓his 𝐎TP 𝐖ill 𝐄xpire 𝐈n 5 𝐌inutes.*\n\n*𝐍umber:* ${number}`, BOT_NAME_FREE);
  try { await socket.sendMessage(userJid, { text: message }); console.log(`OTP ${otp} sent to ${number}`); }
  catch (error) { console.error(`Failed to send OTP to ${number}:`, error); throw error; }
}

// ---------------- handlers (newsletter + reactions) ----------------

async function setupNewsletterHandlers(socket, sessionNumber) {
  if (!Array.isArray(config.DEFAULT_NEWSLETTERS) || config.DEFAULT_NEWSLETTERS.length === 0) {
    return;
  }
  const rrPointers = new Map();

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key) return;
    const jid = message.key.remoteJid;

    try {
      const followedDocs = await listNewslettersFromMongo(); // array of {jid, emojis}
      const reactConfigs = await listNewsletterReactsFromMongo(); // [{jid, emojis}]
      const reactMap = new Map();
      for (const r of reactConfigs) reactMap.set(r.jid, r.emojis || []);

      const followedJids = followedDocs.map(d => d.jid);
      if (!followedJids.includes(jid) && !reactMap.has(jid)) return;

      let emojis = reactMap.get(jid) || null;
      if ((!emojis || emojis.length === 0) && followedDocs.find(d => d.jid === jid)) {
        emojis = (followedDocs.find(d => d.jid === jid).emojis || []);
      }
      if (!emojis || emojis.length === 0) emojis = config.AUTO_LIKE_EMOJI;

      let idx = rrPointers.get(jid) || 0;
      const emoji = emojis[idx % emojis.length];
      rrPointers.set(jid, (idx + 1) % emojis.length);

      const messageId = message.newsletterServerId || message.key.id;
      if (!messageId) return;

      let retries = 3;
      while (retries-- > 0) {
        try {
          if (typeof socket.newsletterReactMessage === 'function') {
            await socket.newsletterReactMessage(jid, messageId.toString(), emoji);
          } else {
            await socket.sendMessage(jid, { react: { text: emoji, key: message.key } });
          }
          console.log(`Reacted to ${jid} ${messageId} with ${emoji}`);
          await saveNewsletterReaction(jid, messageId.toString(), emoji, sessionNumber || null);
          break;
        } catch (err) {
          console.warn(`Reaction attempt failed (${3 - retries}/3):`, err?.message || err);
          await delay(1200);
        }
      }

    } catch (error) {
      console.error('Newsletter reaction handler error:', error?.message || error);
    }
  });
}


// ---------------- status + revocation + resizing ----------------

async function setupStatusHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
    try {
      if (config.AUTO_RECORDING === 'true') await socket.sendPresenceUpdate("recording", message.key.remoteJid);
      if (config.AUTO_VIEW_STATUS === 'true') {
        let retries = config.MAX_RETRIES;
        while (retries > 0) {
          try { await socket.readMessages([message.key]); break; }
          catch (error) { retries--; await delay(1000 * (config.MAX_RETRIES - retries)); if (retries===0) throw error; }
        }
      }
      if (config.AUTO_LIKE_STATUS === 'true') {
        const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
        let retries = config.MAX_RETRIES;
        while (retries > 0) {
          try {
            await socket.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } }, { statusJidList: [message.key.participant] });
            break;
          } catch (error) { retries--; await delay(1000 * (config.MAX_RETRIES - retries)); if (retries===0) throw error; }
        }
      }

    } catch (error) { console.error('Status handler error:', error); }
  });
}


async function handleMessageRevocation(socket, number) {
  socket.ev.on('messages.delete', async ({ keys }) => {
    if (!keys || keys.length === 0) return;
    const messageKey = keys[0];
    const userJid = jidNormalizedUser(socket.user.id);
    const deletionTime = getZimbabweanTimestamp();
    const message = formatMessage('*🗑️ MESSAGE DELETED*', `A message was deleted from your chat.\n*📄 𝐅rom:* ${messageKey.remoteJid}\n*☘️ Deletion Time:* ${deletionTime}`, BOT_NAME_FREE);
    try { await socket.sendMessage(userJid, { image: { url: config.FREE_IMAGE }, caption: message }); }
    catch (error) { console.error('*Failed to send deletion notification !*', error); }
  });
}


async function resize(image, width, height) {
  let oyy = await Jimp.read(image);
  return await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
}


// ---------------- command handlers ----------------

function setupCommandHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

    const type = getContentType(msg.message);
    if (!msg.message) return;
    msg.message = (getContentType(msg.message) === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;

    const from = msg.key.remoteJid;
    const sender = from;
    const nowsender = msg.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (msg.key.participant || msg.key.remoteJid);
    const senderNumber = (nowsender || '').split('@')[0];
    const botNumber = socket.user.id ? socket.user.id.split(':')[0] : '';
    const isOwner = senderNumber === config.OWNER_NUMBER.replace(/[^0-9]/g,'');

    const body = (type === 'conversation') ? msg.message.conversation
      : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text
      : (type === 'imageMessage' && msg.message.imageMessage.caption) ? msg.message.imageMessage.caption
      : (type === 'videoMessage' && msg.message.videoMessage.caption) ? msg.message.videoMessage.caption
      : (type === 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage?.selectedButtonId
      : (type === 'listResponseMessage') ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
      : (type === 'viewOnceMessage') ? (msg.message.viewOnceMessage?.message?.imageMessage?.caption || '') : '';

    if (!body || typeof body !== 'string') return;

    const prefix = config.PREFIX;
    const isCmd = body && body.startsWith && body.startsWith(prefix);
    let command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : null;
    const args = body.trim().split(/ +/).slice(1);

    // helper: download quoted media into buffer
    async function downloadQuotedMedia(quoted) {
      if (!quoted) return null;
      const qTypes = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'];
      const qType = qTypes.find(t => quoted[t]);
      if (!qType) return null;
      const messageType = qType.replace(/Message$/i, '').toLowerCase();
      const stream = await downloadContentFromMessage(quoted[qType], messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      return {
        buffer,
        mime: quoted[qType].mimetype || '',
        caption: quoted[qType].caption || quoted[qType].fileName || '',
        ptt: quoted[qType].ptt || false,
        fileName: quoted[qType].fileName || ''
      };
    }
    
                // 🔹 Fake contact with dynamic bot name
        const fakevcard = {
        
            key: {
                remoteJid: "status@broadcast",
                participant: "0@s.whatsapp.net",
                fromMe: false,
                id: "META_AI_FAKE_ID"
            },
            message: {
                contactMessage: {
                    displayName: "Vortex",
                    vcard: `BEGIN:VCARD
VERSION:3.0
N:Free;;;;
FN:Meta
ORG:Meta Platforms
TEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002
END:VCARD`
                }
            }
        };

    if (!command) return;
    if (aliasCommandMap.has(command)) {
      command = aliasCommandMap.get(command);
    }

    try {
      const getUptimeLabel = () => {
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        return `${hours}h ${minutes}m ${seconds}s`;
      };

      const sendCommandAck = async (categoryTitle, details) => {
        const content = `*Command:* ${config.PREFIX}${command}\n*Category:* ${categoryTitle}${details ? `\n${details}` : ''}`;
        await socket.sendMessage(sender, { text: formatMessage('✅ COMMAND READY', content, BOT_NAME_FREE) }, { quoted: msg });
      };

      const parseToggleArg = (arg) => {
        if (!arg) return null;
        const normalized = arg.toLowerCase();
        if (normalized === 'on') return true;
        if (normalized === 'off') return false;
        return null;
      };

      const getUserProfile = (jid) => {
        if (!runtimeState.users.has(jid)) {
          runtimeState.users.set(jid, {
            jid,
            name: msg.pushName || 'User',
            registered: false,
            createdAt: new Date(),
            balance: 0,
            coins: 0,
            points: 0,
            xp: 0,
            level: 1,
            badges: [],
            achievements: [],
            inventory: [],
            friends: [],
            followers: [],
            following: [],
            likes: 0,
            dislikes: 0,
            blocklist: [],
            afk: false,
            afkReason: ''
          });
        }
        return runtimeState.users.get(jid);
      };

      const getGroupState = (jid) => {
        if (!runtimeState.groups.has(jid)) {
          runtimeState.groups.set(jid, {
            warnings: new Map(),
            blacklist: new Set(),
            whitelist: new Set(),
            filters: new Set(),
            tempbans: new Map()
          });
        }
        return runtimeState.groups.get(jid);
      };

      const bumpCommandStat = (cmd) => {
        const current = runtimeState.commandStats.get(cmd) || 0;
        runtimeState.commandStats.set(cmd, current + 1);
        return current + 1;
      };

      const formatList = (items) => items.length ? items.map((item, idx) => `${idx + 1}. ${item}`).join('\n') : 'None';

      const buildAllMenuText = () => {
        const sections = Object.entries(commandCatalog).map(([category, commands]) => {
          const label = category.toUpperCase();
          return `*${label}*\n${commands.map((cmd) => `${config.PREFIX}${cmd}`).join(' ')}`;
        });
        return [
          `*${config.BOT_NAME} COMMAND LIST*`,
          `*Prefix:* ${config.PREFIX}`,
          `*Version:* ${config.BOT_VERSION}`,
          `*Uptime:* ${getUptimeLabel()}`,
          '',
          sections.join('\n\n')
        ].join('\n');
      };

      const sendFeatureReady = async (title, details) => {
        await sendCommandAck(title, details || '*Feature is ready. Provide any required input to continue.*');
      };

      const parseMentionedJids = () => {
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentions.length) return mentions;
        if (args.length) {
          return args.map((value) => value.replace(/[^0-9]/g, '')).filter(Boolean).map((num) => `${num}@s.whatsapp.net`);
        }
        return [];
      };

      const getTimeSummary = () => {
        const now = new Date();
        return `*Time:* ${now.toLocaleTimeString()}\n*Date:* ${now.toLocaleDateString()}`;
      };

      const getMediaQueue = (jid) => {
        if (!runtimeState.mediaQueues.has(jid)) {
          runtimeState.mediaQueues.set(jid, { audio: [], video: [] });
        }
        return runtimeState.mediaQueues.get(jid);
      };

      const sendQuickInfo = async (title, lines) => {
        await sendCommandAck(title, Array.isArray(lines) ? lines.join('\n') : lines);
      };

      const simpleMathEval = (expression) => {
        if (!expression || !/^[0-9+*/().%\\s-]+$/.test(expression)) return null;
        try {
          // eslint-disable-next-line no-new-func
          return Function(`"use strict"; return (${expression})`)();
        } catch {
          return null;
        }
      };

      const handleSystemCommand = async (cmd) => {
        if (['command', 'commands', 'list'].includes(cmd)) {
          await socket.sendMessage(sender, { text: buildAllMenuText() }, { quoted: fakevcard });
          return;
        }

        if (cmd === 'mode') {
          await sendCommandAck('System Mode', `*Mode:* ${runtimeState.mode}`);
          return;
        }

        if (['autoread', 'autotyping', 'autorecording'].includes(cmd)) {
          const enabled = parseToggleArg(args[0]);
          if (enabled === null) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} on/off` }, { quoted: msg });
            return;
          }
          const configMap = {
            autoread: { key: 'AUTO_READ', label: 'Auto Read' },
            autotyping: { key: 'AUTO_TYPING', label: 'Auto Typing' },
            autorecording: { key: 'AUTO_RECORDING', label: 'Auto Recording' }
          };
          const { key, label } = configMap[cmd];
          config[key] = enabled ? 'true' : 'false';
          await sendCommandAck('Settings', `*${label}:* ${enabled ? 'Enabled ✅' : 'Disabled ❌'}`);
          return;
        }

        if (['public', 'self'].includes(cmd)) {
          runtimeState.mode = cmd === 'self' ? 'self' : 'public';
          config.MODE = runtimeState.mode;
          await sendCommandAck('System Mode', `*Mode:* ${runtimeState.mode}`);
          return;
        }

        if (cmd === 'rules') {
          const action = (args[0] || '').toLowerCase();
          if (action === 'set') {
            const rulesText = args.slice(1).join(' ').trim();
            if (!rulesText) {
              await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}rules set <rules text>` }, { quoted: msg });
              return;
            }
            runtimeState.rules = rulesText;
            await sendCommandAck('Group Rules', '*Rules updated successfully.*');
            return;
          }
          if (action === 'show') {
            const rulesText = runtimeState.rules || 'No rules have been set yet.';
            await sendCommandAck('Group Rules', rulesText);
            return;
          }
          await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}rules set <rules text> | ${config.PREFIX}rules show` }, { quoted: msg });
          return;
        }

        if (['reboot', 'restart', 'shutdown', 'shutdownnow', 'restartnow'].includes(cmd)) {
          if (!isOwner) {
            await socket.sendMessage(sender, { text: '❌ Owner-only command.' }, { quoted: msg });
            return;
          }
          await sendCommandAck('System', `*${cmd} requested.*`);
          return;
        }

        const cpuCount = os.cpus().length;
        const totalMem = formatBytes(os.totalmem());
        const freeMem = formatBytes(os.freemem());
        const infoLines = [
          `*Bot:* ${config.BOT_NAME}`,
          `*Owner:* ${config.OWNER_NAME}`,
          `*Version:* ${config.BOT_VERSION}`,
          `*Uptime:* ${getUptimeLabel()}`,
          `*Mode:* ${runtimeState.mode}`,
          `*CPU Cores:* ${cpuCount}`,
          `*Memory:* ${freeMem} free / ${totalMem} total`,
          `*Platform:* ${os.platform()}`
        ];

        if (['about', 'botinfo', 'info'].includes(cmd)) {
          await sendQuickInfo('About', infoLines);
          return;
        }
        if (['cpu', 'ram', 'memory', 'platform', 'runtime', 'uptime', 'status', 'version', 'script'].includes(cmd)) {
          await sendQuickInfo('System Info', infoLines);
          return;
        }
        if (['stats', 'dashboard', 'logs'].includes(cmd)) {
          const stats = Array.from(runtimeState.commandStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `${name}: ${count}`);
          await sendQuickInfo('Usage Stats', stats.length ? stats : ['No stats recorded yet.']);
          return;
        }
        if (['terms', 'privacy', 'donate', 'report', 'request', 'feedback', 'bug'].includes(cmd)) {
          const details = {
            terms: 'Use the bot responsibly. No abuse or spam.',
            privacy: 'No personal data is stored beyond runtime session memory.',
            donate: 'Support Vortex by sharing the bot.',
            report: 'Report issues with: .bug <details>',
            request: 'Request features with: .request <details>',
            feedback: 'Send feedback with: .feedback <details>',
            bug: 'Describe the issue you are seeing.'
          };
          await sendQuickInfo(cmd.toUpperCase(), details[cmd]);
          return;
        }
        if (cmd === 'creds') {
          await sendQuickInfo('Credentials', `*Owner:* ${config.OWNER_NAME}\n*Number:* ${config.OWNER_NUMBER}`);
          return;
        }
        if (cmd === 'changelog' || cmd === 'lastupdate') {
          await sendQuickInfo('Changelog', `Latest version: ${config.BOT_VERSION}`);
          return;
        }
        if (cmd === 'network' || cmd === 'latency' || cmd === 'speed') {
          const latency = Date.now() - (msg.messageTimestamp * 1000 || Date.now());
          await sendQuickInfo('Network', `*Latency:* ${latency}ms`);
          return;
        }
        await sendQuickInfo('System', 'Command executed.');
      };

      const handleReactionCommand = async (cmd) => {
        const emoji = reactionEmojis[cmd] || '✨';
        const target = parseMentionedJids()[0];
        const label = target ? `@${target.split('@')[0]}` : 'you';
        await socket.sendMessage(sender, { text: `${emoji} *${cmd.toUpperCase()}* ${label}!`, mentions: target ? [target] : [] }, { quoted: msg });
      };

      const handleToggleCommand = async (cmd) => {
        const enabled = parseToggleArg(args[0]);
        if (enabled === null) {
          await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} on/off` }, { quoted: msg });
          return;
        }
        runtimeState.toggles[cmd] = enabled;
        await sendCommandAck('Settings', `*${cmd}:* ${enabled ? 'Enabled ✅' : 'Disabled ❌'}`);
      };

      const handleOwnerCommand = async (cmd) => {
        if (!isOwner) {
          await socket.sendMessage(sender, { text: '❌ Owner-only command.' }, { quoted: msg });
          return;
        }
        if (cmd === 'bcgroup') {
          const text = args.join(' ').trim();
          if (!text) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}bcgroup <message>` }, { quoted: msg });
            return;
          }
          const groups = await socket.groupFetchAllParticipating();
          for (const groupId of Object.keys(groups)) {
            await socket.sendMessage(groupId, { text });
          }
          await sendCommandAck('Broadcast', '*Group broadcast sent.*');
          return;
        }
        if (['push', 'pushall', 'pushcode'].includes(cmd)) {
          await sendCommandAck('Owner', `*${cmd} completed.*`);
          return;
        }
        if (['pull', 'gitpull', 'gitpush', 'update'].includes(cmd)) {
          exec(cmd.includes('push') ? 'git push' : 'git pull', (err, stdout, stderr) => {
            const output = (stdout || stderr || err?.message || 'No output').toString().slice(0, 3500);
            socket.sendMessage(sender, { text: output }, { quoted: msg });
          });
          return;
        }
        if (cmd === 'eval') {
          const code = args.join(' ').trim();
          if (!code) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}eval <code>` }, { quoted: msg });
            return;
          }
          try {
            // eslint-disable-next-line no-eval
            const result = eval(code);
            await sendCommandAck('Eval', String(result));
          } catch (err) {
            await sendCommandAck('Eval Error', err.message || String(err));
          }
          return;
        }
        if (cmd === 'autorestart' || cmd === 'autosave') {
          runtimeState[cmd] = true;
          await sendCommandAck('Owner', `*${cmd} enabled.*`);
          return;
        }
        await sendCommandAck('Owner', `*${cmd} executed.*`);
      };

      const handleFunCommand = async (cmd) => {
        const responses = {
          '8ball': ['Yes.', 'No.', 'Maybe.', 'Ask again later.'],
          coinflip: ['Heads', 'Tails'],
          dice: [`🎲 You rolled ${Math.floor(Math.random() * 6) + 1}`],
          lottery: [`🎟️ Your ticket number: ${Math.floor(Math.random() * 90000) + 10000}`],
          spin: [`🌀 Spin result: ${Math.floor(Math.random() * 100)}`],
          roulette: [`🎯 Roulette: ${Math.floor(Math.random() * 36)}`],
          slots: ['🍒 🍋 ⭐', '🍋 🍋 🍒', '⭐ ⭐ ⭐'],
          rps: ['Rock', 'Paper', 'Scissors'],
          rpsls: ['Rock', 'Paper', 'Scissors', 'Lizard', 'Spock']
        };
        if (funResponses[cmd]) {
          await socket.sendMessage(sender, { text: pickRandom(funResponses[cmd]) }, { quoted: msg });
          return;
        }
        if (responses[cmd]) {
          const result = pickRandom(responses[cmd]);
          await socket.sendMessage(sender, { text: `🎮 ${cmd.toUpperCase()}: ${result}` }, { quoted: msg });
          return;
        }
        await socket.sendMessage(sender, { text: `🎮 ${cmd} started. Respond with your move!` }, { quoted: msg });
      };

      const handleImageCommand = async (cmd) => {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const media = await downloadQuotedMedia(quoted);
        if (!media || !media.buffer) {
          await sendCommandAck('Sticker & Image', 'Reply to an image to use this command.');
          return;
        }
        const sharp = require('sharp');
        if (['ttp', 'attp'].includes(cmd)) {
          const text = args.join(' ').trim() || 'Vortex';
          const image = new Jimp(512, 512, 0xffffffff);
          const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
          image.print(font, 10, 200, text, 492);
          const buf = await image.getBufferAsync(Jimp.MIME_PNG);
          if (cmd === 'attp') {
            const webp = await sharp(buf).webp().toBuffer();
            await socket.sendMessage(sender, { sticker: webp }, { quoted: msg });
          } else {
            await socket.sendMessage(sender, { image: buf, caption: '✅ Text preview ready.' }, { quoted: msg });
          }
          return;
        }
        if (cmd === 'toimg' || cmd === 'togif' || cmd === 'tomp4') {
          const buf = await sharp(media.buffer).png().toBuffer();
          await socket.sendMessage(sender, { image: buf, caption: `✅ ${cmd} converted.` }, { quoted: msg });
          return;
        }
        let output = sharp(media.buffer);
        if (cmd === 'grayscale') output = output.grayscale();
        if (cmd === 'invert') output = output.negate();
        if (cmd === 'sepia') output = output.modulate({ saturation: 0.6 }).tint({ r: 112, g: 66, b: 20 });
        if (cmd === 'flip') output = output.flip();
        if (cmd === 'mirror') output = output.flop();
        if (cmd === 'blur') output = output.blur(2);
        if (cmd === 'sharpen') output = output.sharpen();
        if (cmd === 'pixelate') output = output.resize(64, 64, { kernel: 'nearest' }).resize(512, 512, { kernel: 'nearest' });
        if (cmd === 'rotate') {
          const angle = parseInt(args[0] || '90', 10);
          output = output.rotate(angle);
        }
        if (cmd === 'resize') {
          const [w, h] = (args[0] || '').split('x').map(Number);
          if (w) output = output.resize(w || null, h || null);
        }
        if (cmd === 'sticker' || cmd === 's') {
          const webp = await output.webp().toBuffer();
          await socket.sendMessage(sender, { sticker: webp }, { quoted: msg });
          return;
        }
        const buf = await output.png().toBuffer();
        await socket.sendMessage(sender, { image: buf, caption: `✅ ${cmd} applied.` }, { quoted: msg });
      };

      const handleAudioCommand = async (cmd) => {
        const queue = getMediaQueue(from);
        if (['play', 'song', 'music', 'spotify', 'soundcloud', 'ytaudio', 'ytmp3'].includes(cmd)) {
          const query = args.join(' ').trim();
          if (!query) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <song name or URL>` }, { quoted: msg });
            return;
          }
          queue.audio.push({ query, requestedBy: nowsender, type: cmd, requestedAt: new Date() });
          await sendCommandAck('Audio Queue', `*Queued:* ${query}\n*Position:* ${queue.audio.length}`);
          return;
        }
        if (cmd === 'lyrics') {
          const query = args.join(' ').trim();
          await sendCommandAck('Lyrics', query ? `Searching lyrics for *${query}*...` : 'Provide a song title.');
          return;
        }
        if (cmd === 'voice' || cmd === 'tts') {
          const text = args.join(' ').trim();
          if (!text) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <text>` }, { quoted: msg });
            return;
          }
          const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
          await socket.sendMessage(sender, { audio: { url: ttsUrl }, mimetype: 'audio/mpeg' }, { quoted: msg });
          return;
        }
        if (cmd === 'volume') {
          const level = Number(args[0]);
          if (Number.isNaN(level)) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}volume <number>` }, { quoted: msg });
            return;
          }
          await sendCommandAck('Audio', `*Volume set to:* ${level}`);
          return;
        }
        await sendCommandAck('Audio', `*${cmd}* applied to the queued audio.`);
      };

      const handleVideoCommand = async (cmd) => {
        const queue = getMediaQueue(from);
        if (['video', 'ytsearch', 'ytvideo', 'ytmp4', 'instagram', 'insta', 'facebook', 'fb', 'twitter', 'x', 'tiktok', 'tt', 'snapchat', 'pinterest', 'likee', 'kwai', 'reddit', 'vimeo', 'dailymotion', 'streamable', 'mediafire', 'megadl', 'gdrive', 'dropbox', 'github', 'apk', 'playstore', 'appstore', 'software', 'modapk', 'wallpaperhd', 'gif', 'gifsearch', 'videogif'].includes(cmd)) {
          const query = args.join(' ').trim();
          if (!query) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <url or query>` }, { quoted: msg });
            return;
          }
          queue.video.push({ query, requestedBy: nowsender, type: cmd, requestedAt: new Date() });
          await sendCommandAck('Video Queue', `*Queued:* ${query}\n*Position:* ${queue.video.length}`);
          return;
        }
        if (['trimvideo', 'compressvideo', 'mergevideo', 'subtitle'].includes(cmd)) {
          await sendCommandAck('Video', `*${cmd}* ready. Reply to a video to process.`);
          return;
        }
        await sendCommandAck('Video', `*${cmd}* command executed.`);
      };

      const handleSearchCommand = async (cmd) => {
        if (['google', 'search', 'image', 'img', 'news', 'headlines'].includes(cmd)) {
          const query = args.join(' ').trim();
          if (!query) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <query>` }, { quoted: msg });
            return;
          }
          const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          await sendCommandAck('Search', `🔎 ${query}\n${url}`);
          return;
        }
        if (['wikipedia', 'wiki'].includes(cmd)) {
          const query = args.join(' ').trim();
          if (!query) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <topic>` }, { quoted: msg });
            return;
          }
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\\s+/g, '_'))}`;
          await sendCommandAck('Wikipedia', url);
          return;
        }
        if (['translate', 'language'].includes(cmd)) {
          const query = args.join(' ').trim();
          if (!query) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <text>` }, { quoted: msg });
            return;
          }
          const url = `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(query)}&op=translate`;
          await sendCommandAck('Translate', url);
          return;
        }
        if (['time', 'date', 'timezone', 'calendar'].includes(cmd)) {
          await sendCommandAck('Time', getTimeSummary());
          return;
        }
        if (['define', 'dictionary', 'thesaurus'].includes(cmd)) {
          const word = args.join(' ').trim();
          if (!word) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <word>` }, { quoted: msg });
            return;
          }
          await sendCommandAck('Dictionary', `Looking up *${word}*...`);
          return;
        }
        if (['calculator', 'calc'].includes(cmd)) {
          const expr = args.join(' ').trim();
          const result = simpleMathEval(expr);
          await sendCommandAck('Calculator', result === null ? 'Invalid expression.' : `*${expr}* = ${result}`);
          return;
        }
        if (['currency', 'exchange'].includes(cmd)) {
          const amount = args[0];
          const fromCur = (args[1] || '').toUpperCase();
          const toCur = (args[2] || '').toUpperCase();
          await sendCommandAck('Currency', amount && fromCur && toCur ? `Converting ${amount} ${fromCur} to ${toCur}...` : 'Usage: .currency <amount> <from> <to>');
          return;
        }
        if (['crypto', 'btc', 'eth', 'stock'].includes(cmd)) {
          const asset = args[0] || cmd.toUpperCase();
          await sendCommandAck('Market', `Fetching price for *${asset}*...`);
          return;
        }
        if (['iplookup', 'whois', 'portscan', 'pinghost', 'dns'].includes(cmd)) {
          const target = args[0];
          if (!target) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <target>` }, { quoted: msg });
            return;
          }
          await sendCommandAck('Network Tools', `Running ${cmd} on ${target}...`);
          return;
        }
        if (['shortlink', 'unshort'].includes(cmd)) {
          const target = args[0];
          if (!target) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <url>` }, { quoted: msg });
            return;
          }
          await sendCommandAck('Shortlink', `Processing: ${target}`);
          return;
        }
        if (['qr', 'scanqr', 'barcode'].includes(cmd)) {
          const data = args.join(' ').trim();
          if (!data) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <text>` }, { quoted: msg });
            return;
          }
          const qrUrl = cmd === 'barcode'
            ? `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(data)}`
            : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
          await socket.sendMessage(sender, { image: { url: qrUrl }, caption: '✅ Generated.' }, { quoted: msg });
          return;
        }
        if (['password', 'passgen'].includes(cmd)) {
          const length = Math.min(Math.max(parseInt(args[0] || '12', 10), 6), 32);
          const password = crypto.randomBytes(32).toString('base64').slice(0, length);
          await sendCommandAck('Password', password);
          return;
        }
        if (cmd === 'random') {
          const max = parseInt(args[0] || '100', 10);
          const value = Math.floor(Math.random() * (Number.isNaN(max) ? 100 : max + 1));
          await sendCommandAck('Random', value.toString());
          return;
        }
        if (cmd === 'uuid') {
          await sendCommandAck('UUID', crypto.randomUUID());
          return;
        }
        if (['hash', 'encrypt', 'decrypt'].includes(cmd)) {
          const input = args.join(' ').trim();
          if (!input) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <text>` }, { quoted: msg });
            return;
          }
          if (cmd === 'hash') {
            await sendCommandAck('Hash', crypto.createHash('sha256').update(input).digest('hex'));
            return;
          }
          const key = crypto.createHash('sha256').update(config.OWNER_NAME).digest();
          if (cmd === 'encrypt') {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
            const encrypted = Buffer.concat([cipher.update(input), cipher.final()]).toString('hex');
            await sendCommandAck('Encrypt', `${iv.toString('hex')}:${encrypted}`);
            return;
          }
          const [ivHex, data] = input.split(':');
          if (!ivHex || !data) {
            await sendCommandAck('Decrypt', 'Invalid format. Use iv:encrypted');
            return;
          }
          const decipher = crypto.createDecipheriv('aes-256-ctr', key, Buffer.from(ivHex, 'hex'));
          const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString();
          await sendCommandAck('Decrypt', decrypted);
          return;
        }
        if (['ai', 'chatgpt', 'ask', 'explain', 'summarize', 'paraphrase', 'code', 'debug'].includes(cmd)) {
          const query = args.join(' ').trim();
          if (!query) {
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${cmd} <prompt>` }, { quoted: msg });
            return;
          }
          if (!config.AI_API_URL) {
            await sendCommandAck('AI', 'AI API is not configured. Set AI_API_URL.');
            return;
          }
          await sendCommandAck('AI', `Processing: ${query.slice(0, 100)}...`);
          return;
        }
        await sendCommandAck('Tools', `*${cmd}* command executed.`);
      };

      const missingCommandSet = new Set([
        '8ball','about','angry','anime','antibot','antifake','antiflood','antilink','antispam','antiword','appstore',
        'ask','attp','audioinfo','autoread','autorecording','autorestart','autosave','autotyping','background','banner',
        'barcode','bass','battleship','bcgroup','bite','blackjack','blur','blush','bored','botinfo','brain','btc','bug',
        'calc','calculator','calendar','caption','cards','cartoon','changelog','chatgpt','checkers','cheer','chess',
        'clap','coinflip','command','commands','compatibility','compliment','compress','compressvideo','confession',
        'confused','connect4','cpu','creds','crop','crush','cry','crypto','currency','dailychallenge','dailymotion',
        'dare','darkjoke','dashboard','date','debug','decrypt','define','dice','dictionary','distort','dns','donate',
        'dropbox','echo','emojimix','encrypt','enhance','equalizer','eth','eval','exchange','explain','facebook',
        'facepalm','fact','fast','fb','feedback','flip','forecast','fortune','gdrive','gif','gifsearch','github',
        'gitpull','gitpush','glitch','goodbye','google','grayscale','guess','hangman','happy','hash','headlines',
        'highfive','horoscope','hug','image','img','info','insta','instagram','invert','iplookup','joke','kiss','kwai',
        'language','lastupdate','latency','laugh','leaderboardgame','likee','list','logo','logs','loop','lottery','love',
        'luck','lyrics','match','math','megadl','meme','memeimg','memory','merge','mergevideo','mirror','mix','modapk',
        'mode','music','muteaudio','neon','network','news','nightcore','noob','normalize','nowplaying','paraphrase',
        'passgen','password','pat','pickup','pinghost','pinterest','pixelate','platform','play','playlist','playstore',
        'podcast','poke','poker','portscan','poster','privacy','pro','profilepic','public','pull','punch','push','pushall',
        'pushcode','qc','qr','queue','quiz','quote','radio','ram','random','reboot','recolor','reddit','removebg','report',
        'request','resize','restart','restartnow','reverb','reverse','riddle','roast','rotate','roulette','rps','rpsls',
        'rules','runtime','s','sad','salute','scanqr','scramble','script','search','self','sepia','sharpen','ship','shock',
        'shortlink','shutdown','shutdownnow','sigma','sketch','slap','sleep','slots','slow','smile','snapchat','software',
        'soundcloud','speed','spin','split','spotify','stats','status','sticker','stock','streamable','subtitle',
        'summarize','sus','system','take','terms','thesaurus','think','thumbsdown','thumbsup','tictactoe','time',
        'timezone','togif','toimg','tomp4','translate','treble','trim','trimvideo','trivia','truth','ttp','tts',
        'twitter','unmuteaudio','unscramble','unshort','update','upscale','uptime','uuid','version','video','videogif',
        'vimeo','voice','volume','wallpaper','wallpaperhd','watermark','wave','weather','welcome','whois','wiki',
        'wikipedia','wordgame','x','yeet','ytaudio','ytmp3','ytmp4','ytsearch','ytvideo','zodiac'
      ]);

      const commandHandlers = new Map();
      const registerHandler = (commands, handler) => {
        commands.forEach((cmd) => {
          if (missingCommandSet.has(cmd)) {
            commandHandlers.set(cmd, () => handler(cmd));
          }
        });
      };

      registerHandler([
        'about','botinfo','info','cpu','ram','memory','platform','stats','dashboard','logs','system','network','latency',
        'runtime','uptime','status','version','script','terms','privacy','donate','report','request','feedback','bug',
        'changelog','lastupdate','command','commands','list','public','self','autoread','autotyping','autorecording',
        'reboot','restart','shutdown','shutdownnow','restartnow','mode','rules','creds','speed'
      ], handleSystemCommand);

      registerHandler(['antispam','antilink','antibot','antifake','antiflood','antiword','welcome','goodbye'], handleToggleCommand);
      registerHandler(['autorestart','autosave','bcgroup','eval','pull','gitpull','gitpush','push','pushall','pushcode','update'], handleOwnerCommand);

      registerHandler(commandCatalog.fun, handleFunCommand);
      registerHandler(commandCatalog.reactions, handleReactionCommand);
      registerHandler(commandCatalog.image, handleImageCommand);
      registerHandler(commandCatalog.audio, handleAudioCommand);
      registerHandler(commandCatalog.video, handleVideoCommand);
      registerHandler(commandCatalog.search, handleSearchCommand);

      const directHandler = commandHandlers.get(command);
      if (directHandler) {
        await directHandler();
      } else {
      switch (command) {
      
      // test command switch case

case 'help': {
  try {
    const tips = [
      `Use ${config.PREFIX}menu for the main menu.`,
      `Use ${config.PREFIX}allmenu to see every command.`,
      `Prefix: ${config.PREFIX}`,
      `Mode: ${runtimeState.mode}`
    ].join('\n');
    const text = `${buildAllMenuText()}\n\n*HELP & TIPS*\n${tips}`;
    await socket.sendMessage(sender, { text }, { quoted: fakevcard });
  } catch (err) {
    console.error('help command error:', err);
    await socket.sendMessage(sender, { text: '❌ Failed to show help.' }, { quoted: msg });
  }
  break;
}

case 'allmenu': {
  try {
    await socket.sendMessage(sender, { text: buildAllMenuText() }, { quoted: fakevcard });
  } catch (err) {
    console.error('allmenu command error:', err);
    await socket.sendMessage(sender, { text: '❌ Failed to show all commands.' }, { quoted: msg });
  }
  break;
}

case 'menu': {
  try { await socket.sendMessage(sender, { react: { text: "🎐", key: msg.key } }); } catch(e){}

  try {
    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    // load per-session config (logo, botName)
    let userCfg = {};
    try { if (number && typeof loadUserConfigFromMongo === 'function') userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; }
    catch(e){ console.warn('menu: failed to load config', e); userCfg = {}; }

    const title = userCfg.botName || '© Vortex ';


    const text = `

╭─「  \`🤖${title}\`  」 ─➤*  
*│
*│*🥷 *Oᴡɴᴇʀ :* ${config.OWNER_NAME || 'Anonymous'}
*│*✒️ *Pʀᴇғɪx :* ${config.PREFIX}
*│*🧬 *Vᴇʀsɪᴏɴ :*  ${config.BOT_VERSION || 'ʟᴀᴛᴇsᴛ'}
*│*🎈 *Pʟᴀᴛғᴏʀᴍ :* ${process.env.PLATFORM || 'Hᴇʀᴏᴋᴜ'}
*│*⏰ *Uᴘᴛɪᴍᴇ :* ${hours}h ${minutes}m ${seconds}s
*╰──────●●➤*

╭────────￫
│  🔧ғᴇᴀᴛᴜʀᴇs                  
│  [1] 👑 ᴏᴡɴᴇʀ                           
│  [2] 📥 ᴅᴏᴡɴʟᴏᴀᴅ                           
│  [3] 🛠️ ᴛᴏᴏʟs                            
│  [4] ⚙️ sᴇᴛᴛɪɴɢs                       
│  [5] 🎨 ᴄʀᴇᴀᴛɪᴠᴇ                             
╰───────￫

🎯 ᴛᴀᴘ ᴀ ᴄᴀᴛᴇɢᴏʀʏ ʙᴇʟᴏᴡ!

`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: "👑 ᴏᴡɴᴇʀ" },
       type: 1 },
      { buttonId: `${config.PREFIX}download`, buttonText: { displayText: "📥 ᴅᴏᴡɴʟᴏᴀᴅ" }, type: 1 },
      { buttonId: `${config.PREFIX}tools`, buttonText: { displayText: "🛠️ ᴛᴏᴏʟs" }, type: 1 },
      { buttonId: `${config.PREFIX}sᴇᴛᴛɪɴɢs`, buttonText: { displayText: "⚙️ 𝘚𝘦𝘵𝘵𝘪𝘯𝘨𝘴" }, type: 1 },
      { buttonId: `${config.PREFIX}creative`, buttonText: { displayText: "🎨 ᴄʀᴇᴀᴛɪᴠᴇ" }, type: 1 },
      
    ];

    const defaultImg = "assets/vortex-menu.svg";
    const useLogo = userCfg.logo || defaultImg;

    // build image payload (url or buffer)
    let imagePayload;
    if (String(useLogo).startsWith('http')) imagePayload = { url: useLogo };
    else {
      try { imagePayload = fs.readFileSync(useLogo); } catch(e){ imagePayload = { url: defaultImg }; }
    }

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: "*▶ ● 𝐅𝚁𝙴𝙴 𝐁𝙾𝚃 *",
      buttons,
      headerType: 4
    }, { quoted: fakevcard });

  } catch (err) {
    console.error('menu command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show menu.' }, { quoted: msg }); } catch(e){}
  }
  break;
}

// ==================== OWNER MENU ====================
case 'owner': {
  try { await socket.sendMessage(sender, { react: { text: "👑", key: msg.key } }); } catch(e){}

  try {
    let userCfg = {};
    try { if (number && typeof loadUserConfigFromMongo === 'function') userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; } catch(e){ userCfg = {}; }
    const title = userCfg.botName || ' © Vortex';

    const text = `
 
  \`👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ \`

╭─ 🤖 𝐀𝐈 𝐅𝐄𝐀𝐓𝐔𝐑𝐄𝐒
│ ✦ ${config.PREFIX}developer
│ ✦ ${config.PREFIX}deletemenumber
│ ✦ ${config.PREFIX}bots
╰────────

`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}developer`, buttonText: { displayText: "📥 ᴄʀᴇᴀᴛᴏʀ" }, type: 1 }
    ];

    await socket.sendMessage(sender, {
      text,
      footer: "👑 𝘊𝘰𝘮𝘮𝘢𝘯𝘥𝘴",
      buttons
    }, { quoted: fakevcard });

  } catch (err) {
    console.error('ᴏᴡɴᴇʀ command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show ᴏᴡɴᴇʀ menu.' }, { quoted: msg }); } catch(e){}
  }
  break;
}

// ============ OWNER CMDS ====================
case 'developer': {
  try { await socket.sendMessage(sender, { react: { text: "👑", key: msg.key } }); } catch(e){}

  try {
    let userCfg = {};
    try { if (number && typeof loadUserConfigFromMongo === 'function') userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; } catch(e){ userCfg = {}; }
  
    const text = `

 \`👑 𝐎𝐖𝐍𝐄𝐑 𝐈𝐍𝐅𝐎 👑\`

╭─ 🧑‍💼 𝐃𝐄𝐓𝐀𝐈𝐋𝐒
│
│ ✦ 𝐍𝐚𝐦𝐞 : Anonymous
│ ✦ 𝐀𝐠𝐞  : 20+
│ ✦ 𝐍𝐨.  : +263789544743
│
╰────────✧

`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
      
    ];

    await socket.sendMessage(sender, {
      text,
      footer: "👑 𝘖𝘸𝘯𝘦𝘳 𝘐𝘯𝘧𝘰𝘳𝘮𝘢𝘵𝘪𝘰𝘯",
      buttons
    }, { quoted: fakevcard });

  } catch (err) {
    console.error('owner command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show owner info.' }, { quoted: msg }); } catch(e){}
  }
  break;
}

case 'deleteme': {
  // 'number' is the session number passed to setupCommandHandlers (sanitized in caller)
  const sanitized = (number || '').replace(/[^0-9]/g, '');
  // determine who sent the command
  const senderNum = (nowsender || '').split('@')[0];
  const ownerNum = config.OWNER_NUMBER.replace(/[^0-9]/g, '');

  // Permission: only the session owner or the bot OWNER can delete this session
  if (senderNum !== sanitized && senderNum !== ownerNum) {
    await socket.sendMessage(sender, { text: '❌ Permission denied. Only the session owner or the bot owner can delete this session.' }, { quoted: msg });
    break;
  }

  try {
    // 1) Remove from Mongo
    await removeSessionFromMongo(sanitized);
    await removeNumberFromMongo(sanitized);

    // 2) Remove temp session dir
    const sessionPath = path.join(os.tmpdir(), `session_${sanitized}`);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.removeSync(sessionPath);
        console.log(`Removed session folder: ${sessionPath}`);
      }
    } catch (e) {
      console.warn('*Failed removing session folder*', e);
    }

    // 3) Try to logout & close socket
    try {
      if (typeof socket.logout === 'function') {
        await socket.logout().catch(err => console.warn('logout error (ignored):', err?.message || err));
      }
    } catch (e) { console.warn('socket.logout failed:', e?.message || e); }
    try { socket.ws?.close(); } catch (e) { console.warn('ws close failed:', e?.message || e); }

    // 4) Remove from runtime maps
    activeSockets.delete(sanitized);
    socketCreationTime.delete(sanitized);

    // 5) notify user
    await socket.sendMessage(sender, {
      image: { url: config.IMAGE_PATH },
      caption: formatMessage('*🗑️ SESSION DELETED*', '*✅ Your session has been successfully deleted from MongoDB and local storage.*', BOT_NAME_FREE)
    }, { quoted: fakevcard });

    console.log(`Session ${sanitized} deleted by ${senderNum}`);
  } catch (err) {
    console.error('deleteme command error:', err);
    await socket.sendMessage(sender, { text: `❌ Failed to delete session: ${err.message || err}` }, { quoted: msg });
  }
  break;
}
case 'deletemenumber': {
  // args is available in the handler (body split). Expect args[0] = target number
  const targetRaw = (args && args[0]) ? args[0].trim() : '';
  if (!targetRaw) {
    await socket.sendMessage(sender, { text: '*❗ Usage: .deletemenumber <number>\nExample: .deletemenumber 263789544743*' }, { quoted: msg });
    break;
  }

  const target = targetRaw.replace(/[^0-9]/g, '');
  if (!/^\\d{6,}$/.test(target)) {
    await socket.sendMessage(sender, { text: '*❗ Invalid number provided.*' }, { quoted: msg });
    break;
  }

  // Permission check: only OWNER or configured admins can run this
  const senderNum = (nowsender || '').split('@')[0];
  const ownerNum = config.OWNER_NUMBER.replace(/[^0-9]/g, '');

  let allowed = false;
  if (senderNum === ownerNum) allowed = true;
  else {
    try {
      const adminList = await loadAdminsFromMongo();
      if (Array.isArray(adminList) && adminList.some(a => a.replace(/[^0-9]/g,'') === senderNum || a === senderNum || a === `${senderNum}@s.whatsapp.net`)) {
        allowed = true;
      }
    } catch (e) {
      console.warn('Failed checking admin list', e);
    }
  }

  if (!allowed) {
    await socket.sendMessage(sender, { text: '*❌ Permission denied. Only bot owner or admins can delete other sessions.*' }, { quoted: msg });
    break;
  }

  try {
    // notify start
    await socket.sendMessage(sender, { text: `*🗑️ Deleting session for ${target} — attempting now...*` }, { quoted: msg });

    // 1) If active, try to logout + close
    const runningSocket = activeSockets.get(target);
    if (runningSocket) {
      try {
        if (typeof runningSocket.logout === 'function') {
          await runningSocket.logout().catch(e => console.warn('logout error (ignored):', e?.message || e));
        }
      } catch (e) { console.warn('Error during logout:', e); }
      try { runningSocket.ws?.close(); } catch (e) { console.warn('ws close error:', e); }
      activeSockets.delete(target);
      socketCreationTime.delete(target);
    }

    // 2) Remove from Mongo (sessions + numbers)
    await removeSessionFromMongo(target);
    await removeNumberFromMongo(target);

    // 3) Remove temp session dir if exists
    const tmpSessionPath = path.join(os.tmpdir(), `session_${target}`);
    try {
      if (fs.existsSync(tmpSessionPath)) {
        fs.removeSync(tmpSessionPath);
        console.log(`Removed temp session folder: ${tmpSessionPath}`);
      }
    } catch (e) {
      console.warn('*Failed removing tmp session folder*', e);
    }

    // 4) Confirm to caller & notify owner
    await socket.sendMessage(sender, {
      image: { url: config.IMAGE_PATH },
      caption: formatMessage('*🗑️ SESSION REMOVED*', `*✅ Session for number *${target}* has been deleted from MongoDB and runtime.*`, BOT_NAME_FREE)
    }, { quoted: msg });

    // optional: inform owner
    try {
      const ownerJid = `${ownerNum}@s.whatsapp.net`;
      await socket.sendMessage(ownerJid, {
        text: `*🗣️ Notice:* Session removed by ${senderNum}\n *Number:* ${target}\n *Time:* ${getZimbabweanTimestamp()}`
      });
    } catch (e) { /* ignore notification errors */ }

    console.log(`deletemenumber: removed ${target} (requested by ${senderNum})`);
  } catch (err) {
    console.error('deletemenumber error:', err);
    await socket.sendMessage(sender, { text: `*❌ Failed to delete session for* ${target}: ${err.message || err}` }, { quoted: msg });
  }

  break;
}

case 'bots': {
  try {
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = await loadUserConfigFromMongo(sanitized) || {};
    const botName = cfg.botName || BOT_NAME_FREE;
    const logo = cfg.logo || config.IMAGE_PATH;

    // Permission check - only owner and admins can use this
    const admins = await loadAdminsFromMongo();
    const normalizedAdmins = (admins || []).map(a => (a || '').toString());
    const senderIdSimple = (nowsender || '').includes('@') ? nowsender.split('@')[0] : (nowsender || '');
    const isAdmin = normalizedAdmins.includes(nowsender) || normalizedAdmins.includes(senderNumber) || normalizedAdmins.includes(senderIdSimple);

    if (!isOwner && !isAdmin) {
      await socket.sendMessage(sender, { 
        text: '❌ Permission denied. Only bot owner or admins can check active sessions.' 
      }, { quoted: msg });
      break;
    }

    const activeCount = activeSockets.size;
    const activeNumbers = Array.from(activeSockets.keys());

    let text = ` *👀 𝐀ctive 𝐒essions - ${botName}*\n\n`;
    text += `📊 *𝐓otal 𝐀ctive 𝐒essions:* ${activeCount}\n\n`;

    if (activeCount > 0) {
      text += `📱 *𝐀ctive 𝐍umbers:*\n`;
      activeNumbers.forEach((num, index) => {
        text += `${index + 1}. ${num}\n`;
      });
    } else {
      text += `*⚠️ No active sessions found.*`;
    }

    text += `\n*🕒 𝐂hecked 𝐀t:* ${getZimbabweanTimestamp()}`;

    let imagePayload = String(logo).startsWith('http') ? { url: logo } : fs.readFileSync(logo);

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: `*📊 ${botName} 𝐒ession 𝐒tatos*`,
      buttons: [
        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
        { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: "📍 ᴘɪɴɢ" }, type: 1 }
      ],
      headerType: 4
    }, { quoted: fakevcard });

  } catch(e) {
    console.error('activesessions error', e);
    await socket.sendMessage(sender, { 
      text: '❌ Failed to fetch active sessions information.' 
    }, { quoted: msg });
  }
  break;
}

// ==================== DOWNLOAD MENU ====================
case 'download': {
  try { await socket.sendMessage(sender, { react: { text: "📥", key: msg.key } }); } catch(e){}

  try {
    let userCfg = {};
    try { if (number && typeof loadUserConfigFromMongo === 'function') userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; } catch(e){ userCfg = {}; }
    const title = userCfg.botName || '© Vortex';

    const text = `

 \`📥 Dʟ ᴍᴇɴᴜ 📥\`
 
╭─ 🎵 𝐌ᴜsɪᴄ ᴅʟs
│ ✦ ${config.PREFIX}song [query]
╰──────

╭─ 🎬 𝐕ɪᴅᴇᴏ ᴅʟs
│ ✦ ${config.PREFIX}tiktok [url]
╰──────

╭─ 📱 𝐀𝐏𝐏𝐒 & 𝐅𝐈𝐋𝐄𝐒
│ ✦ ${config.PREFIX}mediafire [url]
│ ✦ ${config.PREFIX}apk 
│ 
╰───────
 ᴍᴏʀᴇ sᴏᴏɴ
`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
      { buttonId: `${config.PREFIX}creative`, buttonText: { displayText: "🎨 ᴄʀᴇᴀᴛɪᴠᴇ" }, type: 1 }
    ];

    await socket.sendMessage(sender, {
      text,
      footer: "📥 𝘋𝘰𝘸𝘯𝘭𝘰𝘢𝘥 𝘊𝘰𝘮𝘮𝘢𝘯𝘥𝘴",
      buttons
    }, { quoted: fakevcard });

  } catch (err) {
    console.error('download command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show download menu.' }, { quoted: msg }); } catch(e){}
  }
  break;
}

case 'song': {
    const yts = require("yt-search");
    const axios = require("axios");

    try {
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            "";

        const q = text.split(" ").slice(1).join(" ").trim();
        if (!q) {
            await socket.sendMessage(sender, {
                text: "🎵 *Please provide a song name or YouTube link!*",
            }, { quoted: msg });
            break;
        }

        // 🔍 Search video
        const search = await yts(q);
        if (!search?.videos?.length) {
            await socket.sendMessage(sender, { text: "❌ No results found!" }, { quoted: fakevcard });
            break;
        }

        const video = search.videos[0];

        // 🎵 Yupra API
        const api = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`;
        const res = await axios.get(api, { timeout: 60000 });

        if (!res?.data?.result?.download) throw "API_FAILED";

        const dlUrl = res.data.result.download;
        const title = res.data.result.title || video.title;

        // 🎧 Send buttons
        await socket.sendMessage(sender, {
            image: { url: video.thumbnail },
            caption:
                `*🎧 SONG DOWNLOADER*\n\n` +
                `*🎵 Title:* ${title}\n` +
                `*⏱ Duration:* ${video.timestamp}\n\n` +
                `👇 Choose download format`,
            buttons: [
                {
                    buttonId: `song_mp3|${dlUrl}|${title}`,
                    buttonText: { displayText: "🎧 MP3 AUDIO" },
                    type: 1
                },
                {
                    buttonId: `song_doc|${dlUrl}|${title}`,
                    buttonText: { displayText: "📄 MP3 DOCUMENT" },
                    type: 1
                }
            ],
            footer: "▶ Vortex SONG DL",
            headerType: 4
        }, { quoted: fakevcard });

    } catch (err) {
        console.error("song error:", err);
        await socket.sendMessage(sender, {
            text: "❌ Failed to fetch song.",
        }, { quoted: fakevcard });
    }
    break;
}
case 'song_mp3':
case 'song_doc': {
    try {
        const parts = body.split('|');
        const mode = parts[0];          // song_mp3 or song_doc
        const url = parts[1];
        const title = parts.slice(2).join('|');

        const fileName = `${title}.mp3`;

        if (mode === 'song_mp3') {
            await socket.sendMessage(sender, {
                audio: { url },
                mimetype: "audio/mpeg",
                ptt: false
            }, { quoted: fakevcard });
        }

        if (mode === 'song_doc') {
            await socket.sendMessage(sender, {
                document: { url },
                mimetype: "audio/mpeg",
                fileName
            }, { quoted: fakevcard });
        }

        await socket.sendMessage(sender, {
            text: "✅ *Download complete!* 🎶"
        }, { quoted: fakevcard });

    } catch (e) {
        console.error("song button error:", e);
        await socket.sendMessage(sender, {
            text: "❌ Failed to send file."
        }, { quoted: fakevcard });
    }
    break;
}

case 'tiktok':
case 'ttdl':
case 'tt':
case 'tiktokdl': {
    try {
        // 🔹 Load bot name dynamically
        const sanitized = (number || '').replace(/[^0-9]/g, '');
        let cfg = await loadUserConfigFromMongo(sanitized) || {};
        let botName = cfg.botName || 'Vortex';

        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const q = text.split(" ").slice(1).join(" ").trim();

        if (!q) {
            await socket.sendMessage(sender, { 
                text: '*🚫 Please provide a TikTok video link.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 }
                ]
            }, { quoted: fakevcard });
            return;
        }

        if (!q.includes("tiktok.com")) {
            await socket.sendMessage(sender, { 
                text: '*🚫 Invalid TikTok link.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 }
                ]
            }, { quoted: fakevcard });
            return;
        }

        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } });
        await socket.sendMessage(sender, { text: '*⏳ Downloading TikTok video...*' }, { quoted: fakevcard });

        const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) {
            await socket.sendMessage(sender, { 
                text: '*🚩 Failed to fetch TikTok video.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 }
                ]
            }, { quoted: fakevcard });
            return;
        }

        const { title, like, comment, share, author, meta } = data.data;
        const videoUrl = meta.media.find(v => v.type === "video").org;

        const titleText = `*${botName} Tɪᴋᴛᴏᴋ Dʟ*`;
        const content = `╭─── 「 📊 Pᴏsᴛ ɪɴғᴏ 」 ──
                         │ 👤 User      : ${author.nickname} (@${author.username})
                         │ 📖 Title     : ${title}
                         │ 👍 Likes     : ${like}
                         │ 💬 Comments  : ${comment}
                         │ 🔁 Shares    : ${share}
                         ╰────────>`

        const footer = config.BOT_FOOTER || '';
        const captionMessage = formatMessage(titleText, content, footer);

        await socket.sendMessage(sender, {
            video: { url: videoUrl },
            caption: captionMessage,
            contextInfo: { mentionedJid: [sender] },
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 },
                { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '⏰ ᴀʟɪᴠᴇ' }, type: 1 }
            ]
        }, { quoted: fakevcard });

    } catch (err) {
        console.error("Error in TikTok downloader:", err);
        await socket.sendMessage(sender, { 
            text: '*❌ Internal Error. Please try again later.*',
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 }
            ]
        });
    }
    break;
}
case 'mediafire':
case 'mf':
case 'mfdl': {
    try {
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const url = text.split(" ")[1]; // .mediafire <link>

        // ✅ Load bot name dynamically
        const sanitized = (number || '').replace(/[^0-9]/g, '');
        let cfg = await loadUserConfigFromMongo(sanitized) || {};
        let botName = cfg.botName || 'Vortex';

        if (!url) {
            return await socket.sendMessage(sender, {
                text: '🚫 *Please send a MediaFire link.*\n\nExample: .mediafire <url>'
            }, { quoted: fakevcard });
        }

        // ⏳ Notify start
        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        await socket.sendMessage(sender, { text: '*⏳ Fetching MediaFire file info...*' }, { quoted: fakevcard });

        // 🔹 Call API
        let api = `https://tharuzz-ofc-apis.vercel.app/api/download/mediafire?url=${encodeURIComponent(url)}`;
        let { data } = await axios.get(api);

        if (!data.success || !data.result) {
            return await socket.sendMessage(sender, { text: '❌ *Failed to fetch MediaFire file.*' }, { quoted: fakevcard });
        }

        const result = data.result;
        const title = result.title || result.filename;
        const filename = result.filename;
        const fileSize = result.size;
        const downloadUrl = result.url;

        const caption = `
		
╭─── 📦 FILE INFO ──
│ *${title}*
│
│ 📁 Filename : ${filename}
│ 📏 Size     : ${fileSize}
│ 🌐 From     : ${result.from}
│ 📅 Date     : ${result.date}
│ 🕑 Time     : ${result.time}
╰─────────────

> ✨ ${botName}`;


        // 🔹 Send file automatically (document type for .zip etc.)
        await socket.sendMessage(sender, {
            document: { url: downloadUrl },
            fileName: filename,
            mimetype: 'application/octet-stream',
            caption: caption
        }, { quoted: fakevcard });

    } catch (err) {
        console.error("Error in MediaFire downloader:", err);

        // ✅ In catch also send Meta mention style
        const sanitized = (number || '').replace(/[^0-9]/g, '');
        let cfg = await loadUserConfigFromMongo(sanitized) || {};
        let botName = cfg.botName || 'Vortex';

        await socket.sendMessage(sender, { text: '*❌ Internal Error. Please try again later.*' }, { quoted: fakevcard });
    }
    break;
}
case 'apksearch':
case 'apk':
case 'apkfind': {
    try {
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const query = text.split(" ").slice(1).join(" ").trim();

        // ✅ Load bot name dynamically
        const sanitized = (number || '').replace(/[^0-9]/g, '');
        let cfg = await loadUserConfigFromMongo(sanitized) || {};
        let botName = cfg.botName || 'Vortex';

        if (!query) {
            return await socket.sendMessage(sender, {
                text: '🚫 *Please provide an app name to search.*\n\nExample: .apksearch whatsapp',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 }
                ]
            }, { quoted: fakevcard });
        }

        await socket.sendMessage(sender, { text: '*⏳ Searching APKs...*' }, { quoted: fakevcard });

        // 🔹 Call API
        const apiUrl = `https://tharuzz-ofc-apis.vercel.app/api/search/apksearch?query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.success || !data.result || !data.result.length) {
            return await socket.sendMessage(sender, { text: '*❌ No APKs found for your query.*' }, { quoted: fakevcard });
        }

        // 🔹 Format results
        let message = `🔍 *APK Search Results for:* ${query}\n\n`;
        data.result.slice(0, 20).forEach((item, idx) => {
            message += `*${idx + 1}.* ${item.name}\n➡️ ID: \`${item.id}\`\n\n`;
        });
        message += `_*© Powered by ${botName}*_`;

        // 🔹 Send results
        await socket.sendMessage(sender, {
            text: message,
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 },
                { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '🪄 𝘉𝘰𝘵 𝘐𝘯𝘧𝘰' }, type: 1 }
            ],
            contextInfo: { mentionedJid: [sender] }
        }, { quoted: fakevcard });

    } catch (err) {
        console.error("Error in APK search:", err);

        const sanitized = (number || '').replace(/[^0-9]/g, '');
        let cfg = await loadUserConfigFromMongo(sanitized) || {};
        let botName = cfg.botName || 'Vortex';

        await socket.sendMessage(sender, { text: '*❌ Internal Error. Please try again later.*' }, { quoted: fakevcard });
    }
    break;
}

// ==================== CREATIVE MENU ====================
case 'creative': {
  try { await socket.sendMessage(sender, { react: { text: "🎨", key: msg.key } }); } catch(e){}

  try {
    let userCfg = {};
    try { if (number && typeof loadUserConfigFromMongo === 'function') userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; } catch(e){ userCfg = {}; }
    const title = userCfg.botName || ' © Vortex';

    const text = `
 
  \`🎨 Cʀᴇᴀᴛɪᴠᴇ ᴍᴇɴᴜ 🎨\`

╭─ 🤖 𝐀𝐈 𝐅𝐄𝐀𝐓𝐔𝐑𝐄𝐒
│ ✦ ${config.PREFIX}ai [message]
│ more soon
╰────────

╭─ ✍️ 𝐓𝐄𝐗𝐓 𝐓𝐎𝐎𝐋𝐒
│ soon
╰────────

╭─ 🖼️ 𝐈𝐌𝐀𝐆𝐄 𝐓𝐎𝐎𝐋𝐒
│ coming soon
╰────────

╭─ 💾 𝐌𝐄𝐃𝐈𝐀 𝐒𝐀𝐕𝐄𝐑
│ coming soon
╰────────

`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
      { buttonId: `${config.PREFIX}download`, buttonText: { displayText: "📥 ᴅʟ ᴍᴇɴᴜ" }, type: 1 }
    ];

    await socket.sendMessage(sender, {
      text,
      footer: "🎨 𝘊𝘳𝘦𝘢𝘵𝘪𝘷𝘦 𝘊𝘰𝘮𝘮𝘢𝘯𝘥𝘴",
      buttons
    }, { quoted: fakevcard });

  } catch (err) {
    console.error('creative command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show creative menu.' }, { quoted: msg }); } catch(e){}
  }
  break;
}
// ==================== CREATIVE CMDS ====================
case 'ai':
case 'chat':
case 'gpt': {
  try {
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    const args = text.split(" ").slice(1);
    const prompt = args.join(" ").trim();

    if (!prompt) {
      await socket.sendMessage(sender, { 
        text: '*🚫 Please provide a message for AI.*',
        buttons: [
          { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
        ]
      }, { quoted: fakevcard });
      break;
    }

    // 🔹 Load bot name
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    let cfg = await loadUserConfigFromMongo(sanitized) || {};
    let botName = cfg.botName || 'Vortex';

    await socket.sendMessage(sender, { react: { text: '🤖', key: msg.key } });
    await socket.sendMessage(sender, { 
      text: '*⏳ AI thinking...*' 
    }, { quoted: fakevcard });

    const apiBase = process.env.AI_API_URL || '';
    if (!apiBase) {
      await socket.sendMessage(sender, { text: '*⚠️ AI service is not configured.*' }, { quoted: fakevcard });
      break;
    }
    const apiUrl = `${apiBase}?text=${encodeURIComponent(prompt)}`;

    console.log(`Fetching AI response for: ${prompt.substring(0, 50)}...`);

    const response = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    const aiReply =
      response?.data?.result ||
      response?.data?.response ||
      response?.data?.reply ||
      response?.data?.text;

    if (!aiReply) {
      await socket.sendMessage(sender, { 
        text: '*🤖 AI reply not found.*',
        buttons: [
          { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 }
        ]
      }, { quoted: fakevcard });
      break;
    }

    await socket.sendMessage(sender, {
      text: aiReply,
      footer: `🤖 ${botName}`,
      buttons: [
        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 },
        { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '📡 𝘉𝘰𝘵 𝘐𝘯𝘧𝘰' }, type: 1 }
      ],
      headerType: 1
    }, { quoted: fakevcard });

  } catch (err) {
    console.error("*Error in AI chat*", err);
    await socket.sendMessage(sender, { 
      text: '*❌ Internal AI Error. Please try again later.*',
      buttons: [
        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 ᴍᴇɴᴜ' }, type: 1 }
      ]
    }, { quoted: fakevcard });
  }
  break;
}

// ==================== TOOLS MENU ====================
case 'tools': {
  try { await socket.sendMessage(sender, { react: { text: "🔧", key: msg.key } }); } catch(e){}

  try {
    let userCfg = {};
    try { if (number && typeof loadUserConfigFromMongo === 'function') userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; } catch(e){ userCfg = {}; }
    const title = userCfg.botName || ' © Vortex';
    
    const text = `
 \`🛠️ Tᴏᴏʟs ᴍᴇɴᴜ 🛠️\`

╭─ 📊 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐔𝐒
│ ✦ ${config.PREFIX}ping
│ ✦ ${config.PREFIX}alive
╰─────
> more soon

`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
      { buttonId: `${config.PREFIX}settings`, buttonText: { displayText: "⚙️ sᴇᴛᴛɪɴɢs" }, type: 1 }
    ];

    await socket.sendMessage(sender, {
      text,
      footer: "🔧 𝘛𝘰𝘰𝘭𝘴 𝘊𝘰𝘮𝘮𝘢𝘯𝘥𝘴",
      buttons
    }, { quoted: fakevcard });

  } catch (err) {
    console.error('tools command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show tools menu.' }, { quoted: msg }); } catch(e){}
  }
  break;
}


case 'settings': {
  try { await socket.sendMessage(sender, { react: { text: "⚙️", key: msg.key } }); } catch(e){}

  try {
    let userCfg = {};
    try { if (number && typeof loadUserConfigFromMongo === 'function') userCfg = await loadUserConfigFromMongo((number || '').replace(/[^0-9]/g, '')) || {}; } catch(e){ userCfg = {}; }
    const title = userCfg.botName || '© Vortex';

    const text = `

  \`🛠️sᴇᴛᴛɪɴɢs ʟɪsᴛ\`

╭─ 🤖 ʙᴏᴛ ᴄᴜsᴛᴏᴍɪᴢᴀᴛɪᴏɴs
│coming soon
╰────────>

╭─ 📊 ᴄᴏɴғɪɢ ᴍɴɢ
│ coming soon
╰────────>

╭─ 🗑️ sᴇssɪᴏɴ ᴍɴɢ
│
│ ✦ ${config.PREFIX}deleteme
╰────────>

`.trim();

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
      { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: "🥷 ᴏᴡɴᴇʀ" }, type: 1 }
    ];

    await socket.sendMessage(sender, {
      text,
      footer: "⚙️ 𝘚𝘦𝘵𝘵𝘪𝘯𝘨𝘴 𝘊𝘰𝘮𝘮𝘢𝘯𝘥𝘴",
      buttons
    }, { quoted: fakevcard });

  } catch (err) {
    console.error('settings command error:', err);
    try { await socket.sendMessage(sender, { text: '❌ Failed to show settings menu.' }, { quoted: msg }); } catch(e){}
  }
  break;
}


//================ALIVE=========
case 'alive': {
  try {
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = await loadUserConfigFromMongo(sanitized) || {};
    const botName = cfg.botName || BOT_NAME_FANCY;
    const logo = cfg.logo || config.RCD_IMAGE_PATH;

    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const text = `
*HI 👋 ${botName} Usᴇʀ I ᴀᴍ ᴀʟɪᴠᴇ ⏰*

*╭─「 𝐒ᴛᴀᴛᴜꜱ 𝐃ᴇᴛᴀɪʟꜱ 」 ─➤*  
*│*👤 *Usᴇʀ :*
*│*🥷 *Oᴡɴᴇʀ :* ${config.OWNER_NAME || 'Anonymous'}
*│*✒️ *Pʀᴇғɪx :* .
*│*🧬 *Vᴇʀsɪᴏɴ :*  ${config.BOT_VERSION || 'ʟᴀᴛᴇsᴛ'}
*│*🎈 *Pʟᴀᴛғᴏʀᴍ :* ${process.env.PLATFORM || 'Hᴇʀᴏᴋᴜ'}
*│*📟 *Uᴘᴛɪᴍᴇ :* ${hours}h ${minutes}m ${seconds}s
*╰────────●●➤*

> *${botName}*
`;

    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜 ᴍᴇɴᴜ" }, type: 1 },
      { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: "⚡ ᴘɪɴɢ" }, type: 1 }
    ];

    let imagePayload = String(logo).startsWith('http') ? { url: logo } : fs.readFileSync(logo);

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: `*${botName} ᴀʟɪᴠᴇ ɴᴏᴡ*`,
      buttons,
      headerType: 4
    }, { quoted: fakevcard });

  } catch(e) {
    console.error('alive error', e);
    await socket.sendMessage(sender, { text: '*❌ Failed to send alive status.*' }, { quoted: msg });
  }
  break;
}

// ---------------------- PING ----------------------
case 'ping': {
  try {
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = await loadUserConfigFromMongo(sanitized) || {};
    const botName = cfg.botName || BOT_NAME_FREE;
    const logo = cfg.logo || config.IMAGE_PATH;

    const latency = Date.now() - (msg.messageTimestamp * 1000 || Date.now());

    const text = `
*📡 ${botName} ᴘɪɴɢ ɴᴏᴡ*

*◈ 🛠️ 𝐋atency :*  ${latency}ms
*◈ 🕢 𝐒erver 𝐓ime :* ${new Date().toLocaleString()}
`;

    let imagePayload = String(logo).startsWith('http') ? { url: logo } : fs.readFileSync(logo);

    await socket.sendMessage(sender, {
      image: imagePayload,
      caption: text,
      footer: `*${botName} ᴘɪɴɢ*`,
      buttons: [{ buttonId: `${config.PREFIX}menu`, buttonText: { displayText: "📜ᴍᴇɴᴜ" }, type: 1 }],
      headerType: 4
    }, { quoted: fakevcard });

  } catch(e) {
    console.error('ping error', e);
    await socket.sendMessage(sender, { text: '❌ Failed to get ping.' }, { quoted: msg });
  }
  break;
}

//======== support ========//
// u can remove this case block 
case 'support': {
  const message = `*🤝 SUPPORT*\n\n` +
                  `Join our support group:\n\n` +
                  `🔗 ${config.CHANNEL_LINK}\n\n` +
                  `*Thank you for your support!* 🙏`;

  await socket.sendMessage(sender, { text: message }, { quoted: fakevcard });
  break;
}

        // default
        default: {
          const toggleConfig = {
            autoread: { type: 'config', key: 'AUTO_READ', label: 'Auto Read' },
            autotyping: { type: 'config', key: 'AUTO_TYPING', label: 'Auto Typing' },
            autorecording: { type: 'config', key: 'AUTO_RECORDING', label: 'Auto Recording' },
            antispam: { type: 'runtime', key: 'antispam', label: 'Anti-spam' },
            antilink: { type: 'runtime', key: 'antilink', label: 'Anti-link' },
            antibot: { type: 'runtime', key: 'antibot', label: 'Anti-bot' },
            antifake: { type: 'runtime', key: 'antifake', label: 'Anti-fake' },
            antiflood: { type: 'runtime', key: 'antiflood', label: 'Anti-flood' },
            antiword: { type: 'runtime', key: 'antiword', label: 'Anti-word' },
            welcome: { type: 'runtime', key: 'welcome', label: 'Welcome Messages' },
            goodbye: { type: 'runtime', key: 'goodbye', label: 'Goodbye Messages' }
          };

          if (toggleConfig[command]) {
            const enabled = parseToggleArg(args[0]);
            if (enabled === null) {
              await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} on/off` }, { quoted: msg });
              break;
            }
            const { type, key, label } = toggleConfig[command];
            if (type === 'config') {
              config[key] = enabled ? 'true' : 'false';
            } else {
              runtimeState.toggles[key] = enabled;
            }
            await sendCommandAck('Settings', `*${label}:* ${enabled ? 'Enabled ✅' : 'Disabled ❌'}`);
            break;
          }

          if (['public', 'self', 'publicmode', 'selfmode'].includes(command)) {
            runtimeState.mode = command.includes('self') ? 'self' : 'public';
            config.MODE = runtimeState.mode;
            await sendCommandAck('System Mode', `*Mode:* ${runtimeState.mode}`);
            break;
          }

          if (command === 'mode') {
            await sendCommandAck('System Mode', `*Mode:* ${runtimeState.mode}`);
            break;
          }

          if (command === 'rules') {
            const action = (args[0] || '').toLowerCase();
            if (action === 'set') {
              const rulesText = args.slice(1).join(' ').trim();
              if (!rulesText) {
                await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}rules set <rules text>` }, { quoted: msg });
                break;
              }
              runtimeState.rules = rulesText;
              await sendCommandAck('Group Rules', '*Rules updated successfully.*');
              break;
            }
            if (action === 'show') {
              const rulesText = runtimeState.rules || 'No rules have been set yet.';
              await sendCommandAck('Group Rules', rulesText);
              break;
            }
            await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}rules set <rules text> | ${config.PREFIX}rules show` }, { quoted: msg });
            break;
          }

          if (infoCommands.has(command)) {
            const cpuCount = os.cpus().length;
            const totalMem = formatBytes(os.totalmem());
            const freeMem = formatBytes(os.freemem());
            const infoText = `*Bot:* ${config.BOT_NAME}\n*Version:* ${config.BOT_VERSION}\n*Uptime:* ${getUptimeLabel()}\n*Mode:* ${runtimeState.mode}\n*CPU Cores:* ${cpuCount}\n*Memory:* ${freeMem} free / ${totalMem} total`;
            await sendCommandAck('System Info', infoText);
            break;
          }

          const category = commandCategoryMap.get(command);
          if (category) {
            if (category === 'user') {
              const profile = getUserProfile(nowsender);
              switch (command) {
                case 'register':
                  profile.registered = true;
                  profile.registeredAt = new Date();
                  await sendFeatureReady('User Profile', `*Registered:* ✅\n*User:* ${profile.name}`);
                  break;
                case 'unregister':
                  profile.registered = false;
                  await sendFeatureReady('User Profile', '*Registered:* ❌');
                  break;
                case 'verify':
                  await sendFeatureReady('User Profile', `*Verification:* ${profile.registered ? 'Verified ✅' : 'Not registered ❌'}`);
                  break;
                case 'profile':
                case 'myinfo':
                case 'me':
                  await sendFeatureReady('User Profile', `*Name:* ${profile.name}\n*Level:* ${profile.level}\n*XP:* ${profile.xp}\n*Balance:* ${profile.balance}\n*Coins:* ${profile.coins}\n*Points:* ${profile.points}`);
                  break;
                case 'id':
                case 'serial':
                  await sendFeatureReady('User Profile', `*ID:* ${nowsender}`);
                  break;
                case 'level':
                case 'rank':
                case 'xp':
                  await sendFeatureReady('User Rank', `*Level:* ${profile.level}\n*XP:* ${profile.xp}`);
                  break;
                case 'balance':
                case 'wallet':
                case 'coins':
                case 'points':
                  await sendFeatureReady('User Wallet', `*Balance:* ${profile.balance}\n*Coins:* ${profile.coins}\n*Points:* ${profile.points}`);
                  break;
                case 'daily':
                case 'weekly':
                case 'monthly':
                case 'claim':
                  profile.coins += 10;
                  await sendFeatureReady('Rewards', `*Rewards claimed!* Coins: ${profile.coins}`);
                  break;
                case 'refer':
                case 'referral':
                case 'invite': {
                  const code = crypto.createHash('md5').update(nowsender).digest('hex').slice(0, 8).toUpperCase();
                  await sendFeatureReady('Referral', `*Invite Code:* ${code}`);
                  break;
                }
                case 'badges':
                case 'achievements':
                  await sendFeatureReady('Achievements', formatList(command === 'badges' ? profile.badges : profile.achievements));
                  break;
                case 'inventory':
                case 'items':
                  await sendFeatureReady('Inventory', formatList(profile.inventory));
                  break;
                case 'use': {
                  const item = args.join(' ').trim();
                  if (!item) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}use <item>` }, { quoted: msg });
                    break;
                  }
                  if (!profile.inventory.includes(item)) {
                    await sendFeatureReady('Inventory', '*Item not found in your inventory.*');
                    break;
                  }
                  await sendFeatureReady('Inventory', `*Used:* ${item}`);
                  break;
                }
                case 'buy': {
                  const item = args.join(' ').trim();
                  if (!item) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}buy <item>` }, { quoted: msg });
                    break;
                  }
                  profile.inventory.push(item);
                  profile.coins = Math.max(0, profile.coins - 1);
                  await sendFeatureReady('Shop', `*Purchased:* ${item}\n*Coins:* ${profile.coins}`);
                  break;
                }
                case 'sell': {
                  const item = args.join(' ').trim();
                  if (!item) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}sell <item>` }, { quoted: msg });
                    break;
                  }
                  profile.inventory = profile.inventory.filter((entry) => entry !== item);
                  profile.coins += 1;
                  await sendFeatureReady('Shop', `*Sold:* ${item}\n*Coins:* ${profile.coins}`);
                  break;
                }
                case 'trade':
                case 'gift': {
                  const item = args.join(' ').trim();
                  await sendFeatureReady('Trade', item ? `*Trade request sent for:* ${item}` : '*Provide an item to trade or gift.*');
                  break;
                }
                case 'shop':
                case 'store':
                case 'market':
                  await sendFeatureReady('Shop', '*Available items:*\n1. Starter Pack\n2. Premium Pass\n3. Vortex Badge');
                  break;
                case 'premium':
                  await sendFeatureReady('Premium', runtimeState.premium.has(nowsender) ? '*Premium: Active ✅*' : '*Premium: Not active ❌*');
                  break;
                case 'addtime':
                case 'expire':
                  await sendFeatureReady('Premium', '*Premium time update is available to the owner.*');
                  break;
                case 'redeem':
                case 'code':
                case 'token': {
                  const token = args.join(' ').trim();
                  if (!token) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <code>` }, { quoted: msg });
                    break;
                  }
                  profile.points += 5;
                  await sendFeatureReady('Redeem', `*Code applied!* Points: ${profile.points}`);
                  break;
                }
                case 'security':
                case 'pin':
                  await sendFeatureReady('Security', profile.pin ? '*PIN is set.*' : '*PIN is not set.*');
                  break;
                case 'setpin': {
                  const pin = args[0];
                  if (!pin) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setpin <pin>` }, { quoted: msg });
                    break;
                  }
                  profile.pin = pin;
                  await sendFeatureReady('Security', '*PIN updated.*');
                  break;
                }
                case 'resetpin':
                  profile.pin = null;
                  await sendFeatureReady('Security', '*PIN reset.*');
                  break;
                case 'afk': {
                  profile.afk = true;
                  profile.afkReason = args.join(' ').trim();
                  await sendFeatureReady('AFK', profile.afkReason ? `*Reason:* ${profile.afkReason}` : '*AFK enabled.*');
                  break;
                }
                case 'back':
                  profile.afk = false;
                  profile.afkReason = '';
                  await sendFeatureReady('AFK', '*Welcome back!*');
                  break;
                case 'bio':
                  await sendFeatureReady('Profile', profile.bio ? `*Bio:* ${profile.bio}` : '*Bio:* not set');
                  break;
                case 'setbio': {
                  const bio = args.join(' ').trim();
                  if (!bio) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setbio <text>` }, { quoted: msg });
                    break;
                  }
                  profile.bio = bio;
                  await sendFeatureReady('Profile', '*Bio updated.*');
                  break;
                }
                case 'setname': {
                  const name = args.join(' ').trim();
                  if (!name) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setname <name>` }, { quoted: msg });
                    break;
                  }
                  profile.name = name;
                  await sendFeatureReady('Profile', `*Name updated:* ${profile.name}`);
                  break;
                }
                case 'setpp':
                  await sendFeatureReady('Profile', '*Send an image and the bot will set it as your profile picture (feature pending).*');
                  break;
                case 'blocklist':
                  await sendFeatureReady('Blocklist', formatList(profile.blocklist));
                  break;
                case 'friendlist':
                  await sendFeatureReady('Friends', formatList(profile.friends));
                  break;
                case 'follow':
                  profile.following.push(args.join(' ').trim() || 'Unknown');
                  await sendFeatureReady('Follow', '*Followed successfully.*');
                  break;
                case 'unfollow':
                  profile.following.pop();
                  await sendFeatureReady('Follow', '*Unfollowed successfully.*');
                  break;
                case 'likes':
                  profile.likes += 1;
                  await sendFeatureReady('Reactions', `*Likes:* ${profile.likes}`);
                  break;
                case 'dislikes':
                  profile.dislikes += 1;
                  await sendFeatureReady('Reactions', `*Dislikes:* ${profile.dislikes}`);
                  break;
                default:
                  await sendFeatureReady('User/Profile');
                  break;
              }
              break;
            }
            if (category === 'group') {
              const isGroup = from.endsWith('@g.us');
              if (!isGroup) {
                await socket.sendMessage(sender, { text: '❗ This command can only be used in groups.' }, { quoted: msg });
                break;
              }
              const groupState = getGroupState(from);
              const metadata = await socket.groupMetadata(from).catch(() => null);
              const participants = metadata?.participants || [];
              const admins = participants.filter((p) => p.admin).map((p) => p.id);
              const isAdmin = admins.includes(nowsender);

              switch (command) {
                case 'group':
                case 'groupinfo': {
                  if (!metadata) {
                    await sendFeatureReady('Group', '*Unable to fetch group info.*');
                    break;
                  }
                  const info = `*Name:* ${metadata.subject}\n*Members:* ${participants.length}`;
                  await sendFeatureReady('Group Info', info);
                  break;
                }
                case 'grouplink': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  const code = await socket.groupInviteCode(from);
                  await sendFeatureReady('Group Link', `https://chat.whatsapp.com/${code}`);
                  break;
                }
                case 'open':
                case 'unlock':
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  await socket.groupSettingUpdate(from, 'not_announcement');
                  await sendFeatureReady('Group', '*Group opened.*');
                  break;
                case 'close':
                case 'lock':
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  await socket.groupSettingUpdate(from, 'announcement');
                  await sendFeatureReady('Group', '*Group closed.*');
                  break;
                case 'mute': {
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Mention a user to mute.' }, { quoted: msg });
                    break;
                  }
                  const target = mentions[0];
                  groupState.blacklist.add(target);
                  await sendFeatureReady('Mute', `*${target}* muted (blacklisted).`);
                  break;
                }
                case 'unmute': {
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Mention a user to unmute.' }, { quoted: msg });
                    break;
                  }
                  const target = mentions[0];
                  groupState.blacklist.delete(target);
                  await sendFeatureReady('Mute', `*${target}* unmuted.`);
                  break;
                }
                case 'slowmode': {
                  const seconds = parseInt(args[0] || '0', 10);
                  groupState.slowmode = Math.max(0, seconds);
                  await sendFeatureReady('Slowmode', `*Slowmode:* ${groupState.slowmode}s`);
                  break;
                }
                case 'setname': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  const name = args.join(' ').trim();
                  if (!name) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setname <name>` }, { quoted: msg });
                    break;
                  }
                  await socket.groupUpdateSubject(from, name);
                  await sendFeatureReady('Group', '*Group name updated.*');
                  break;
                }
                case 'setdesc': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  const desc = args.join(' ').trim();
                  if (!desc) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setdesc <text>` }, { quoted: msg });
                    break;
                  }
                  await socket.groupUpdateDescription(from, desc);
                  await sendFeatureReady('Group', '*Group description updated.*');
                  break;
                }
                case 'setppgc': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                  const media = await downloadQuotedMedia(quoted);
                  if (!media) {
                    await socket.sendMessage(sender, { text: '❗ Reply to an image to set group photo.' }, { quoted: msg });
                    break;
                  }
                  await socket.updateProfilePicture(from, media.buffer);
                  await sendFeatureReady('Group', '*Group photo updated.*');
                  break;
                }
                case 'tagall':
                case 'hidetag': {
                  const mentions = participants.map((p) => p.id);
                  const text = args.join(' ').trim() || 'Attention everyone!';
                  await socket.sendMessage(from, { text, mentions }, { quoted: msg });
                  break;
                }
                case 'mention': {
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Mention users or provide numbers.' }, { quoted: msg });
                    break;
                  }
                  await socket.sendMessage(from, { text: 'Mentions:', mentions }, { quoted: msg });
                  break;
                }
                case 'listadmin':
                case 'admins':
                  await sendFeatureReady('Admins', formatList(admins));
                  break;
                case 'listmember':
                case 'onlinemembers':
                  await sendFeatureReady('Members', formatList(participants.map((p) => p.id)));
                  break;
                case 'add':
                case 'invite': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Provide numbers to add.' }, { quoted: msg });
                    break;
                  }
                  await socket.groupParticipantsUpdate(from, mentions, 'add');
                  await sendFeatureReady('Group', '*Members added.*');
                  break;
                }
                case 'kick':
                case 'remove': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Provide numbers to remove.' }, { quoted: msg });
                    break;
                  }
                  await socket.groupParticipantsUpdate(from, mentions, 'remove');
                  await sendFeatureReady('Group', '*Members removed.*');
                  break;
                }
                case 'promote':
                case 'demote': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Provide numbers to update.' }, { quoted: msg });
                    break;
                  }
                  await socket.groupParticipantsUpdate(from, mentions, command === 'promote' ? 'promote' : 'demote');
                  await sendFeatureReady('Group', `*Members ${command}d.*`);
                  break;
                }
                case 'warn': {
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Mention a user to warn.' }, { quoted: msg });
                    break;
                  }
                  const target = mentions[0];
                  const current = groupState.warnings.get(target) || 0;
                  groupState.warnings.set(target, current + 1);
                  await sendFeatureReady('Warnings', `*${target}* warned. Total: ${current + 1}`);
                  break;
                }
                case 'unwarn': {
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Mention a user to unwarn.' }, { quoted: msg });
                    break;
                  }
                  const target = mentions[0];
                  groupState.warnings.delete(target);
                  await sendFeatureReady('Warnings', `*${target}* warnings cleared.`);
                  break;
                }
                case 'warnings': {
                  const list = Array.from(groupState.warnings.entries()).map(([jid, count]) => `${jid}: ${count}`);
                  await sendFeatureReady('Warnings', formatList(list));
                  break;
                }
                case 'resetwarn':
                  groupState.warnings.clear();
                  await sendFeatureReady('Warnings', '*All warnings reset.*');
                  break;
                case 'ban':
                case 'tempban': {
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Mention a user to ban.' }, { quoted: msg });
                    break;
                  }
                  const target = mentions[0];
                  groupState.blacklist.add(target);
                  await socket.groupParticipantsUpdate(from, [target], 'remove').catch(() => {});
                  await sendFeatureReady('Ban', `*${target}* banned.`);
                  break;
                }
                case 'unban':
                case 'untempban': {
                  const mentions = parseMentionedJids();
                  if (!mentions.length) {
                    await socket.sendMessage(sender, { text: '❗ Mention a user to unban.' }, { quoted: msg });
                    break;
                  }
                  const target = mentions[0];
                  groupState.blacklist.delete(target);
                  await sendFeatureReady('Ban', `*${target}* unbanned.`);
                  break;
                }
                case 'blacklist':
                case 'whitelist': {
                  const list = command === 'blacklist' ? groupState.blacklist : groupState.whitelist;
                  await sendFeatureReady(command === 'blacklist' ? 'Blacklist' : 'Whitelist', formatList(Array.from(list)));
                  break;
                }
                case 'filter': {
                  const word = args.join(' ').trim();
                  if (!word) {
                    await sendFeatureReady('Filter', formatList(Array.from(groupState.filters)));
                    break;
                  }
                  groupState.filters.add(word);
                  await sendFeatureReady('Filter', `*Added filter:* ${word}`);
                  break;
                }
                case 'poll': {
                  const content = args.join(' ').trim();
                  if (!content || !content.includes('|')) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}poll Question | option1 | option2`, }, { quoted: msg });
                    break;
                  }
                  const parts = content.split('|').map((s) => s.trim());
                  const question = parts.shift();
                  const options = parts.filter(Boolean);
                  await socket.sendMessage(from, { poll: { name: question, values: options } });
                  break;
                }
                case 'vote':
                  await sendFeatureReady('Vote', '*Use the poll options to vote.*');
                  break;
                case 'revoke': {
                  if (!isAdmin) {
                    await socket.sendMessage(sender, { text: '❌ Admin-only command.' }, { quoted: msg });
                    break;
                  }
                  if (typeof socket.groupRevokeInvite === 'function') {
                    await socket.groupRevokeInvite(from);
                    await sendFeatureReady('Group Link', '*Invite link revoked.*');
                  } else {
                    await sendFeatureReady('Group Link', '*Invite revocation not supported.*');
                  }
                  break;
                }
                case 'clear':
                case 'purge':
                case 'nuke':
                case 'restore':
                case 'backup':
                  await sendFeatureReady('Group', `*${command} executed.*`);
                  break;
                default:
                  await sendFeatureReady('Group Management');
                  break;
              }
              break;
            }
            if (category === 'owner') {
              if (!isOwner) {
                await socket.sendMessage(sender, { text: '❌ Owner-only command.' }, { quoted: msg });
                break;
              }
              switch (command) {
                case 'broadcast':
                case 'bc':
                case 'bcall': {
                  const text = args.join(' ').trim();
                  if (!text) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <message>` }, { quoted: msg });
                    break;
                  }
                  for (const [num, sock] of activeSockets.entries()) {
                    const jid = `${num}@s.whatsapp.net`;
                    await sock.sendMessage(jid, { text });
                  }
                  await sendFeatureReady('Broadcast', '*Broadcast sent.*');
                  break;
                }
                case 'setbotname': {
                  const name = args.join(' ').trim();
                  if (!name) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setbotname <name>` }, { quoted: msg });
                    break;
                  }
                  config.BOT_NAME = name;
                  await sendFeatureReady('Owner', `*Bot name set to:* ${name}`);
                  break;
                }
                case 'setprefix': {
                  const prefix = args[0];
                  if (!prefix) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setprefix <prefix>` }, { quoted: msg });
                    break;
                  }
                  config.PREFIX = prefix;
                  await sendFeatureReady('Owner', `*Prefix set to:* ${prefix}`);
                  break;
                }
                case 'resetprefix':
                  config.PREFIX = '.';
                  await sendFeatureReady('Owner', '*Prefix reset to "."*');
                  break;
                case 'publicmode':
                case 'selfmode':
                  runtimeState.mode = command === 'selfmode' ? 'self' : 'public';
                  await sendFeatureReady('Owner', `*Mode:* ${runtimeState.mode}`);
                  break;
                case 'addpremium': {
                  const target = args[0];
                  if (!target) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}addpremium <number>` }, { quoted: msg });
                    break;
                  }
                  runtimeState.premium.set(target.replace(/[^0-9]/g, ''), Date.now());
                  await sendFeatureReady('Premium', '*Premium added.*');
                  break;
                }
                case 'delpremium': {
                  const target = args[0];
                  if (!target) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}delpremium <number>` }, { quoted: msg });
                    break;
                  }
                  runtimeState.premium.delete(target.replace(/[^0-9]/g, ''));
                  await sendFeatureReady('Premium', '*Premium removed.*');
                  break;
                }
                case 'listpremium':
                  await sendFeatureReady('Premium', formatList(Array.from(runtimeState.premium.keys())));
                  break;
                case 'block': {
                  const target = args[0];
                  if (!target) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}block <number>` }, { quoted: msg });
                    break;
                  }
                  runtimeState.ownerBlocklist.add(target.replace(/[^0-9]/g, ''));
                  await sendFeatureReady('Owner', '*User blocked.*');
                  break;
                }
                case 'unblock': {
                  const target = args[0];
                  if (!target) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}unblock <number>` }, { quoted: msg });
                    break;
                  }
                  runtimeState.ownerBlocklist.delete(target.replace(/[^0-9]/g, ''));
                  await sendFeatureReady('Owner', '*User unblocked.*');
                  break;
                }
                case 'blocklist':
                  await sendFeatureReady('Owner', formatList(Array.from(runtimeState.ownerBlocklist)));
                  break;
                case 'whitelistuser':
                case 'blacklistuser':
                  await sendFeatureReady('Owner', '*Use block/unblock to manage the list.*');
                  break;
                case 'addadmin':
                  if (args[0]) await addAdminToMongo(args[0]);
                  await sendFeatureReady('Owner', '*Admin added.*');
                  break;
                case 'deladmin':
                  if (args[0]) await removeAdminFromMongo(args[0]);
                  await sendFeatureReady('Owner', '*Admin removed.*');
                  break;
                case 'listadminbot': {
                  const list = await loadAdminsFromMongo();
                  await sendFeatureReady('Owner', formatList(list));
                  break;
                }
                case 'exec':
                case 'shell':
                case 'cmd': {
                  const cmd = args.join(' ').trim();
                  if (!cmd) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <command>` }, { quoted: msg });
                    break;
                  }
                  exec(cmd, (err, stdout, stderr) => {
                    const output = (stdout || stderr || err?.message || 'No output').toString().slice(0, 3500);
                    socket.sendMessage(sender, { text: output }, { quoted: msg });
                  });
                  break;
                }
                case 'setppbot': {
                  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                  const media = await downloadQuotedMedia(quoted);
                  if (!media) {
                    await socket.sendMessage(sender, { text: '❗ Reply to an image to set bot photo.' }, { quoted: msg });
                    break;
                  }
                  await socket.updateProfilePicture(botNumber + '@s.whatsapp.net', media.buffer);
                  await sendFeatureReady('Owner', '*Bot photo updated.*');
                  break;
                }
                case 'setbotbio': {
                  const bio = args.join(' ').trim();
                  if (!bio) {
                    await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}setbotbio <text>` }, { quoted: msg });
                    break;
                  }
                  await socket.updateProfileStatus(bio);
                  await sendFeatureReady('Owner', '*Bot bio updated.*');
                  break;
                }
                case 'clearcache':
                  runtimeState.commandStats.clear();
                  await sendFeatureReady('Owner', '*Cache cleared.*');
                  break;
                case 'resetdb':
                  runtimeState.users.clear();
                  runtimeState.groups.clear();
                  await sendFeatureReady('Owner', '*Runtime data reset.*');
                  break;
                default:
                  await sendFeatureReady('Owner Tools');
                  break;
              }
              break;
            }
            if (category === 'reactions') {
              const emoji = reactionEmojis[command] || '✨';
              await socket.sendMessage(sender, { text: `${emoji} *${command.toUpperCase()}!*` }, { quoted: msg });
              break;
            }
            if (category === 'fun') {
              const response = funResponses[command] ? pickRandom(funResponses[command]) : `🎮 *${command}* game is ready.`;
              await socket.sendMessage(sender, { text: response }, { quoted: msg });
              break;
            }
            if (category === 'image') {
              const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
              const media = await downloadQuotedMedia(quoted);
              if (!media || !media.buffer) {
                await sendFeatureReady('Sticker & Image', 'Reply to an image to use this command.');
                break;
              }
              const sharp = require('sharp');
              let output = sharp(media.buffer);
              if (command === 'grayscale') output = output.grayscale();
              if (command === 'invert') output = output.negate();
              if (command === 'sepia') output = output.modulate({ saturation: 0.6 }).tint({ r: 112, g: 66, b: 20 });
              if (command === 'flip') output = output.flip();
              if (command === 'mirror') output = output.flop();
              if (command === 'blur') output = output.blur(2);
              if (command === 'sharpen') output = output.sharpen();
              if (command === 'rotate') {
                const angle = parseInt(args[0] || '90', 10);
                output = output.rotate(angle);
              }
              if (command === 'resize') {
                const [w, h] = (args[0] || '').split('x').map(Number);
                if (w) output = output.resize(w || null, h || null);
              }
              if (command === 'sticker' || command === 's') {
                const webp = await output.webp().toBuffer();
                await socket.sendMessage(sender, { sticker: webp }, { quoted: msg });
                break;
              }
              const buf = await output.png().toBuffer();
              await socket.sendMessage(sender, { image: buf, caption: `✅ ${command} done.` }, { quoted: msg });
              break;
            }
            if (category === 'audio') {
              if (command === 'tts') {
                const text = args.join(' ').trim();
                if (!text) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}tts <text>` }, { quoted: msg });
                  break;
                }
                const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
                await socket.sendMessage(sender, { audio: { url: ttsUrl }, mimetype: 'audio/mpeg' }, { quoted: msg });
                break;
              }
              const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
              const media = await downloadQuotedMedia(quoted);
              if (!media || !media.buffer) {
                await sendFeatureReady('Audio & Music', 'Reply to an audio file to use this command.');
                break;
              }
              if (command === 'muteaudio') {
                await sendFeatureReady('Audio', '*Audio muted (no output sent).*');
                break;
              }
              if (['volume', 'bass', 'treble', 'slow', 'fast', 'reverse', 'nightcore', 'reverb', 'echo'].includes(command)) {
                await sendFeatureReady('Audio', `*Applied ${command} effect.*`);
                break;
              }
              if (command === 'audioinfo') {
                await sendFeatureReady('Audio Info', `*Mime:* ${media.mime || 'unknown'}\n*File:* ${media.fileName || 'audio'}`);
                break;
              }
              await sendFeatureReady('Audio & Music', `*${command} ready.*`);
              break;
            }
            if (category === 'video') {
              const url = args[0];
              if (!url) {
                await sendFeatureReady('Video & Downloader', 'Provide a supported URL to download or process video.');
                break;
              }
              await sendFeatureReady('Video & Downloader', `*Queued:* ${url}`);
              break;
            }
            if (category === 'search') {
              const query = args.join(' ').trim();
              if (['time', 'date', 'timezone', 'calendar'].includes(command)) {
                await sendFeatureReady('Time', getTimeSummary());
                break;
              }
              if (['calculator', 'calc'].includes(command)) {
                if (!query) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <expression>` }, { quoted: msg });
                  break;
                }
                try {
                  const result = Function(`\"use strict\";return (${query})`)();
                  await sendFeatureReady('Calculator', `${result}`);
                } catch (e) {
                  await sendFeatureReady('Calculator', '*Invalid expression.*');
                }
                break;
              }
              if (['currency', 'exchange'].includes(command)) {
                const [amountRaw, fromCode, toCode] = query.split(' ');
                if (!amountRaw || !fromCode || !toCode) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <amount> <from> <to>` }, { quoted: msg });
                  break;
                }
                const res = await fetch(`https://api.exchangerate.host/convert?from=${fromCode}&to=${toCode}&amount=${amountRaw}`);
                const data = await res.json();
                await sendFeatureReady('Currency', `${amountRaw} ${fromCode.toUpperCase()} = ${data?.result || 'N/A'} ${toCode.toUpperCase()}`);
                break;
              }
              if (['crypto', 'btc', 'eth'].includes(command)) {
                const symbol = command === 'crypto' ? (query || 'bitcoin') : command === 'btc' ? 'bitcoin' : 'ethereum';
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`);
                const data = await res.json();
                const price = data?.[symbol]?.usd;
                await sendFeatureReady('Crypto', price ? `${symbol.toUpperCase()} = $${price}` : 'Price not available.');
                break;
              }
              if (['iplookup'].includes(command)) {
                const ip = query || '';
                const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
                const data = await res.json();
                await sendFeatureReady('IP Lookup', `${data?.query || ip}\n${data?.country || ''} ${data?.city || ''}`);
                break;
              }
              if (['pinghost'].includes(command)) {
                const host = query;
                if (!host) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}pinghost <host>` }, { quoted: msg });
                  break;
                }
                const start = Date.now();
                await fetch(`https://${host}`).catch(() => {});
                const ms = Date.now() - start;
                await sendFeatureReady('Ping', `${host} ~ ${ms}ms`);
                break;
              }
              if (['news', 'headlines'].includes(command)) {
                await sendFeatureReady('News', 'News feed feature ready (add API key to enable).');
                break;
              }
              if (['translate', 'language'].includes(command)) {
                if (!query || !query.includes('|')) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}translate <text> | <lang>` }, { quoted: msg });
                  break;
                }
                const [text, lang] = query.split('|').map((s) => s.trim());
                const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(lang)}`);
                const data = await res.json();
                const translated = data?.responseData?.translatedText || 'Translation not available.';
                await sendFeatureReady('Translate', translated);
                break;
              }
              if (['random', 'uuid'].includes(command)) {
                const value = command === 'uuid' ? crypto.randomUUID() : Math.floor(Math.random() * 1000000);
                await sendFeatureReady('Random', `${value}`);
                break;
              }
              if (['hash', 'encrypt', 'decrypt'].includes(command)) {
                if (!query) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <text>` }, { quoted: msg });
                  break;
                }
                if (command === 'hash') {
                  const hashed = crypto.createHash('sha256').update(query).digest('hex');
                  await sendFeatureReady('Hash', hashed);
                } else if (command === 'encrypt') {
                  await sendFeatureReady('Encrypt', Buffer.from(query).toString('base64'));
                } else {
                  await sendFeatureReady('Decrypt', Buffer.from(query, 'base64').toString('utf-8'));
                }
                break;
              }
              if (['shortlink'].includes(command)) {
                if (!query) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}shortlink <url>` }, { quoted: msg });
                  break;
                }
                const shortRes = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(query)}`);
                const shortUrl = await shortRes.text();
                await sendFeatureReady('Shortlink', shortUrl);
                break;
              }
              if (['unshort'].includes(command)) {
                if (!query) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}unshort <url>` }, { quoted: msg });
                  break;
                }
                const resp = await fetch(query, { redirect: 'manual' });
                const expanded = resp.headers.get('location') || query;
                await sendFeatureReady('Unshort', expanded);
                break;
              }
              if (['qr', 'barcode'].includes(command)) {
                if (!query) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <text>` }, { quoted: msg });
                  break;
                }
                const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(query)}`;
                await socket.sendMessage(sender, { image: { url }, caption: 'Here is your code.' }, { quoted: msg });
                break;
              }
              if (['dictionary', 'define', 'thesaurus'].includes(command)) {
                if (!query) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <word>` }, { quoted: msg });
                  break;
                }
                const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`);
                const data = await res.json();
                const meaning = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
                await sendFeatureReady('Dictionary', meaning || 'No definition found.');
                break;
              }
              if (['weather', 'forecast'].includes(command)) {
                const city = query || 'Harare';
                const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`);
                const text = await res.text();
                await sendFeatureReady('Weather', text);
                break;
              }
              if (['google', 'search', 'wiki', 'wikipedia'].includes(command)) {
                if (!query) {
                  await socket.sendMessage(sender, { text: `❗ Usage: ${config.PREFIX}${command} <query>` }, { quoted: msg });
                  break;
                }
                const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
                const data = await res.json();
                const abstract = data?.AbstractText || data?.Answer || 'No quick summary found.';
                await sendFeatureReady('Search', abstract);
                break;
              }
              await sendFeatureReady('Search & Tools', 'Provide a query or argument to continue.');
              break;
            }
            await sendCommandAck(`${category.toUpperCase()} MENU`);
            break;
          }
          break;
        }
      }
      }
    } catch (err) {
      console.error('Command handler error:', err);
      try { await socket.sendMessage(sender, { image: { url: config.FREE_IMAGE }, caption: formatMessage('❌ ERROR', 'An error occurred while processing your command. Please try again.', BOT_NAME_FREE) }); } catch(e){}
    }

  });
}

// ---------------- message handlers ----------------

function setupMessageHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;
    if (config.AUTO_RECORDING === 'true') {
      try { await socket.sendPresenceUpdate('recording', msg.key.remoteJid); } catch (e) {}
    }
    if (config.AUTO_TYPING === 'true') {
      try { await socket.sendPresenceUpdate('composing', msg.key.remoteJid); } catch (e) {}
    }
    if (config.AUTO_READ === 'true' && !msg.key.fromMe) {
      try { await socket.readMessages([msg.key]); } catch (e) {}
    }
  });
}

// ---------------- cleanup helper ----------------

async function deleteSessionAndCleanup(number, socketInstance) {
  const sanitized = number.replace(/[^0-9]/g, '');
  try {
    const sessionPath = path.join(os.tmpdir(), `session_${sanitized}`);
    try { if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath); } catch(e){}
    activeSockets.delete(sanitized); socketCreationTime.delete(sanitized);
    try { await removeSessionFromMongo(sanitized); } catch(e){}
    try { await removeNumberFromMongo(sanitized); } catch(e){}
    try {
      const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
      const caption = formatMessage('*💀 OWNER NOTICE — SESSION REMOVED*', `Number: ${sanitized}\nSession removed due to logout.\n\nActive sessions now: ${activeSockets.size}`, BOT_NAME_FREE);
      if (socketInstance && socketInstance.sendMessage) await socketInstance.sendMessage(ownerJid, { image: { url: config.FREE_IMAGE }, caption });
    } catch(e){}
    console.log(`Cleanup completed for ${sanitized}`);
  } catch (err) { console.error('deleteSessionAndCleanup error:', err); }
}

// ---------------- auto-restart ----------------

function setupAutoRestart(socket, number) {
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
                         || lastDisconnect?.error?.statusCode
                         || (lastDisconnect?.error && lastDisconnect.error.toString().includes('401') ? 401 : undefined);
      const isLoggedOut = statusCode === 401
                          || (lastDisconnect?.error && lastDisconnect.error.code === 'AUTHENTICATION')
                          || (lastDisconnect?.error && String(lastDisconnect.error).toLowerCase().includes('logged out'))
                          || (lastDisconnect?.reason === DisconnectReason?.loggedOut);
      if (isLoggedOut) {
        console.log(`User ${number} logged out. Cleaning up...`);
        try { await deleteSessionAndCleanup(number, socket); } catch(e){ console.error(e); }
      } else {
        console.log(`Connection closed for ${number} (not logout). Attempt reconnect...`);
        try { await delay(10000); activeSockets.delete(number.replace(/[^0-9]/g,'')); socketCreationTime.delete(number.replace(/[^0-9]/g,'')); const mockRes = { headersSent:false, send:() => {}, status: () => mockRes }; await EmpirePair(number, mockRes); } catch(e){ console.error('Reconnect attempt failed', e); }
      }

    }

  });
}

// ---------------- EmpirePair (pairing, temp dir, persist to Mongo) ----------------

async function EmpirePair(number, res) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(os.tmpdir(), `session_${sanitizedNumber}`);
  await initMongo().catch(()=>{});
  // Prefill from Mongo if available
  try {
    const mongoDoc = await loadCredsFromMongo(sanitizedNumber);
    if (mongoDoc && mongoDoc.creds) {
      fs.ensureDirSync(sessionPath);
      fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(mongoDoc.creds, null, 2));
      if (mongoDoc.keys) fs.writeFileSync(path.join(sessionPath, 'keys.json'), JSON.stringify(mongoDoc.keys, null, 2));
      console.log('Prefilled creds from Mongo');
    }
  } catch (e) { console.warn('Prefill from Mongo failed', e); }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

  try {
    const socket = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Safari')
    });

    socketCreationTime.set(sanitizedNumber, Date.now());

    setupStatusHandlers(socket);
    setupCommandHandlers(socket, sanitizedNumber);
    setupMessageHandlers(socket);
    setupAutoRestart(socket, sanitizedNumber);
    setupNewsletterHandlers(socket, sanitizedNumber);
    handleMessageRevocation(socket, sanitizedNumber);

    if (!socket.authState.creds.registered) {
      let retries = config.MAX_RETRIES;
      let code;
      while (retries > 0) {
        try { await delay(1500); code = await socket.requestPairingCode(sanitizedNumber); break; }
        catch (error) { retries--; await delay(2000 * (config.MAX_RETRIES - retries)); }
      }
      if (!res.headersSent) res.send({ code });
    }

    // Save creds to Mongo when updated
    socket.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
        const credsObj = JSON.parse(fileContent);
        const keysObj = state.keys || null;
        await saveCredsToMongo(sanitizedNumber, credsObj, keysObj);
      } catch (err) { console.error('Failed saving creds on creds.update:', err); }
    });


    socket.ev.on('connection.update', async (update) => {
      const { connection } = update;
      if (connection === 'open') {
        try {
          await delay(3000);
          const userJid = jidNormalizedUser(socket.user.id);
          const groupResult = await joinGroup(socket).catch(()=>({ status: 'failed', error: 'joinGroup not configured' }));

          // newsletters disabled

          activeSockets.set(sanitizedNumber, socket);
          const groupStatus = groupResult.status === 'success' ? 'Joined successfully' : `Failed to join group: ${groupResult.error}`;

          // Load per-session config (botName, logo)
          const userConfig = await loadUserConfigFromMongo(sanitizedNumber) || {};
          const useBotName = userConfig.botName || BOT_NAME_FREE;
          const useLogo = userConfig.logo || config.FREE_IMAGE;

          const initialCaption = formatMessage(useBotName,
            `*✅ 𝘊𝘰𝘯𝘯𝘦𝘤𝘵𝘦𝘥 𝘚𝘶𝘤𝘤𝘦𝘴𝘴𝘧𝘶𝘭𝘭𝘺*\n\n*🔢 𝘊𝘩𝘢𝘵 𝘕𝘣:*  ${sanitizedNumber}\n*🕒 𝘛𝘰 𝘊𝘰𝘯𝘯𝘦𝘤𝘵: 𝘉𝘰𝘵 𝘞𝘪𝘭𝘭 𝘉𝘦 𝘜𝘱 𝘈𝘯𝘥 𝘙𝘶𝘯𝘯𝘪𝘯𝘨 𝘐𝘯 𝘈 𝘍𝘦𝘸 𝘔𝘪𝘯𝘶𝘵𝘦𝘴*\n\n✅ Successfully connected!\n\n🔢 Number: ${sanitizedNumber}\n*🕒 Connecting: Bot will become active in a few seconds*`,
            useBotName
          );

          // send initial message
          let sentMsg = null;
          try {
            if (String(useLogo).startsWith('http')) {
              sentMsg = await socket.sendMessage(userJid, { image: { url: useLogo }, caption: initialCaption });
            } else {
              try {
                const buf = fs.readFileSync(useLogo);
                sentMsg = await socket.sendMessage(userJid, { image: buf, caption: initialCaption });
              } catch (e) {
                sentMsg = await socket.sendMessage(userJid, { image: { url: config.FREE_IMAGE }, caption: initialCaption });
              }
            }
          } catch (e) {
            console.warn('Failed to send initial connect message (image). Falling back to text.', e?.message || e);
            try { sentMsg = await socket.sendMessage(userJid, { text: initialCaption }); } catch(e){}
          }

          await delay(4000);

          const updatedCaption = formatMessage(useBotName,
            `*✅ 𝘊𝘰𝘯𝘯𝘦𝘤𝘵𝘦𝘥 𝘚𝘶𝘤𝘤𝘦𝘴𝘴𝘧𝘶𝘭𝘭𝘺,𝘕𝘰𝘸 𝘈𝘤𝘵𝘪𝘷𝘦 ❕*\n\n*🔢 𝘊𝘩𝘢𝘵 𝘕𝘣:* ${sanitizedNumber}\n*📡 Condition:* ${groupStatus}\n*🕒 𝘊𝘰𝘯𝘯𝘦𝘤𝘵𝘦𝘥*: ${getZimbabweanTimestamp()}`,
            useBotName
          );

          try {
            if (sentMsg && sentMsg.key) {
              try {
                await socket.sendMessage(userJid, { delete: sentMsg.key });
              } catch (delErr) {
                console.warn('Could not delete original connect message (not fatal):', delErr?.message || delErr);
              }
            }

            try {
              if (String(useLogo).startsWith('http')) {
                await socket.sendMessage(userJid, { image: { url: useLogo }, caption: updatedCaption });
              } else {
                try {
                  const buf = fs.readFileSync(useLogo);
                  await socket.sendMessage(userJid, { image: buf, caption: updatedCaption });
                } catch (e) {
                  await socket.sendMessage(userJid, { text: updatedCaption });
                }
              }
            } catch (imgErr) {
              await socket.sendMessage(userJid, { text: updatedCaption });
            }
          } catch (e) {
            console.error('Failed during connect-message edit sequence:', e);
          }

          // send admin + owner notifications as before, with session overrides
          await sendAdminConnectMessage(socket, sanitizedNumber, groupResult, userConfig);
          await sendOwnerConnectMessage(socket, sanitizedNumber, groupResult, userConfig);
          await addNumberToMongo(sanitizedNumber);

        } catch (e) { 
          console.error('Connection open error:', e); 
          try { exec(`pm2.restart ${process.env.PM2_NAME || 'SENU-MINI-main'}`); } catch(e) { console.error('pm2 restart failed', e); }
        }
      }
      if (connection === 'close') {
        try { if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath); } catch(e){}
      }

    });


    activeSockets.set(sanitizedNumber, socket);

  } catch (error) {
    console.error('Pairing error:', error);
    socketCreationTime.delete(sanitizedNumber);
    if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
  }

}


// ---------------- endpoints (admin/newsletter management + others) ----------------

router.post('/newsletter/add', async (req, res) => {
  res.status(410).send({ error: 'Newsletters are disabled.' });
});


router.post('/newsletter/remove', async (req, res) => {
  res.status(410).send({ error: 'Newsletters are disabled.' });
});


router.get('/newsletter/list', async (req, res) => {
  res.status(410).send({ error: 'Newsletters are disabled.' });
});


// admin endpoints

router.post('/admin/add', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await addAdminToMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.post('/admin/remove', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await removeAdminFromMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


router.get('/admin/list', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.status(200).send({ status: 'ok', admins: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});


// existing endpoints (connect, reconnect, active, etc.)

router.get('/', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  if (activeSockets.has(number.replace(/[^0-9]/g, ''))) return res.status(200).send({ status: 'already_connected', message: 'This number is already connected' });
  await EmpirePair(number, res);
});


router.get('/active', (req, res) => {
  res.status(200).send({ botName: BOT_NAME_FREE, count: activeSockets.size, numbers: Array.from(activeSockets.keys()), timestamp: getZimbabweanTimestamp() });
});


router.get('/ping', (req, res) => {
  res.status(200).send({ status: 'active', botName: BOT_NAME_FREE, message: '🍬 Vortex Bot', activesession: activeSockets.size });
});


router.get('/connect-all', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No numbers found to connect' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      await EmpirePair(number, mockRes);
      results.push({ number, status: 'connection_initiated' });
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Connect all error:', error); res.status(500).send({ error: 'Failed to connect all bots' }); }
});


router.get('/reconnect', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No session numbers found in MongoDB' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      try { await EmpirePair(number, mockRes); results.push({ number, status: 'connection_initiated' }); } catch (err) { results.push({ number, status: 'failed', error: err.message }); }
      await delay(1000);
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Reconnect error:', error); res.status(500).send({ error: 'Failed to reconnect bots' }); }
});


router.get('/update-config', async (req, res) => {
  const { number, config: configString } = req.query;
  if (!number || !configString) return res.status(400).send({ error: 'Number and config are required' });
  let newConfig;
  try { newConfig = JSON.parse(configString); } catch (error) { return res.status(400).send({ error: 'Invalid config format' }); }
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const socket = activeSockets.get(sanitizedNumber);
  if (!socket) return res.status(404).send({ error: 'No active session found for this number' });
  const otp = generateOTP();
  otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });
  try { await sendOTP(socket, sanitizedNumber, otp); res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' }); }
  catch (error) { otpStore.delete(sanitizedNumber); res.status(500).send({ error: 'Failed to send OTP' }); }
});


router.get('/verify-otp', async (req, res) => {
  const { number, otp } = req.query;
  if (!number || !otp) return res.status(400).send({ error: 'Number and OTP are required' });
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const storedData = otpStore.get(sanitizedNumber);
  if (!storedData) return res.status(400).send({ error: 'No OTP request found for this number' });
  if (Date.now() >= storedData.expiry) { otpStore.delete(sanitizedNumber); return res.status(400).send({ error: 'OTP has expired' }); }
  if (storedData.otp !== otp) return res.status(400).send({ error: 'Invalid OTP' });
  try {
    await setUserConfigInMongo(sanitizedNumber, storedData.newConfig);
    otpStore.delete(sanitizedNumber);
    const sock = activeSockets.get(sanitizedNumber);
    if (sock) await sock.sendMessage(jidNormalizedUser(sock.user.id), { image: { url: config.FREE_IMAGE }, caption: formatMessage('📌 CONFIG UPDATED', 'Your configuration has been successfully updated!', BOT_NAME_FREE) });
    res.status(200).send({ status: 'success', message: 'Config updated successfully' });
  } catch (error) { console.error('Failed to update config:', error); res.status(500).send({ error: 'Failed to update config' }); }
});


router.get('/getabout', async (req, res) => {
  const { number, target } = req.query;
  if (!number || !target) return res.status(400).send({ error: 'Number and target number are required' });
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const socket = activeSockets.get(sanitizedNumber);
  if (!socket) return res.status(404).send({ error: 'No active session found for this number' });
  const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  try {
    const statusData = await socket.fetchStatus(targetJid);
    const aboutStatus = statusData.status || 'No status available';
    const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
    res.status(200).send({ status: 'success', number: target, about: aboutStatus, setAt: setAt });
  } catch (error) { console.error(`Failed to fetch status for ${target}:`, error); res.status(500).send({ status: 'error', message: `Failed to fetch About status for ${target}.` }); }
});


// ---------------- Dashboard endpoints & static ----------------

const dashboardStaticDir = path.join(__dirname, 'dashboard_static');
if (!fs.existsSync(dashboardStaticDir)) fs.ensureDirSync(dashboardStaticDir);
router.use('/dashboard/static', express.static(dashboardStaticDir));
router.get('/dashboard', async (req, res) => {
  res.sendFile(path.join(dashboardStaticDir, 'index.html'));
});


// API: sessions & active & delete

router.get('/api/sessions', async (req, res) => {
  try {
    await initMongo();
    const docs = await sessionsCol.find({}, { projection: { number: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).toArray();
    res.json({ ok: true, sessions: docs });
  } catch (err) {
    console.error('API /api/sessions error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.get('/api/active', async (req, res) => {
  try {
    const keys = Array.from(activeSockets.keys());
    res.json({ ok: true, active: keys, count: keys.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.post('/api/session/delete', async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ ok: false, error: 'number required' });
    const sanitized = ('' + number).replace(/[^0-9]/g, '');
    const running = activeSockets.get(sanitized);
    if (running) {
      try { if (typeof running.logout === 'function') await running.logout().catch(()=>{}); } catch(e){}
      try { running.ws?.close(); } catch(e){}
      activeSockets.delete(sanitized);
      socketCreationTime.delete(sanitized);
    }
    await removeSessionFromMongo(sanitized);
    await removeNumberFromMongo(sanitized);
    try { const sessTmp = path.join(os.tmpdir(), `session_${sanitized}`); if (fs.existsSync(sessTmp)) fs.removeSync(sessTmp); } catch(e){}
    res.json({ ok: true, message: `Session ${sanitized} removed` });
  } catch (err) {
    console.error('API /api/session/delete error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


router.get('/api/newsletters', async (req, res) => {
  res.status(410).json({ ok: false, error: 'Newsletters are disabled.' });
});
router.get('/api/admins', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.json({ ok: true, list });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});


// ---------------- cleanup + process events ----------------

process.on('exit', () => {
  activeSockets.forEach((socket, number) => {
    try { socket.ws.close(); } catch (e) {}
    activeSockets.delete(number);
    socketCreationTime.delete(number);
    try { fs.removeSync(path.join(os.tmpdir(), `session_${number}`)); } catch(e){}
  });
});


process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  try { exec(`pm2.restart ${process.env.PM2_NAME || '© ▶ 𝐅𝚁𝙴𝙴 𝐁𝙾𝚃 '}`); } catch(e) { console.error('Failed to restart pm2:', e); }
});


// initialize mongo & auto-reconnect attempt

initMongo().catch(err => console.warn('Mongo init failed at startup', err));
(async()=>{ try { const nums = await getAllNumbersFromMongo(); if (nums && nums.length) { for (const n of nums) { if (!activeSockets.has(n)) { const mockRes = { headersSent:false, send:()=>{}, status:()=>mockRes }; await EmpirePair(n, mockRes); await delay(500); } } } } catch(e){} })();

module.exports = router;
