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
    
    constructor(userid, balance) {
        super();
        this.userid = userid;
        this.balance = balance;
        this.votes = [];
    }
    
    process(historyEntry) {
        //Последяя выплата
        let minTime = Math.max(this.balance.GOLOS.minusId, this.balance.GB.minusId);
        log.trace("last payout " + minTime);

        let time =  Date.parse(historyEntry[1].timestamp);
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        opBody.time = time; //Для сортировки

        log.trace("\tupvote time " + time);
        //Учитывать только апвоты с последней выплаты
        if(minTime < time && op == "vote" && opBody.voter = this.userid) {
            log.debug("\tfound upvote " + opBody.author + "/" + opBody.permlink);
            this.votes.push(opBody);
        }
        
        return minTime >= time; //Пошли уже старые записи, дальше сканировать историю нет смысла
    }    
}

class Balances extends Scanner {
    constructor() {
        super(null);
        this.balances = {};
    }
    
    plus(userid, amount, currency, id, opt) {
        if(this.balances[userid]) {
        } else {
            this.balances[userid] = {
                GOLOS : {
                    amount : 0, 
                    opt : 1, 
                    id : 0,
                    payoutTime : 0
                },
                GBG : {
                    amount : 0, 
                    opt : 1, 
                    id : 0,
                    payoutTime : 0
            };
        }
        
        this.balances[userid][currency].amount += amount;

        if(this.balances[userid][currency].id < id) {
            this.balances[userid][currency].id = id;
            // Если в memo входящего переводы было число, 
            // считаем его как  amount per vote
            if(typeof opt == "number") {
                this.balances[userid][currency].opt = opt;
            }
        }
    }
    
    minus(userid, amount, currency, payoutTime) {
        add(userid, -1 * amount, currency, 0, null);

        //Запоминаем макс. timestamp, что бы потом найти upvote c timestamp > чем у перевода.    
        if(this.balances[userid][currency].payoutTime < payoutTime) {
            this.balances[userid][currency].payoutTime = payoutTime;
        }
    }
    
    process(historyEntry) {
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

                log.trace("\tfound payout to " + userid + ", amount = " + amount.toFixed(3) + " " + currncy );
                
                minus(userid, amount, currency, id);
            }
            
            // Входящий перевод - прибавляем к балансу
            if(opBody.to == global.settings.dobrobot) {
                let amount = parsefloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                let opt = parseFloat(opBody.memo);
                let userid = opBody.from;
                log.trace("\tfound payin from " + userid + ", amount = " + amount.toFixed(3) + " " + currncy + "(" + opt + ")");
                plus(userid, amount, currency, id, opt);

            }
        }
        return false;
    }    
}
module.exports.Votes = Votes;
module.exports.Balances = Balances;

