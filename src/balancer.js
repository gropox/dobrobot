var log = require("./logger").getLogger(__filename, 12);
var steem = require("steem");
var global = require("./global");
var OpStack = require("./options");

const CURRENCY = {
    GOLOS : "GOLOS",
    GBG : "GBG"
}

class Amount {
    constructor(name, opt) {
        this.amount = 0;
        this.currency = name;
        this.zero = false;
        this.opt = opt;
    }
}

class CurrencyValue {
    constructor(name) {
       this.name = name;
       this.amount = 0.0;
       this.opt = new OpStack();
       this.income = false;
       this.block = 0;
       this.incomeUserId = null;
       this.deb = 0;
    }

    toJson() {
        return {
            a : this.amount,
        }
    }

    fromJson(json, userid) {
        if(this.amount != json.a) {
            log.warn(userid + " " + (json.a - this.amount));
        }
        this.amount = json.a;
    }

    plus(amount, block, fromUserId) {
        this.deb = 0;
        this.amount += amount;
        this.amount = parseFloat(this.amount.toFixed(3));
        
        //Определяем, было ли пополнение баланса, 
        // что бы потом проинформировать пользователя 
        if(block > this.block) {
            if(amount >= global.MIN_AMOUNT) {
                this.income = true;
                this.incomeUserId = fromUserId;
            } else {
                //Было снятие с баланса!
                this.income = false;
            }
            this.block = block;
        }
    }
    
    reduce(amount) {
        this.plus(-1 * amount);
    }
    
    debit(amount) {
        this.deb += amount;
    }

    isAvailable(weight) {
        if(this.opt.isActive()) {
            let amount = this.calcTransferAmount(weight);
            return (amount.amount > 0)
        }
        return false;
    }
    
    calcTransferAmount(weight) {
        
        let amount = new Amount(this.name, this.opt);
        
        if(!this.opt.isActive()) {
            return amount;
        }
        
        let ta = this.opt.getAmountPerVote(weight);
        let current_amount = this.amount - this.deb;
        if(ta > 0) {
            if(current_amount > global.MIN_AMOUNT) {
                if(current_amount <= ta) {
                    amount.amount = current_amount - global.MIN_AMOUNT;
                    amount.zero = true;
                    log.debug("amount less then opt");
                } else {
                    log.debug("amount enough");
                    amount.amount = ta;
                }
            } else if(current_amount == global.MIN_AMOUNT) {
                log.debug("amount enough to inform about zero " + current_amount);
                amount.amount = 0;
                amount.zero = true;
            } else {
                log.debug("this.amount <= 0");
                amount.amount = 0;
            } 
        } else {
            log.debug("ta = 0");
            amount.amount = 0;
        }
        
        return amount;
    }
    
}

class Balance {
    
    constructor(minBlock) {
        this.minBlock = 0;
        if(minBlock) {
            this.minBlock = minBlock;
        }
        this.GBG = new CurrencyValue(CURRENCY.GBG);
        this.GOLOS = new CurrencyValue(CURRENCY.GOLOS);
    }
    
    plus(amount, currency, block, opt, fromUserId) {
        log.trace("\tadd " + amount + " " + currency);
        this[currency].plus(amount, block, fromUserId);
        if(opt) {
            this[currency].opt.push(opt, block);
        }
        if(this.minBlock < block) {
            this.minBlock = block;
        }
    }
    
    isAvailable() {
        let golos = this.GOLOS.isAvailable(1);
        let gbg = this.GBG.isAvailable(1);
        
        log.debug("this.GOLOS.isAvailable(1) = " + golos);
        log.debug("this.GBG.isAvailable(1) = " + gbg);
        return golos || gbg;
    }
    
    /** сериализация в json */
    toJson() {
        return {
            GOLOS : this.GOLOS.toJson(),
            GBG : this.GBG.toJson()
        }
    }

    fromJson(json, userid) {
        this.GOLOS.fromJson(json.GOLOS, userid);
        this.GBG.fromJson(json.GBG, userid);
    }

    toString() {
        return  `GBG = { amount : ${this.GBG.amount}, opts : ${this.GBG.opt.toString()}}, GOLOS = { amount : ${this.GOLOS.amount}, opts : ${this.GOLOS.opt.toString()}`;
    }
    
    getAmount(weight) {

        log.debug("current user balance " + this.toString());
        
        let currency = null;
        if(this.GOLOS.isAvailable(weight)) {
            currency = this.GOLOS;
        }
        if(currency == null && this.GBG.isAvailable(weight)) {
            currency = this.GBG;
        }

        if(!currency) {
            return new Amount("GOLOS", this.opt);
        }
        
        let amount = currency.calcTransferAmount(weight);
        
        log.trace("calculated amount = " + JSON.stringify(amount));
        return amount;
    }    
}

Balance.CURRENCY = CURRENCY;

module.exports = Balance;

async function test() {

    let balance = new Balance();
    
    balance.plus(10.6, "GBG", 1, "1");
    
    log.debug("Balance " + balance.GBG.amount);
    log.debug("Balance available = " + balance.isAvailable());
    
    let a = balance.getAmount(100);
    log.debug("a(100) = " + JSON.stringify(a)); 

    a = balance.getAmount(50);
    log.debug("a(50) кит = " + JSON.stringify(a)); 
    log.debug("Balance 1 " + balance.GBG.amount);

    //set рыба
    balance.plus(0.01, "GBG", 1, "/рыба");
    a = balance.getAmount(50);
    log.debug("a(50) рыба = " + JSON.stringify(a)); 
    log.debug("Balance 2 " + balance.GBG.amount);

    for(let i = 0; i < 10; i++) {
        a = balance.getAmount(100);
        log.debug("a(100) = " + JSON.stringify(a)); 
    }

    balance.plus(10.6, "GBG", 1, "1");
    balance.plus(43.7, "GOLOS", 1, "1");

    log.debug("balance = " + JSON.stringify(balance, null, 4));
    

    let json = balance.toJson();
    log.debug("json = " + JSON.stringify(json, null, 4));

    balance = new Balance();
    let jsone = balance.toJson();
    log.debug("json empty = " + JSON.stringify(jsone, null, 4));
    
    //десериализация
    balance.fromJson(json);
    log.debug("balance = " + JSON.stringify(balance, null, 4));

}

//test();
