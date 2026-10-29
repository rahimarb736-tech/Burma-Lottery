const express = require('express');
const cors = require('cors');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🔥 Bot Token များ
// ==========================================
const SET_BOT_TOKEN = '9197617448:AAEnS3-wmucnZ9jiEPsyNoAMs_AjniNHFEg';
const FINANCE_BOT_TOKEN = '9199518779:AAFgTO22IX6Cb5AU8ui3FIIcV42MPNovBPw';
const USER_BOT_TOKEN = '9092936025:AAGDYORAcX50Z0EjjYTlUXwUOZa-cOaO0tc';

const botSet = new TelegramBot(SET_BOT_TOKEN, {polling: true});
const botFinance = new TelegramBot(FINANCE_BOT_TOKEN, {polling: true});
const botUser = new TelegramBot(USER_BOT_TOKEN, {polling: true});

// ==========================================
// 🔥 Database ဖိုင်ဖြင့် အသေသိမ်းမည့်စနစ်
// ==========================================
const DB_FILE = './db.json';
let DB;

const DEFAULT_DB = {
  users: {},
  settings: { 
      adminChatId: null, 
      autoDraw: { wingo30s: true, wingo1m: true, wingo3m: true, wingo5m: true }, 
      manualNum: { wingo30s: null, wingo1m: null, wingo3m: null, wingo5m: null }, 
      serverActive: true, 
      links: [] 
  },
  currentGame: 'wingo30s',
  games: {
    wingo30s: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 },
    wingo1m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 },
    wingo3m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 },
    wingo5m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 }
  }
};

// ဖိုင်ထဲမှ ဒေတာများကို ဆွဲထုတ်ခြင်း
try {
    if (fs.existsSync(DB_FILE)) {
        DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } else {
        DB = DEFAULT_DB;
    }
} catch (e) {
    DB = DEFAULT_DB;
}

// ဒေတာပြောင်းလဲတိုင်း ဖိုင်ထဲသို့ အသေသိမ်းခြင်း
function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB), 'utf8');
}

function isAdmin(chatId) {
    return DB.settings.adminChatId && chatId.toString() === DB.settings.adminChatId.toString();
}

// ====================================================
// 🔥 Telegram Admin ချိတ်ဆက်ခြင်း
// ====================================================
[botSet, botFinance, botUser].forEach(bot => {
    bot.onText(/\/admin/, (msg) => {
        if (!DB.settings.adminChatId) {
            DB.settings.adminChatId = msg.chat.id.toString();
            saveDB();
            bot.sendMessage(msg.chat.id, `✅ သင်သည် Admin အဖြစ် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။`);
        } else if (isAdmin(msg.chat.id)) {
            bot.sendMessage(msg.chat.id, `✅ သင်သည် လက်ရှိ Admin ဖြစ်ပါသည်။`);
        } else {
            bot.sendMessage(msg.chat.id, `❌ သင့်တွင် အသုံးပြုခွင့် မရှိပါ။`);
        }
    });
});

// ====================================================
// ၁။ Set Bot & Result Bot (ဂဏန်းကြိုတင်သတ်မှတ်ရန်) 
// ====================================================
botSet.onText(/\/set (\w+) (\d)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const game = match[1];
    const num = parseInt(match[2]);

    if(DB.settings.manualNum[game] !== undefined) {
        DB.settings.manualNum[game] = num;
        DB.settings.autoDraw[game] = false;
        saveDB();
        botSet.sendMessage(msg.chat.id, `🎯 ${game} အတွက် ထွက်မည့်ဂဏန်းကို [ ${num} ] ဟု သတ်မှတ်ပြီးပါပြီ။`);
    }
});

// ====================================================
// ၂။ Finance Bot (ငွေစာရင်း) 
// ====================================================
botFinance.onText(/\/(add|sub) (\w+) (\d+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const cmd = match[1];
    const uid = match[2];
    const amount = parseInt(match[3]);

    let userKey = Object.keys(DB.users).find(k => DB.users[k].id === uid);
    if(!userKey) return botFinance.sendMessage(msg.chat.id, `❌ UID: ${uid} ရှာမတွေ့ပါ။`);

    if(cmd === 'add') {
        DB.users[userKey].balance += amount;
        botFinance.sendMessage(msg.chat.id, `✅ ငွေသွင်းအောင်မြင်ပါသည်။\n👤 အမည်: ${DB.users[userKey].name}\n💰 လက်ကျန်ငွေ: ${DB.users[userKey].balance} Ks`);
    } else {
        DB.users[userKey].balance -= amount;
        botFinance.sendMessage(msg.chat.id, `✅ ငွေဖြတ်တောက်မှု အောင်မြင်ပါသည်။\n👤 အမည်: ${DB.users[userKey].name}\n💰 လက်ကျန်ငွေ: ${DB.users[userKey].balance} Ks`);
    }
    saveDB();
});

// ====================================================
// ၃။ User Bot (အချက်အလက် စစ်ဆေးရန်) 
// ====================================================
botUser.onText(/\/check (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const uid = match[1];
    let userKey = Object.keys(DB.users).find(k => DB.users[k].id === uid);
    if(userKey) {
        let u = DB.users[userKey];
        botUser.sendMessage(msg.chat.id, `👤 User အချက်အလက်\n▫️ အမည်: ${u.name}\n▫️ ဖုန်း: ${u.phone}\n▫️ UID: ${u.id}\n▫️ ငွေ: ${u.balance} Ks\n▫️ စကားဝှက်: ${u.pwd}`);
    } else {
        botUser.sendMessage(msg.chat.id, `❌ UID: ${uid} ရှာမတွေ့ပါ။`);
    }
});

// ====================================================
// 🔥 WinGo Game Loop (အချိန်ပြည့်တိုင်း ဂဏန်းအလိုအလျောက်ထွက်ခြင်း)
// ====================================================
const DURATIONS = { wingo30s: 30000, wingo1m: 60000, wingo3m: 180000, wingo5m: 300000 };

setInterval(() => {
    const timeNow = Date.now();
    for (const game in DURATIONS) {
        const dur = DURATIONS[game];
        const currentBlock = Math.floor(timeNow / dur);
        let g = DB.games[game];

        if (g.lastBlock !== currentBlock) {
            if (g.lastBlock !== null && DB.settings.serverActive) {
                drawResult(game, g.lastBlock, dur);
            }
            g.lastBlock = currentBlock;
        }
    }
}, 1000);

function drawResult(game, blockIndex, dur) {
    let d = new Date(blockIndex * dur);
    let periodStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${blockIndex % 10000}`;

    // Admin ကြိုတင်သတ်မှတ်ထားသော ဂဏန်းရှိမရှိ စစ်ဆေးခြင်း
    let winNum = DB.settings.manualNum[game] !== null ? DB.settings.manualNum[game] : Math.floor(Math.random() * 10);

    // Auto ပြန်ပြောင်းပေးခြင်း
    DB.settings.manualNum[game] = null;
    DB.settings.autoDraw[game] = true;

    // History ထဲသို့ ထည့်ခြင်း
    DB.games[game].history.unshift({ period: periodStr, num: winNum });
    if(DB.games[game].history.length > 50) DB.games[game].history.pop();

    // အနိုင်/အရှုံး တွက်ချက်ခြင်း
    let totalBets = 0, totalPayout = 0;
    let activeBets = DB.games[game].bets || [];
    DB.games[game].bets = []; // လောင်းကြေးများကို ရှင်းလင်းမည်

    activeBets.forEach(bet => {
        totalBets += bet.amount;
        let isWin = false;
        let multiplier = 0;

        if (bet.type === 'num' && bet.num === winNum) { isWin = true; multiplier = 9; }
        else if (bet.type === 'big' && winNum >= 5) { isWin = true; multiplier = 2; }
        else if (bet.type === 'small' && winNum < 5) { isWin = true; multiplier = 2; }
        else if (bet.type === 'green' && [1,3,7,9,5].includes(winNum)) { isWin = true; multiplier = (winNum===5)? 1.5 : 2; }
        else if (bet.type === 'red' && [2,4,6,8,0].includes(winNum)) { isWin = true; multiplier = (winNum===0)? 1.5 : 2; }
        else if (bet.type === 'purple' && [0,5].includes(winNum)) { isWin = true; multiplier = 4.5; }

        let payout = isWin ? (bet.amount * multiplier * 0.98) : 0; // ၂% ဝန်ဆောင်ခ နှုတ်မည်
        
        if (isWin) {
            totalPayout += payout;
            if(DB.users[bet.userKey]) DB.users[bet.userKey].balance += payout;
        }

        // ကစားသူ၏ ကိုယ်ပိုင်မှတ်တမ်းသို့ ထည့်ခြင်း
        if(DB.users[bet.userKey]) {
            if(!DB.users[bet.userKey].myBets) DB.users[bet.userKey].myBets = [];
            DB.users[bet.userKey].myBets.unshift({
                period: periodStr, type: bet.type, num: bet.num, amount: bet.amount,
                win: isWin, payout: payout, date: new Date().toLocaleTimeString()
            });
            if(DB.users[bet.userKey].myBets.length > 50) DB.users[bet.userKey].myBets.pop();
        }
    });

    // အမြတ်အစွန်းတွက်ချက်ခြင်း
    let profit = totalBets - totalPayout;
    DB.games[game].currentPeriodProfit = profit;
    DB.games[game].currentPeriodComm = totalBets * 0.02;
    DB.games[game].todayProfit += profit;
    DB.games[game].todayComm += (totalBets * 0.02);

    saveDB(); // တွက်ချက်မှုပြီးတိုင်း ဖိုင်ထဲ သိမ်းမည်

    // 🚀 Telegram Bot (botSet) မှတစ်ဆင့် Admin ထံ ဂဏန်းထွက်ကြောင်း ပို့ပေးခြင်း
    if (DB.settings.adminChatId) {
        let msg = `🎲 <b>WinGo ${game.replace('wingo','')} ရလဒ်</b>\n\n`;
        msg += `ပွဲစဉ်: <code>${periodStr}</code>\n`;
        msg += `ထွက်ဂဏန်း: <b>${winNum}</b>\n`;
        msg += `အကြီး/အသေး: ${winNum >= 5 ? 'အကြီး' : 'အသေး'}\n`;
        msg += `💰 ဤပွဲစဉ် အမြတ်: ${profit.toLocaleString()} Ks`;
        try {
            botSet.sendMessage(DB.settings.adminChatId, msg, {parse_mode: 'HTML'});
        } catch(e) {}
    }
}

// ====================================================
// Express Server API များ
// ====================================================
app.get('/', (req, res) => res.send('WinGo Backend Server is Running!'));

app.get('/api/db', (req, res) => res.json(DB));

app.post('/api/update', (req, res) => {
    const newDB = req.body;
    
    // Admin Chat ID မပျောက်စေရန်
    if(DB.settings.adminChatId && !newDB.settings.adminChatId) {
        newDB.settings.adminChatId = DB.settings.adminChatId;
    }

    // အကောင့်သစ် ဝင်လာပါက Telegram သို့ Alert ပို့ရန်
    if (newDB.users && DB.users && Object.keys(newDB.users).length > Object.keys(DB.users).length) {
        for(let phone in newDB.users) {
            if(!DB.users[phone]) {
                let u = newDB.users[phone];
                try {
                    if (newDB.settings.adminChatId) {
                        botUser.sendMessage(newDB.settings.adminChatId, `🎉 အကောင့်သစ် ဝင်လာပါပြီ\n\n▫️ အမည်: ${u.name}\n▫️ ဖုန်း: ${u.phone}\n▫️ UID: ${u.id}`);
                    }
                } catch(e) {}
            }
        }
    }
    
    DB = newDB;
    saveDB();
    res.send({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
