var log = require("./logger").getLogger(__filename, 12);
var Balance = require("./balancer");
var options = require("./options");

class Scanner {

    constructor() {
    }
    
    process(historyEntry) {
        throw "not implemented";
    }    
}

class Votes extends Scanner {
    
    constructor(userid, minBlock) {
        super();
        this.userid = userid;
        this.minBlock = minBlock;
        this.votes = [];
        log.debug("Search for votes of " + this.userid + " since " + this.minBlock);
    }
    
    process(historyEntry) {
        //Последяя выплата
        let block =  historyEntry[1].block;
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        opBody.block = block; //Для сортировки

        log.trace("\tupvote block " + block);
        //Учитывать только апвоты с последней выплаты
        if(this.minBlock < block && op == "vote" && opBody.voter == this.userid && opBody.author != this.userid) {
            log.info("\tfound upvote of " + this.userid + " (" + (opBody.weight / 100) + ") " + opBody.author + "/" + opBody.permlink);
            this.votes.push(opBody);
        }
        
        return this.minBlock > block; //Пошли уже старые записи, дальше сканировать историю нет смысла
    }    
}

class Balances extends Scanner {
    constructor(dobrobot, minBlock) {
        super(null);
        this.balances = {};
        this.minBlock = minBlock;
        this.dobrobot = dobrobot;
    }
    
    plus(userid, amount, currency, block, opt, fromUserId) {
        if(this.balances[userid]) {
        } else {
            this.balances[userid] = new Balance();
        }
        
        log.trace("\tadd " + userid + " " + amount + " " + currency);
        this.balances[userid].plus(amount, currency, block, opt, fromUserId);
    }
    
    minus(userid, amount, currency, block) {
        this.plus(userid, -1 * amount, currency, block, null, null);
    }
    
    process(historyEntry) {
        let block = historyEntry[1].block;

        if(block <= this.minBlock) {
            //Неучитывать данные после релиза
            return true;
        }
                    
        let id = historyEntry[0];
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        
        if(op == "transfer") {
            // Исходящий перевод - отнимаем от баланса
            if(opBody.from == this.dobrobot) {
                
                let amount = parseFloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                //пример memo: userid благодарит за permlink 
                let userid = opBody.memo.split(" ")[0];

                log.trace("\tfound payout to " + userid + ", amount = " + amount.toFixed(3) + " " + currency );

                log.trace("csv\t" + userid + "\t" + "-" + amount.toFixed(3) + "\t" + currency + "\t" +  block);
                this.minus(userid, amount, currency, block);

            }
            
            // Входящий перевод - прибавляем к балансу
            if(opBody.to == this.dobrobot) {
                let amount = parseFloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                let opt = opBody.memo;
                let userid = opBody.from;
                let m = options.isUserTransfer(opt);
                //log.debug(JSON.stringify(m));
                if(m) {
                    userid = m[1];
                    opt = null;
                }
                log.trace("\tfound payin from " + userid + ", amount = " + amount.toFixed(3) + " " + currency + "(" + opt + ")");

                log.trace("csv\t" + userid + "\t" + "+" + amount.toFixed(3) + "\t" + currency + "\t" +  block);
                this.plus(userid, amount, currency, block, opt, opBody.from);
            }
        }
        return false;
    }    
}

module.exports.Scanner = Scanner;
module.exports.Votes = Votes;
module.exports.Balances = Balances;

if(!(typeof window == "undefined")) {
    window.Balances = Balances;
    window.OPTIONS = OptStack.OPTIONS;
}
