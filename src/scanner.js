const log = require("./logger").getLogger(__filename, 12);
const Balance = require("./balancer");
const options = require("./options");
const global = require("./global");

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

        if(block < this.minBlock) {
            return true;
        }

        log.trace("\tupvote block " + block);
        if(op == "vote" 
            && opBody.voter == this.userid 
            && opBody.author != this.userid
            && opBody.weight > 0) {
            log.debug("\tfound upvote of " + this.userid + " (" + (opBody.weight / 100) + ") " + opBody.author + "/" + opBody.permlink);
            this.votes.push(opBody);
        }
        
        return false;
    }    
}

class Savepoint extends Scanner {
    constructor() {
        super();
        this.json = null;
        this.block = 0;
    }

    process(historyEntry) {
        let block = historyEntry[1].block;
        let id = historyEntry[0];
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        
        if(op == "custom_json") {        
            if(block > this.block && opBody.id == global.SAVEPOINT) {
                this.json = opBody.json;
                this.block = block;
            }            
        }
        return this.block > 0;
    }
}

module.exports.Savepoint = Savepoint;

class Balances extends Scanner {
    constructor(dobrobot, minBlock, balances) {
        super(null);
        this.balances = balances;
        this.minBlock = minBlock;
        this.dobrobot = dobrobot;
        this.transfer_to_vesting = [];

        this.lastBlock = this.minBlock;
        this.updated = false;
    }
    
    plus(userid, amount, currency, block, opt, fromUserId) {
        if(this.balances[userid]) {
        } else {
            this.balances[userid] = new Balance();
        }
        
        log.trace("\tadd " + userid + " " + amount + " " + currency);
        this.balances[userid].plus(amount, currency, block, opt, fromUserId);
        this.updated = true;
    }
    
    minus(userid, amount, currency, block) {
        this.plus(userid, -1 * amount, currency, block, null, null);
    }
    
    process(historyEntry) {
        let block = historyEntry[1].block;
        //log.debug("block " + block + ", minBlock " + this.minBlock);
        if(block <= this.minBlock) {
            //Неучитывать данные после релиза
            return true;
        }
        
        if(block > this.lastBlock) {
            this.lastBlock = block;
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
                
                //check vesting
                var trVesting = this.transfer_to_vesting.pop();
                if(trVesting) {
                    if(trVesting.to = opBody.to) {
                        let va = parseFloat(trVesting.amount.split(" ")[0]);
                        amount += va;
                    } else {
                        this.transfer_to_vesting.push(trVesting);
                    }
                }

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
        if(op == "transfer_to_vesting") {
            // Исходящий перевод - отнимаем от баланса
            if(opBody.from == this.dobrobot) {
                this.transfer_to_vesting.push(opBody);
            }
        }
        return false;
    }    
}


module.exports.Scanner = Scanner;
module.exports.Votes = Votes;
module.exports.Balances = Balances;
