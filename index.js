const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', true);

// 🛡️ 3. API Spam / DDoS Attack ကာကွယ်ရန် (Custom Rate Limiter)
// Package အသစ်သွင်းစရာမလိုဘဲ IP တစ်ခုမှ ၁ မိနစ်အတွင်း Request အခါ ၁၀၀ ထက်ပိုခေါ်လျှင် Block ပါမည်။
const rateLimitMap = new Map();
function apiLimiter(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
    const timestamps = rateLimitMap.get(ip).filter(t => now - t < 60000); 
    if (timestamps.length >= 100) { 
        return res.status(429).json({ success: false, msg: "လုပ်ဆောင်ချက်များလွန်းပါသည်။ ခဏစောင့်ပါ။" });
    }
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);
    next();
}
app.use('/api', apiLimiter); 

const FIREBASE_URL = 'https://burmalottery-68256-default-rtdb.asia-southeast1.firebasedatabase.app/db.json';

const SET_BOT_TOKEN = process.env.SET_BOT_TOKEN || '9197617448:AAEnS3-wmucnZ9jiEPsyNoAMs_AjniNHFEg';
const FINANCE_BOT_TOKEN = process.env.FINANCE_BOT_TOKEN || '9199518779:AAFgTO22IX6Cb5AU8ui3FIIcV42MPNovBPw';
const USER_BOT_TOKEN = process.env.USER_BOT_TOKEN || '9092936025:AAGDYORAcX50Z0EjjYTlUXwUOZa-cOaO0tc';
const BOT_ADMIN_PWD = process.env.BOT_ADMIN_PWD || 'wingo2024';

const botSet = new TelegramBot(SET_BOT_TOKEN, { polling: true });
botSet.on('polling_error', () => {}); 

const botFinance = new TelegramBot(FINANCE_BOT_TOKEN, { polling: true });
botFinance.on('polling_error', () => {}); 

const botUser = new TelegramBot(USER_BOT_TOKEN, { polling: true });
botUser.on('polling_error', () => {}); 

let DB;
const DEFAULT_DB = {
    users: {}, 
    settings: { adminChatId: null, kpayPhone: '09xxxxxxxxx', wavePhone: '09xxxxxxxxx', autoDraw: { wingo30s: true, wingo1m: true, wingo3m: true, wingo5m: true }, manualNum: { wingo30s: null, wingo1m: null, wingo3m: null, wingo5m: null }, serverActive: true, links: [] },
    transactions: [],
    currentGame: 'wingo30s',
    games: {
        wingo30s: { bets: [], history: [], lastBlock: null, isAutoDrawn: false, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0, totalProfit: 0 },
        wingo1m: { bets: [], history: [], lastBlock: null, isAutoDrawn: false, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0, totalProfit: 0 },
        wingo3m: { bets: [], history: [], lastBlock: null, isAutoDrawn: false, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0, totalProfit: 0 },
        wingo5m: { bets: [], history: [], lastBlock: null, isAutoDrawn: false, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0, totalProfit: 0 }
    },
    lastResetDate: new Date().toLocaleDateString()
};

async function loadDB() {
    try {
        const res = await fetch(FIREBASE_URL);
        const data = await res.json();
        if (data && data.settings) {
            DB = data;
            if (!DB.settings.manualNum) DB.settings.manualNum = { wingo30s: null, wingo1m: null, wingo3m: null, wingo5m: null };
            if (!DB.settings.autoDraw) DB.settings.autoDraw = { wingo30s: true, wingo1m: true, wingo3m: true, wingo5m: true };
            if (!DB.settings.links) DB.settings.links = [];
            
            if(!DB.transactions) DB.transactions = [];
            for (let g in DB.games) {
                if (DB.games[g].totalProfit === undefined) DB.games[g].totalProfit = 0;
                if (DB.games[g].isAutoDrawn === undefined) DB.games[g].isAutoDrawn = false;
            }
            if(!DB.lastResetDate) DB.lastResetDate = new Date().toLocaleDateString();
        } else {
            DB = JSON.parse(JSON.stringify(DEFAULT_DB));
            saveDB();
        }
    } catch (e) {
        console.error("Firebase connection error. Retrying in 5 seconds...");
        setTimeout(loadDB, 5000);
    }
}

async function saveDB() {
    if (!DB) return;
    try {
        await fetch(FIREBASE_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DB) });
    } catch (e) { }
}

function isAdmin(chatId) { return DB.settings.adminChatId && chatId.toString() === DB.settings.adminChatId.toString(); }

loadDB();

botSet.onText(/\/admin (.+)/, (msg, match) => { 
    if(match[1] !== BOT_ADMIN_PWD) return botSet.sendMessage(msg.chat.id, `❌ စကားဝှက် မှားယွင်းနေပါသည်။`);
    DB.settings.adminChatId = msg.chat.id.toString(); saveDB(); 
    botSet.sendMessage(msg.chat.id, `✅ Set Bot မှ Admin အဖြစ် ချိတ်ဆက်ပြီးပါပြီ။`); 
});
botSet.onText(/\/set (30s|1m|3m|5m) (\d)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    let input = match[1]; const num = parseInt(match[2]);
    let game = input === '30s' ? 'wingo30s' : input === '1m' ? 'wingo1m' : input === '3m' ? 'wingo3m' : 'wingo5m';
    if (num >= 0 && num <= 9) {
        DB.settings.manualNum[game] = num; DB.settings.autoDraw[game] = false; saveDB();
        botSet.sendMessage(msg.chat.id, `🎯 ${input} အတွက် ဂဏန်း [ ${num} ] အား ကြိုတင်သတ်မှတ်ပြီးပါပြီ။`);
    }
});
botSet.onText(/\/profit(.*)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const type = match[1].trim().toLowerCase();
    let report = `💰 <b>အမြတ်အစွန်း စာရင်း</b>\n\n`;
    let todayTot = 0, allTot = 0;
    for (let k in DB.games) {
        let n = k.replace('wingo', '');
        if (type === 'all') { report += `▫️ ${n}: <b>${(DB.games[k].totalProfit || 0).toLocaleString()} Ks</b>\n`; allTot += (DB.games[k].totalProfit || 0); }
        else { report += `▫️ ${n} (ယနေ့): <b>${(DB.games[k].todayProfit || 0).toLocaleString()} Ks</b>\n`; todayTot += (DB.games[k].todayProfit || 0); }
    }
    report += type === 'all' ? `\n✅ <b>စုစုပေါင်းအမြတ်: ${allTot.toLocaleString()} Ks</b>` : `\n✅ <b>ယနေ့စုစုပေါင်းအမြတ်: ${todayTot.toLocaleString()} Ks</b>\n\n<i>(/profit all ဟုရိုက်ကြည့်ပါ)</i>`;
    botSet.sendMessage(msg.chat.id, report, {parse_mode: 'HTML'});
});

botFinance.onText(/\/admin (.+)/, (msg, match) => { 
    if(match[1] !== BOT_ADMIN_PWD) return botFinance.sendMessage(msg.chat.id, `❌ စကားဝှက် မှားယွင်းနေပါသည်။`);
    botFinance.sendMessage(msg.chat.id, `✅ Finance Bot ချိတ်ဆက်ပြီးပါပြီ။`); 
});
botFinance.onText(/\/(add|sub) (\w+) (\d+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const cmd = match[1], uid = match[2], amt = parseInt(match[3]);
    let uKey = Object.keys(DB.users).find(k => DB.users[k].id === uid);
    if(!uKey) return botFinance.sendMessage(msg.chat.id, `❌ UID: ${uid} မတွေ့ပါ။`);
    if (amt <= 0 || isNaN(amt)) return botFinance.sendMessage(msg.chat.id, `❌ ပမာဏ မှားယွင်းနေပါသည်။`);
    if(cmd === 'add') {
        DB.users[uKey].balance += amt;
        let p = DB.transactions.find(t => t.uid === uid && t.type === 'deposit' && t.status === 'pending');
        if(p) p.status = 'approved';
        botFinance.sendMessage(msg.chat.id, `✅ ငွေသွင်းပြီးပါပြီ။ UID: ${uid} | လက်ကျန်: ${DB.users[uKey].balance.toLocaleString()} Ks`);
    } else {
        if (DB.users[uKey].balance < amt) return botFinance.sendMessage(msg.chat.id, `❌ User လက်ကျန်မလောက်ပါ။`);
        DB.users[uKey].balance -= amt;
        botFinance.sendMessage(msg.chat.id, `✅ ငွေဖြတ်ပြီးပါပြီ။ UID: ${uid}`);
    }
    saveDB();
});
botFinance.onText(/\/depno (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    const uid = match[1];
    let p = DB.transactions.find(t => t.uid === uid && t.type === 'deposit' && t.status === 'pending');
    if(p) { p.status = 'rejected'; saveDB(); botFinance.sendMessage(msg.chat.id, `🚫 UID: ${uid} ၏ ငွေသွင်းတောင်းဆိုမှုကို ပယ်ဖျက် (Rejected) လိုက်ပါပြီ။`); } 
    else { botFinance.sendMessage(msg.chat.id, `❌ UID: ${uid} တွင် စောင့်ဆိုင်းနေသော ငွေသွင်းတောင်းဆိုမှု မရှိပါ။`); }
});
botFinance.onText(/\/wdok (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    let p = DB.transactions.find(t => t.uid === match[1] && t.type === 'withdraw' && t.status === 'pending');
    if(p) { p.status = 'approved'; saveDB(); botFinance.sendMessage(msg.chat.id, `✅ ငွေထုတ် အတည်ပြုပြီးပါပြီ။`); }
});
botFinance.onText(/\/wdno (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return;
    let p = DB.transactions.find(t => t.uid === match[1] && t.type === 'withdraw' && t.status === 'pending');
    if(p) { p.status = 'rejected'; let u = Object.keys(DB.users).find(k => DB.users[k].id === match[1]); if(u) DB.users[u].balance += p.amount; saveDB(); botFinance.sendMessage(msg.chat.id, `🚫 ငွေထုတ်ပယ်ဖျက်ပြီး Refund ပြန်ပေးလိုက်ပါပြီ။`); }
});

botUser.onText(/\/admin (.+)/, (msg, match) => { 
    if(match[1] !== BOT_ADMIN_PWD) return botUser.sendMessage(msg.chat.id, `❌ စကားဝှက် မှားယွင်းနေပါသည်။`);
    DB.settings.adminChatId = msg.chat.id.toString(); saveDB(); 
    botUser.sendMessage(msg.chat.id, `✅ User Bot မှ Admin အဖြစ် ချိတ်ဆက်ပြီးပါပြီ။`); 
});
botUser.onText(/\/check (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return botUser.sendMessage(msg.chat.id, `❌ Admin ခွင့်ပြုချက်မရှိပါ။`);
    const uid = match[1]; let userKey = Object.keys(DB.users).find(k => DB.users[k].id === uid || k === uid);
    if(userKey) { let u = DB.users[userKey]; botUser.sendMessage(msg.chat.id, `👤 အမည်: ${u.name}\nUID: ${u.id}\nဖုန်း: ${u.phone}\nငွေ: ${u.balance.toLocaleString()} Ks\nစကားဝှက်: ${u.pwd}`); } 
    else { botUser.sendMessage(msg.chat.id, `❌ UID: ${uid} ကို ရှာမတွေ့ပါ။`); }
});
botUser.onText(/\/users/, (msg) => {
    if(!isAdmin(msg.chat.id)) return botUser.sendMessage(msg.chat.id, `❌ Admin ခွင့်ပြုချက်မရှိပါ။`);
    botUser.sendMessage(msg.chat.id, `👥 စုစုပေါင်း User: <b>${Object.keys(DB.users).length}</b> ယောက်`, {parse_mode: 'HTML'});
});

const DURATIONS = { wingo30s: 30000, wingo1m: 60000, wingo3m: 180000, wingo5m: 300000 };

setInterval(() => {
    if (!DB) return;
    const timeNow = Date.now();
    let dStr = new Date().toLocaleDateString();
    if (DB.lastResetDate !== dStr) {
        for(let g in DB.games) { DB.games[g].todayProfit = 0; DB.games[g].todayComm = 0; }
        DB.lastResetDate = dStr; saveDB();
    }

    for (const game in DURATIONS) {
        const dur = DURATIONS[game]; const currentBlock = Math.floor(timeNow / dur); let g = DB.games[game];
        const rem = dur - (timeNow % dur);
        
        if (rem <= 5000 && !g.isAutoDrawn && g.bets.length > 0 && DB.settings.manualNum[game] === null) {
            if (DB.settings.autoDraw[game]) {
                let possibleLosses = Array(10).fill(0);
                g.bets.forEach(b => {
                    for (let i = 0; i <= 9; i++) {
                        let win = false, mul = 0;
                        if (b.type === 'num' && b.num === i) { win = true; mul = 9; }
                        else if (b.type === 'big' && i >= 5) { win = true; mul = 2; }
                        else if (b.type === 'small' && i < 5) { win = true; mul = 2; }
                        else if (b.type === 'green' && [1,3,7,9,5].includes(i)) { win = true; mul = (i===5)? 1.5 : 2; }
                        else if (b.type === 'red' && [2,4,6,8,0].includes(i)) { win = true; mul = (i===0)? 1.5 : 2; }
                        else if (b.type === 'purple' && [0,5].includes(i)) { win = true; mul = 4.5; }
                        if (win) possibleLosses[i] += (b.amount * mul * 0.98);
                    }
                });
                let minLoss = Math.min(...possibleLosses);
                let bestNums = [];
                for(let i=0; i<=9; i++) if(possibleLosses[i] === minLoss) bestNums.push(i);
                DB.settings.manualNum[game] = bestNums[Math.floor(Math.random() * bestNums.length)];
            }
            g.isAutoDrawn = true;
        }

        if (g.lastBlock !== currentBlock) {
            if (g.lastBlock !== null && DB.settings.serverActive) drawResult(game, g.lastBlock, dur);
            g.lastBlock = currentBlock;
            g.isAutoDrawn = false;
        }
    }
}, 1000);

function drawResult(game, blockIndex, dur) {
    if (!DB) return;
    let d = new Date(blockIndex * dur);
    let periodStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${blockIndex % 10000}`;
    
    let winNum = DB.settings.manualNum[game] !== null ? DB.settings.manualNum[game] : Math.floor(Math.random() * 10);
    DB.settings.manualNum[game] = null; 
    
    DB.games[game].history.unshift({ period: periodStr, num: winNum });
    if(DB.games[game].history.length > 100) DB.games[game].history.pop();

    let totalBets = 0, totalPayout = 0; 
    let activeBets = DB.games[game].bets || []; DB.games[game].bets = [];
    
    activeBets.forEach(bet => {
        totalBets += bet.amount; let win = false, mul = 0;
        if (bet.type === 'num' && bet.num === winNum) { win = true; mul = 9; }
        else if (bet.type === 'big' && winNum >= 5) { win = true; mul = 2; }
        else if (bet.type === 'small' && winNum < 5) { win = true; mul = 2; }
        else if (bet.type === 'green' && [1,3,7,9,5].includes(winNum)) { win = true; mul = (winNum===5)? 1.5 : 2; }
        else if (bet.type === 'red' && [2,4,6,8,0].includes(winNum)) { win = true; mul = (winNum===0)? 1.5 : 2; }
        else if (bet.type === 'purple' && [0,5].includes(winNum)) { win = true; mul = 4.5; }

        let payout = win ? (bet.amount * mul * 0.98) : 0;
        if (win) { totalPayout += payout; if(DB.users[bet.userKey]) DB.users[bet.userKey].balance += payout; }
        
        if(DB.users[bet.userKey]) {
            if(!DB.users[bet.userKey].myBets) DB.users[bet.userKey].myBets = [];
            DB.users[bet.userKey].myBets.unshift({ period: periodStr, type: bet.type, num: bet.num, amount: bet.amount, win: win, payout: payout, date: new Date().toLocaleTimeString() });
            if(DB.users[bet.userKey].myBets.length > 50) DB.users[bet.userKey].myBets.pop();
        }
    });

    let profit = totalBets - totalPayout;
    DB.games[game].currentPeriodProfit = profit; DB.games[game].currentPeriodComm = totalBets * 0.02;
    DB.games[game].todayProfit += profit; DB.games[game].todayComm += (totalBets * 0.02);
    DB.games[game].totalProfit = (DB.games[game].totalProfit || 0) + profit;
    saveDB();
    
    if (DB.settings.adminChatId) {
        try { botSet.sendMessage(DB.settings.adminChatId, `🎲 WinGo ${game.replace('wingo','')}\nပွဲစဉ်: ${periodStr}\nထွက်ဂဏန်း: ${winNum}\nအမြတ်: ${profit.toLocaleString()} Ks`); } catch(e) {}
    }
}

app.get('/', (req, res) => res.send('Server Running securely'));

app.get('/api/sync', (req, res) => {
    if (!DB) return res.json({ settings: {}, games: {}, user: null, transactions: [], sessionValid: false });
    let phone = req.query.phone;
    let sessionId = req.query.sessionId;
    
    let adminUser = DB.users['admin'];
    let isAdminReq = (phone === 'admin' || phone === 'Asrissrk') && adminUser && adminUser.sessionId === sessionId;
    
    // 🛡️ 2. Time Sync အတွက် serverTime ထည့်ပေးလိုက်ခြင်း
    let state = { settings: DB.settings, games: {}, user: null, transactions: [], sessionValid: true, serverTime: Date.now() };
    
    if (phone && DB.users[phone]) {
        if (DB.users[phone].sessionId && DB.users[phone].sessionId !== sessionId) {
            state.sessionValid = false;
        } else {
            state.user = { ...DB.users[phone] };
            delete state.user.pwd; 
            state.transactions = DB.transactions.filter(t => t.uid === state.user.id);
        }
    }
    
    if (isAdminReq) {
        let safeUsers = {};
        for (let u in DB.users) {
            safeUsers[u] = { ...DB.users[u] };
            delete safeUsers[u].pwd; 
        }
        state.users = safeUsers;
        state.transactions = DB.transactions;
    }

    for(let g in DB.games) {
        state.games[g] = { history: DB.games[g].history };
        if (isAdminReq) {
            state.games[g].bets = DB.games[g].bets;
            state.games[g].todayProfit = DB.games[g].todayProfit;
            state.games[g].todayComm = DB.games[g].todayComm;
            state.games[g].totalProfit = DB.games[g].totalProfit;
        }
    }
    res.json(state);
});

app.post('/api/auth', (req, res) => {
    if (!DB) return res.json({success: false, msg: "Database Loading..."});
    const { action, phone, pwd, name, inviteCode, sessionId } = req.body;
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown IP';
    
    if (!phone || typeof phone !== 'string' || phone.length > 20) return res.json({success: false, msg: "ဖုန်းနံပါတ် အမှား"});
    if (!pwd || typeof pwd !== 'string') return res.json({success: false, msg: "စကားဝှက် အမှား"});

    if (action === 'login') {
        if(phone === 'Asrissrk' && pwd === 'alihusainandrahimar') {
            if(!DB.users['admin']) DB.users['admin'] = { id: 'Admin', phone: 'Asrissrk', name: 'Super Admin', pwd, balance: 999999, isAdmin: true, sessionId: sessionId };
            else DB.users['admin'].sessionId = sessionId;
            saveDB(); return res.json({ success: true, phone: 'admin' });
        }
        let uKey = Object.keys(DB.users).find(k => k === phone || DB.users[k].id === phone);
        if(uKey && DB.users[uKey].pwd === pwd) {
            DB.users[uKey].sessionId = sessionId; 
            saveDB();
            return res.json({ success: true, phone: uKey });
        }
        return res.json({ success: false, msg: "အချက်အလက် မှားယွင်းနေပါသည်" });
    }
    
    if (action === 'register') {
        if(DB.users[phone]) return res.json({ success: false, msg: "အကောင့်ရှိပြီးသားပါ" });
        if (!/^09\d{7,9}$/.test(phone)) return res.json({success: false, msg: "မြန်မာဖုန်းနံပါတ် အမှန်ဖြည့်ပါ"});
        
        let isExistingIp = Object.values(DB.users).some(u => u.ip === ip);
        let bal = 0;
        if(inviteCode) {
            let inviter = Object.keys(DB.users).find(k => DB.users[k].id === inviteCode);
            if(inviter) { 
                if (isExistingIp) {
                     console.log(`[Anti-Cheat] IP ${ip} tried to claim bonus again.`);
                } else {
                     DB.users[inviter].balance += 1999; bal = 1999; 
                }
            } else {
                return res.json({ success: false, msg: "ဖိတ်ခေါ်ကုဒ် မှားယွင်းနေပါသည်" });
            }
        }
        
        let newId = Math.floor(10000 + Math.random() * 90000).toString();
        DB.users[phone] = { id: newId, phone, name: String(name).substring(0, 20), pwd, balance: bal, isAdmin: false, ip: ip, sessionId: sessionId };
        
        if(DB.settings.adminChatId) {
            try{ botUser.sendMessage(DB.settings.adminChatId, `🎉 အကောင့်သစ်: ${name} (${newId})\nIP: ${ip}${isExistingIp ? ' ⚠️ (IP ထပ်နေပါသည်)' : ''}`); }catch(e){}
        }
        saveDB(); return res.json({ success: true, phone: phone });
    }
});

app.post('/api/bet', (req, res) => {
    if (!DB) return res.json({success: false, msg: "Database Error"});
    const { phone, game, type, num, amount, sessionId } = req.body;
    if(!DB.settings.serverActive) return res.json({success: false, msg: "Server ပိတ်ထားပါသည်"});
    
    if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) return res.json({success: false, msg: "ပမာဏ မှားယွင်းနေပါသည်"});

    let user = DB.users[phone];
    if(!user) return res.json({success: false, msg: "User မတွေ့ပါ"});
    if(user.sessionId && user.sessionId !== sessionId) return res.json({success: false, msg: "အခြားဖုန်းမှ အကောင့်ဝင်ရောက်ထားပါသည်", forceLogout: true}); 
    
    const rem = DURATIONS[game] - (Date.now() % DURATIONS[game]);
    if(rem < 5000) return res.json({success: false, msg: "ပွဲပိတ်ထားပါပြီ။"});
    if(user.balance < amount) return res.json({success: false, msg: "လက်ကျန်ငွေ မလုံလောက်ပါ"});

    user.balance -= amount;
    DB.games[game].bets.push({ userKey: phone, type, num, amount });
    saveDB();
    res.json({success: true, balance: user.balance});
});

app.post('/api/finance', (req, res) => {
    if (!DB) return res.json({success: false});
    const { type, phone, method, amount, txId, accName, accPhone, sessionId } = req.body;
    
    if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) return res.json({success: false, msg: "ပမာဏ မှားယွင်းနေပါသည်"});

    let user = DB.users[phone];
    if(!user) return res.json({success: false});
    if(user.sessionId && user.sessionId !== sessionId) return res.json({success: false, msg: "အခြားဖုန်းမှ အကောင့်ဝင်ရောက်ထားပါသည်", forceLogout: true});
    
    let dStr = `${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}`;
    let tid = `${type === 'deposit' ? 'DP' : 'WD'}-${dStr}-${Math.floor(1000+Math.random()*9000)}`;
    
    if(type === 'withdraw') {
        if(user.balance < amount) return res.json({success: false, msg: "လက်ကျန်မလုံလောက်ပါ"});
        user.balance -= amount;
        DB.transactions.push({ id: tid, uid: user.id, type, method, amount, accName: String(accName).substring(0, 30), accPhone: String(accPhone).substring(0, 20), status: 'pending', date: new Date().toLocaleString() });
        if(DB.settings.adminChatId) {
            let msg = `💸 <b>ငွေထုတ်ရန် တောင်းဆိုမှု</b>\n▫️ UID: <b>${user.id}</b>\n▫️ ပမာဏ: ${amount.toLocaleString()} Ks\n\nအတည်ပြုရန်: <code>/wdok ${user.id}</code>\nပယ်ဖျက်ရန်: <code>/wdno ${user.id}</code>`;
            try{ botFinance.sendMessage(DB.settings.adminChatId, msg, {parse_mode: 'HTML'}); }catch(e){}
        }
    } else {
        let isDuplicateTx = DB.transactions.some(t => t.txId === String(txId).substring(0, 30));
        if (isDuplicateTx) return res.json({success: false, msg: "ဤလုပ်ငန်းစဉ်အမှတ် (TxID) အသုံးပြုပြီးပါပြီ"});

        DB.transactions.push({ id: tid, uid: user.id, type, method, amount, txId: String(txId).substring(0, 30), status: 'pending', date: new Date().toLocaleString() });
        if(DB.settings.adminChatId) {
            let bonus = Math.floor(amount * 0.05);
            let msg = `💰 <b>ငွေသွင်းရန် တောင်းဆိုမှု</b>\n▫️ UID: <b>${user.id}</b>\n▫️ ပမာဏ: ${amount.toLocaleString()} Ks (+ ${bonus} Bonus)\n▫️ TxID: ${txId}\n\nအတည်ပြုရန်: <code>/add ${user.id} ${amount + bonus}</code>\nပယ်ဖျက်ရန်: <code>/depno ${user.id}</code>`;
            try{ botFinance.sendMessage(DB.settings.adminChatId, msg, {parse_mode: 'HTML'}); }catch(e){}
        }
    }
    
    if (DB.transactions.length > 1000) DB.transactions.shift();
    saveDB(); res.json({success: true});
});

app.post('/api/admin', (req, res) => {
    if (!DB) return res.json({success: false});
    const { phone, action, data, sessionId } = req.body;
    
    let adminUser = DB.users['admin'];
    if((phone !== 'admin' && phone !== 'Asrissrk') || !adminUser || adminUser.sessionId !== sessionId) {
        return res.json({success: false, msg: 'Unauthorized request'});
    }
    
    if(action === 'savePhones') { DB.settings.kpayPhone = data.k; DB.settings.wavePhone = data.w; }
    else if(action === 'addLink') { DB.settings.links.push(data); }
    else if(action === 'deleteLink') { DB.settings.links.splice(data, 1); }
    else if(action === 'toggleServer') { DB.settings.serverActive = data; }
    else if(action === 'toggleAutoDraw') { DB.settings.autoDraw[data.game] = data.val; }
    else if(action === 'setManual') { DB.settings.manualNum[data.game] = data.val; DB.settings.autoDraw[data.game] = false; }
    else if(action === 'adjustBalance') {
        let u = Object.keys(DB.users).find(k => DB.users[k].id === data.uid);
        if(u) DB.users[u].balance += data.amt;
    }
    saveDB(); res.json({success: true});
});

app.listen(process.env.PORT || 3000, () => console.log('Server running securely'));
