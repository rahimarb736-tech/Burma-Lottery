const express = require('express');
const cors = require('cors');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🔥 Telegram Bot Token များ 
// ==========================================
const SET_BOT_TOKEN = '9197617448:AAEnS3-wmucnZ9jiEPsyNoAMs_AjniNHFEg';
const FINANCE_BOT_TOKEN = '9199518779:AAFgTO22IX6Cb5AU8ui3FIIcV42MPNovBPw';
const USER_BOT_TOKEN = '9092936025:AAGDYORAcX50Z0EjjYTlUXwUOZa-cOaO0tc';

const botSet = new TelegramBot(SET_BOT_TOKEN, { polling: true });
const botFinance = new TelegramBot(FINANCE_BOT_TOKEN, { polling: true });
const botUser = new TelegramBot(USER_BOT_TOKEN, { polling: true });

const DB_FILE = './db.json';
let DB;

const DEFAULT_DB = {
  users: {},
  settings: { 
      adminChatId: null, 
      kpayPhone: '09756233870', 
      wavePhone: '09961234567',
      autoDraw: { wingo30s: true, wingo1m: true, wingo3m: true, wingo5m: true }, 
      manualNum: { wingo30s: null, wingo1m: null, wingo3m: null, wingo5m: null }, 
      serverActive: true, links: [] 
  },
  transactions: [], 
  currentGame: 'wingo30s',
  games: {
    wingo30s: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 },
    wingo1m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 },
    wingo3m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 },
    wingo5m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 }
  }
};

try {
    if (fs.existsSync(DB_FILE)) {
        DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if(!DB.transactions) DB.transactions = [];
        if(!DB.settings) DB.settings = DEFAULT_DB.settings;
        if(!DB.games) DB.games = DEFAULT_DB.games;
    } else { DB = DEFAULT_DB; }
} catch (e) { DB = DEFAULT_DB; }

function saveDB() { 
    try { fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2), 'utf8'); } catch(e) {} 
}
function isAdmin(chatId) { return DB.settings.adminChatId && chatId.toString() === DB.settings.adminChatId.toString(); }

[botSet, botFinance, botUser].forEach(bot => {
    bot.onText(/\/admin/, (msg) => {
        DB.settings.adminChatId = msg.chat.id.toString(); saveDB();
        bot.sendMessage(msg.chat.id, `✅ Admin အဖြစ် ချိတ်ဆက်ပြီးပါပြီ။`);
    });
});

botSet.onText(/\/set (\w+) (\d)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const game = match[1]; const num = parseInt(match[2]);
    if(DB.settings.manualNum[game] !== undefined) {
        DB.settings.manualNum[game] = num; DB.settings.autoDraw[game] = false; saveDB();
        botSet.sendMessage(msg.chat.id, `🎯 ${game} အတွက် ဂဏန်း [ ${num} ] သတ်မှတ်ပြီးပါပြီ။`);
    }
});

// 🔥 KBZ Pay နံပါတ်ပြောင်းရန်
botSet.onText(/\/setkpay (.+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const newPhone = match[1].trim();
    DB.settings.kpayPhone = newPhone;
    saveDB();
    botSet.sendMessage(msg.chat.id, `✅ KBZ Pay နံပါတ်ကို [ ${newPhone} ] သို့ ပြောင်းလဲပြီးပါပြီ။`);
});

// 🔥 Wave Money နံပါတ်ပြောင်းရန်
botSet.onText(/\/setwave (.+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const newPhone = match[1].trim();
    DB.settings.wavePhone = newPhone;
    saveDB();
    botSet.sendMessage(msg.chat.id, `✅ Wave Money နံပါတ်ကို [ ${newPhone} ] သို့ ပြောင်းလဲပြီးပါပြီ။`);
});

// 🔥 ဆက်သွယ်ရန် Link ထည့်ရန်
botSet.onText(/\/addlink (\w+) (.+) (.+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const type = match[1].toLowerCase(); 
    const label = match[2];
    const url = match[3];
    if(!DB.settings.links) DB.settings.links = [];
    DB.settings.links.push({ type, label, url });
    saveDB();
    botSet.sendMessage(msg.chat.id, `✅ ဆက်သွယ်ရန် Link ထည့်ပြီးပါပြီ (${type.toUpperCase()}): ${label}`);
});

botSet.onText(/\/listlinks/, (msg) => {
    if(!isAdmin(msg.chat.id)) return;
    if(!DB.settings.links || DB.settings.links.length === 0) return botSet.sendMessage(msg.chat.id, `❌ Link မရှိသေးပါ။`);
    let text = `📋 <b>Link များ:</b>\n\n`;
    DB.settings.links.forEach((l, idx) => { text += `${idx + 1}. [${l.type.toUpperCase()}] ${l.label}\n🔗 ${l.url}\n\n`; });
    botSet.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

botSet.onText(/\/dellink (\d+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const index = parseInt(match[1]) - 1;
    if(!DB.settings.links || !DB.settings.links[index]) return botSet.sendMessage(msg.chat.id, `❌ မတွေ့ပါ။`);
    let removed = DB.settings.links.splice(index, 1);
    saveDB();
    botSet.sendMessage(msg.chat.id, `🗑️ [${removed[0].label}] ကို ဖျက်လိုက်ပါပြီ။`);
});

// 🔥 ငွေသွင်း အတည်ပြုခြင်း
botFinance.onText(/\/add (\w+) (\d+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const uid = match[1]; const amount = parseInt(match[2]);
    let userKey = Object.keys(DB.users).find(k => DB.users[k].id === uid);
    if(!userKey) return botFinance.sendMessage(msg.chat.id, `❌ UID: ${uid} ရှာမတွေ့ပါ။`);

    let finalAmount = amount === 5000 ? 5250 : amount;
    DB.users[userKey].balance += finalAmount;

    let pendingDep = DB.transactions.find(t => t.uid === uid && t.type === 'deposit' && t.status === 'pending');
    if(pendingDep) pendingDep.status = 'approved';

    saveDB();
    botFinance.sendMessage(msg.chat.id, `✅ ငွေသွင်းပြီး။ UID: ${uid} | ပမာဏ: ${finalAmount.toLocaleString()} Ks | လက်ကျန်: ${DB.users[userKey].balance.toLocaleString()} Ks`);
});

// 🔥 ငွေထုတ် အတည်ပြုခြင်း
botFinance.onText(/\/wdok (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const uid = match[1];
    let pendingWd = DB.transactions.find(t => t.uid === uid && t.type === 'withdraw' && t.status === 'pending');
    if(pendingWd) {
        pendingWd.status = 'approved'; 
        saveDB();
        botFinance.sendMessage(msg.chat.id, `✅ UID: ${uid} ငွေထုတ်မှုကို အတည်ပြု (Approved) ပြီးပါပြီ။`);
    } else botFinance.sendMessage(msg.chat.id, `❌ UID: ${uid} တွင် စောင့်ဆိုင်းနေသော ငွေထုတ်တောင်းဆိုမှု မရှိပါ။`);
});

// 🔥 ငွေထုတ် ပယ်ဖျက်ခြင်း (Refund)
botFinance.onText(/\/wdno (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const uid = match[1];
    let pendingWd = DB.transactions.find(t => t.uid === uid && t.type === 'withdraw' && t.status === 'pending');
    if(pendingWd) {
        pendingWd.status = 'rejected';
        let userKey = Object.keys(DB.users).find(k => DB.users[k].id === uid);
        if(userKey) DB.users[userKey].balance += pendingWd.amount;
        saveDB();
        botFinance.sendMessage(msg.chat.id, `🚫 UID: ${uid} ငွေထုတ်မှု ပယ်ဖျက်ပြီး ငွေပြန်အမ်းပေးလိုက်ပါပြီ။`);
    } else botFinance.sendMessage(msg.chat.id, `❌ မတွေ့ပါ။`);
});

// Game Loop
const DURATIONS = { wingo30s: 30000, wingo1m: 60000, wingo3m: 180000, wingo5m: 300000 };
setInterval(() => {
    const timeNow = Date.now();
    for (const game in DURATIONS) {
        const dur = DURATIONS[game]; const currentBlock = Math.floor(timeNow / dur); let g = DB.games[game];
        if (g.lastBlock !== currentBlock) {
            if (g.lastBlock !== null && DB.settings.serverActive) drawResult(game, g.lastBlock, dur);
            g.lastBlock = currentBlock;
        }
    }
}, 1000);

function drawResult(game, blockIndex, dur) {
    let d = new Date(blockIndex * dur);
    let periodStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${blockIndex % 10000}`;
    let winNum = DB.settings.manualNum[game] !== null ? DB.settings.manualNum[game] : Math.floor(Math.random() * 10);
    DB.settings.manualNum[game] = null; DB.settings.autoDraw[game] = true;

    DB.games[game].history.unshift({ period: periodStr, num: winNum });
    if(DB.games[game].history.length > 100) DB.games[game].history.pop();

    let totalBets = 0, totalPayout = 0; let activeBets = DB.games[game].bets || []; DB.games[game].bets = [];
    activeBets.forEach(bet => {
        totalBets += bet.amount; let isWin = false; let multiplier = 0;
        if (bet.type === 'num' && bet.num === winNum) { isWin = true; multiplier = 9; }
        else if (bet.type === 'big' && winNum >= 5) { isWin = true; multiplier = 2; }
        else if (bet.type === 'small' && winNum < 5) { isWin = true; multiplier = 2; }
        else if (bet.type === 'green' && [1,3,7,9,5].includes(winNum)) { isWin = true; multiplier = (winNum===5)? 1.5 : 2; }
        else if (bet.type === 'red' && [2,4,6,8,0].includes(winNum)) { isWin = true; multiplier = (winNum===0)? 1.5 : 2; }
        else if (bet.type === 'purple' && [0,5].includes(winNum)) { isWin = true; multiplier = 4.5; }

        let payout = isWin ? (bet.amount * multiplier * 0.98) : 0;
        if (isWin) { totalPayout += payout; if(DB.users[bet.userKey]) DB.users[bet.userKey].balance += payout; }
        
        if(DB.users[bet.userKey]) {
            if(!DB.users[bet.userKey].myBets) DB.users[bet.userKey].myBets = [];
            DB.users[bet.userKey].myBets.unshift({ period: periodStr, type: bet.type, num: bet.num, amount: bet.amount, win: isWin, payout: payout, date: new Date().toLocaleTimeString() });
            if(DB.users[bet.userKey].myBets.length > 50) DB.users[bet.userKey].myBets.pop();
        }
    });

    let profit = totalBets - totalPayout;
    DB.games[game].currentPeriodProfit = profit; DB.games[game].currentPeriodComm = totalBets * 0.02;
    DB.games[game].todayProfit += profit; DB.games[game].todayComm += (totalBets * 0.02);
    saveDB();
    
    if (DB.settings.adminChatId) {
        let msg = `🎲 WinGo ${game.replace('wingo','')} ရလဒ်\nပွဲစဉ်: ${periodStr}\nထွက်ဂဏန်း: ${winNum} (${winNum >= 5 ? 'အကြီး' : 'အသေး'})\nအမြတ်: ${profit.toLocaleString()} Ks`;
        try { botSet.sendMessage(DB.settings.adminChatId, msg); } catch(e) {}
    }
}

app.get('/', (req, res) => res.send('Server is running'));
app.get('/api/db', (req, res) => res.json(DB));

app.post('/api/update', (req, res) => {
    const newDB = req.body;
    if(DB.settings.adminChatId && !newDB.settings.adminChatId) newDB.settings.adminChatId = DB.settings.adminChatId;

    if (newDB.transactions && newDB.transactions.length > (DB.transactions ? DB.transactions.length : 0)) {
        let latestTx = newDB.transactions[newDB.transactions.length - 1];
        if (DB.settings.adminChatId) {
            if(latestTx.type === 'deposit') {
                let msg = `💰 <b>ငွေသွင်းရန် တောင်းဆိုမှု ရောက်ရှိလာပါပြီ</b>\n\n▫️ UID: <b>${latestTx.uid}</b>\n▫️ ငွေပေးချေမှု: <b>${latestTx.method}</b>\n▫️ ပမာဏ: <b>${latestTx.amount.toLocaleString()} Ks</b>\n`;
                if(latestTx.amount === 5000) msg += `🎁 ဘောနပ်စ်ပါဝင်သည် (+250 Ks)\n`;
                msg += `\nအတည်ပြုရန် ဤစာကို Copy ကူး၍ ပို့ပါ👇\n<code>/add ${latestTx.uid} ${latestTx.amount}</code>`;
                try { botFinance.sendMessage(DB.settings.adminChatId, msg, { parse_mode: 'HTML' }); } catch(e){}
            } else if(latestTx.type === 'withdraw') {
                let msg = `💸 <b>ငွေထုတ်ရန် တောင်းဆိုမှု ရောက်ရှိလာပါပြီ</b>\n\n▫️ UID: <b>${latestTx.uid}</b>\n▫️ ထုတ်မည့်ပမာဏ: <b>${latestTx.amount.toLocaleString()} Ks</b>\n▫️ ငွေလက်ခံမည့်စနစ်: <b>${latestTx.method}</b>\n▫️ အကောင့်အမည်: <b>${latestTx.accName}</b>\n▫️ ဖုန်းနံပါတ်: <b>${latestTx.accPhone}</b>\n\n`;
                msg += `အတည်ပြုရန်👇\n<code>/wdok ${latestTx.uid}</code>\nပယ်ဖျက်ရန်👇\n<code>/wdno ${latestTx.uid}</code>`;
                try { botFinance.sendMessage(DB.settings.adminChatId, msg, { parse_mode: 'HTML' }); } catch(e){}
            }
        }
    }

    if (newDB.users) {
        for (let phone in newDB.users) {
            if (DB.users[phone]) {
                newDB.users[phone].balance = DB.users[phone].balance;
                newDB.users[phone].myBets = DB.users[phone].myBets || newDB.users[phone].myBets;
            }
        }
    }
    newDB.games = DB.games;
    DB = newDB; 
    saveDB(); 
    res.send({ success: true });
});

app.post('/api/bet', (req, res) => {
    const { phone, gameKey, betType, betNum, amount } = req.body;
    if (!DB.users[phone]) return res.status(400).json({ success: false, message: 'User not found' });
    if (DB.users[phone].balance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    DB.users[phone].balance -= amount;
    DB.games[gameKey].bets.push({ userKey: phone, type: betType, num: betNum, amount: amount });
    saveDB();

    res.json({ success: true, newBalance: DB.users[phone].balance });
});

app.listen(process.env.PORT || 3000, () => console.log('Server is running perfectly!'));
