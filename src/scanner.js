var log = require("./logger").getLogger(__filename, 12);
var global = require("./global");

class Scanner {

    constructor() {
    }
    
    process(historyEntry) {
        throw "not implemented";
    }    
}

class Votes extends Scanner {
    
    constructor(userid, minTime) {
        super();
        this.userid = userid;
        this.minTime = minTime;
        this.votes = [];
        log.debug("Search for votes of " + this.userid + " since " + this.minTime);
    }
    
    process(historyEntry) {
        //Последяя выплата
        let time =  Date.parse(historyEntry[1].timestamp);
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        opBody.time = time; //Для сортировки

        log.trace("\tupvote time " + time);
        //Учитывать только апвоты с последней выплаты
        if(this.minTime < time && op == "vote" && opBody.voter == this.userid) {
            log.debug("\tfound upvote " + opBody.author + "/" + opBody.permlink);
            this.votes.push(opBody);
        }
        
        return this.minTime > time; //Пошли уже старые записи, дальше сканировать историю нет смысла
    }    
}

class Balances extends Scanner {
    constructor() {
        super(null);
        this.balances = {};
    }
    
    plus(userid, amount, currency, time, opt) {
        if(this.balances[userid]) {
        } else {
            this.balances[userid] = {
                minTime: 0,
                GOLOS : {
                    amount : 0, 
                    opt : 1
                },
                GBG : {
                    amount : 0, 
                    opt : 1
                }
            };
        }
        
        this.balances[userid][currency].amount += amount;

        if(this.balances[userid].minTime < time) {
            this.balances[userid].minTime = time;
            // Если в memo входящего переводы было число, 
            // считаем его как  amount per vote
            if(opt) {
                this.balances[userid][currency].opt = opt;
            }
        }
    }
    
    minus(userid, amount, currency, payoutTime) {
        this.plus(userid, -1 * amount, currency, payoutTime, null);
    }
    
    process(historyEntry) {
        let time =  Date.parse(historyEntry[1].timestamp);        
        let id = historyEntry[0];
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        
        if(op == "transfer") {
            // Исходящий перевод - отнимаем от баланса
            if(opBody.from == global.settings.dobrobot) {
                
                let amount = parseFloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                //пример memo: userid благодарит за permlink 
                let userid = opBody.memo.split(" ")[0];

                log.trace("\tfound payout to " + userid + ", amount = " + amount.toFixed(3) + " " + currency );
                
                this.minus(userid, amount, currency, time);
            }
            
            // Входящий перевод - прибавляем к балансу
            if(opBody.to == global.settings.dobrobot) {
                let amount = parseFloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                let opt = opBody.memo;
                let userid = opBody.from;
                log.trace("\tfound payin from " + userid + ", amount = " + amount.toFixed(3) + " " + currency + "(" + opt + ")");
                this.plus(userid, amount, currency, time, opt);

            }
        }
        return false;
    }    
}
module.exports.Votes = Votes;
module.exports.Balances = Balances;

