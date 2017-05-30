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
       this.incomeBlock = 0;
       this.incomeUserId = null;
    }

    plus(amount, block, fromUserId) {
        this.amount += amount;
        this.amount = parseFloat(this.amount.toFixed(3));
        
        //Определяем, было ли пополнение баланса, 
        // что бы потом проинформировать пользователя 
        if(block > this.incomeBlock) {
            if(amount >= global.MIN_AMOUNT) {
                this.income = true;
                this.incomeUserId = fromUserId;
            } else {
                this.income = false;
            }
            this.incomeBlock = block;
        }
    }
    
    reduce(amount) {
        this.plus(-1 * amount);
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
        
        if(ta > 0) {
            if(this.amount > global.MIN_AMOUNT) {
                if(this.amount <= ta) {
                    amount.amount = this.amount - global.MIN_AMOUNT;
                    amount.zero = true;
                    log.debug("amount less then opt");
                } else {
                    log.debug("amount enough");
                    amount.amount = ta;
                }
            } else if(this.amount == global.MIN_AMOUNT) {
                log.debug("amount enough to inform about zero " + this.amount);
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
    
    constructor() {
        this.minBlock = 0;
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
        
        if(amount.amount > 0) {
            currency.reduce(amount.amount);
        }
        
        if(amount.zero) {
            currency.reduce(global.MIN_AMOUNT);
        }
        
        log.debug("reduced user balance " + this.toString());
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
}

//test();
