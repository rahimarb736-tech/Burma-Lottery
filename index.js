const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const TG_BOT_TOKEN = "8946714760:AAFPNV9YOFQ2yt5QVPYKMjUwp4gFzr59sQo";
const TG_CHAT_ID = "6401060103";
const JSONBIN_API_KEY = "$2a$10$a1albbh2l.jCXmiJimtr0efqbbw8enxHmE9LWrO94jkEU43ekZuC";
const JSONBIN_BIN_ID = "6901842ae41b4d34f43c8d17";
const ADMIN_PHONE = '992004';
const DURATIONS = { wingo30s: 30000, wingo1m: 60000, wingo3m: 180000, wingo5m: 300000 };

let DB = { users: {}, settings: { autoDraw: { wingo30s: true, wingo1m: true, wingo3m: true, wingo5m: true }, manualNum: { wingo30s: null, wingo1m: null, wingo3m: null, wingo5m: null }, serverActive: true, links: [] }, currentGame: 'wingo30s', games: { wingo30s: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 }, wingo1m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 }, wingo3m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 }, wingo5m: { bets: [], history: [], myBets: [], lastBlock: null, todayProfit: 0, todayComm: 0, currentPeriodProfit: 0, currentPeriodComm: 0 } } };
let isDrawing = false;

async function loadDB() {
    try {
        let res = await axios.get(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, { headers: { 'X-Master-Key': JSONBIN_API_KEY }});
        if(res.data && res.data.record) {
            DB = res.data.record;
            if(!DB.users[ADMIN_PHONE]) DB.users[ADMIN_PHONE] = { id: 'Admin', phone: ADMIN_PHONE, name: 'Admin', pwd: 'adminpassword', balance: 9999999, isAdmin: true };
            console.log("✅ Database Loaded Successfully");
        }
    } catch(e) { console.log("Database Load Error"); }
}

async function saveDB() {
    try { await axios.put(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, DB, { headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY }}); } catch(e) {}
}

async function sendTG(msg) {
    try { await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, { chat_id: TG_CHAT_ID, text: msg, parse_mode: 'HTML' }); } catch(e){}
}

app.get('/', (req, res) => res.send("Burma Lottery Server is Running 24/7!"));
app.get('/api/db', (req, res) => { res.json(DB); });
app.post('/api/update', (req, res) => { 
    if(!isDrawing) { DB = req.body; } 
    res.json({success: true}); 
});

let lastUpdateId = 0;
async function pollTG() {
    try {
        let res = await axios.get(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`);
        if(res.data.result && res.data.result.length > 0) {
            for(let u of res.data.result) {
                lastUpdateId = u.update_id;
                if(u.message && u.message.text && u.message.chat.id.toString() === TG_CHAT_ID) {
                    handleCmd(u.message.text.trim());
                }
            }
        }
    } catch(e) {}
}

function handleCmd(msg) {
    let parts = msg.split(' '); let cmd = parts[0].toLowerCase();
    if(cmd === '/add' && parts.length >= 3) {
        let targetId = parts[1]; let amt = parseFloat(parts[2]); let uKey = Object.keys(DB.users).find(k => DB.users[k].id === targetId);
        if(uKey) { DB.users[uKey].balance += amt; saveDB(); sendTG(`✅ အောင်မြင်သည်\nUID: ${targetId} သို့ ${amt} Ks ငွေဖြည့်သွင်းပြီးပါပြီ။`); }
    } else if(cmd === '/sub' && parts.length >= 3) {
        let targetId = parts[1]; let amt = parseFloat(parts[2]); let uKey = Object.keys(DB.users).find(k => DB.users[k].id === targetId);
        if(uKey) { DB.users[uKey].balance = Math.max(0, DB.users[uKey].balance - amt); saveDB(); sendTG(`✅ အောင်မြင်သည်\nUID: ${targetId} မှ ${amt} Ks ဖြတ်တောက်ပြီးပါပြီ။`); }
    } else if(cmd === '/set' && parts.length >= 3) {
        let gameType = parts[1].toLowerCase(); let num = parseInt(parts[2]);
        let gameKey = gameType === '30s' ? 'wingo30s' : gameType === '1m' ? 'wingo1m' : gameType === '3m' ? 'wingo3m' : gameType === '5m' ? 'wingo5m' : null;
        if(gameKey && num >= 0 && num <= 9) { DB.settings.manualNum[gameKey] = num; DB.settings.autoDraw[gameKey] = false; saveDB(); sendTG(`🎯 အောင်မြင်သည်\n${gameType} အတွက် ဂဏန်း <b>${num}</b> ထွက်ရန် သတ်မှတ်ပြီးပါပြီ။`); }
    }
}

function getPeriod(block, key) { let d = new Date(block * DURATIONS[key]); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${block % 10000}`; }

function gameLoop() {
    const timeNow = Date.now();
    Object.keys(DURATIONS).forEach(k => {
        const g = DB.games[k]; const currentBlock = Math.floor(timeNow / DURATIONS[k]);
        if (!g.lastBlock) { g.lastBlock = currentBlock; return; }
        if (currentBlock > g.lastBlock) {
            isDrawing = true; 
            processDraw(k, currentBlock - 1);
            g.lastBlock = currentBlock;
            saveDB().then(() => { isDrawing = false; });
        }
    });
}

function processDraw(gameKey, targetBlock) {
    const g = DB.games[gameKey]; let num = null;
    if (!DB.settings.autoDraw[gameKey] && DB.settings.manualNum[gameKey] !== null) { 
        num = DB.settings.manualNum[gameKey]; DB.settings.manualNum[gameKey] = null; 
    } else {
        let liabilities = {0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
        g.bets.forEach(b => { let eff = b.amount * 0.98; if(b.type === 'num') liabilities[b.num] += eff * 9; else if(b.type === 'big') for(let i=5;i<=9;i++) liabilities[i] += eff * 2; else if(b.type === 'small') for(let i=0;i<=4;i++) liabilities[i] += eff * 2; else if(b.type === 'green') { [1,3,7,9].forEach(i=>liabilities[i]+=eff*2); liabilities[5]+=eff*1.5; } else if(b.type === 'red') { [2,4,6,8].forEach(i=>liabilities[i]+=eff*2); liabilities[0]+=eff*1.5; } else if(b.type === 'purple') { [0,5].forEach(i=>liabilities[i]+=eff*4.5); } });
        let minL = Infinity, cands = []; for(let i=0; i<=9; i++) { if(liabilities[i] < minL) { minL = liabilities[i]; cands = [i]; } else if(liabilities[i] === minL) cands.push(i); } 
        num = cands[Math.floor(Math.random() * cands.length)];
    }
    const strPeriod = getPeriod(targetBlock, gameKey);
    let totalBet = 0, totalPayout = 0, totalComm = 0;
    
    g.bets.forEach(b => {
        totalBet += b.amount; totalComm += b.amount * 0.02;
        let win = false, mult = 0; let eff = b.amount * 0.98;
        if(b.type === 'num' && b.num === num) { win=true; mult=9; } else if(b.type === 'big' && num >= 5) { win=true; mult=2; } else if(b.type === 'small' && num <= 4) { win=true; mult=2; } else if(b.type === 'green') { if([1,3,7,9].includes(num)) { win=true; mult=2; } else if(num === 5) { win=true; mult=1.5; } } else if(b.type === 'red') { if([2,4,6,8].includes(num)) { win=true; mult=2; } else if(num === 0) { win=true; mult=1.5; } } else if(b.type === 'purple' && [0,5].includes(num)) { win=true; mult=4.5; }
        
        if(DB.users[b.userKey]) {
            let payout = win ? Math.floor(eff * mult) : 0;
            DB.users[b.userKey].balance += payout; totalPayout += payout;
            if(!DB.users[b.userKey].myBets) DB.users[b.userKey].myBets = [];
            DB.users[b.userKey].myBets.unshift({ type: b.type, num: b.num, amount: b.amount, result: num, win: win, payout: win ? payout : -b.amount, period: strPeriod, date: new Date().toLocaleTimeString('en-US', {timeZone: 'Asia/Yangon'}) });
            if(DB.users[b.userKey].myBets.length > 50) DB.users[b.userKey].myBets.pop();
        }
    });
    
    let net = totalBet - totalPayout; 
    g.currentPeriodProfit = net; g.currentPeriodComm = totalComm; g.todayProfit += net; g.todayComm += totalComm; 
    g.history.unshift({ period: strPeriod, num: num }); if(g.history.length > 100) g.history.pop();
    g.bets = []; 
    
    let gameLabel = gameKey === 'wingo30s' ? 'Win Go 30s' : gameKey === 'wingo1m' ? 'Win Go 1 Min' : gameKey === 'wingo3m' ? 'Win Go 3 Min' : 'Win Go 5 Min';
    sendTG(`🎲 <b>${gameLabel} ရလဒ်ထွက်ပါပြီ</b>\nပွဲစဉ်: ${strPeriod}\nဂဏန်း: <b>${num}</b>\nစုစုပေါင်းအမြတ်: ${net} Ks`);
}

loadDB().then(() => {
    setInterval(gameLoop, 1000);   
    setInterval(pollTG, 3000);     
    setInterval(saveDB, 30000);    
    app.listen(process.env.PORT || 3000, () => console.log('✅ Server Started Successfully!'));
});
