var log = require("./logger").getLogger(__filename, 12);
var steem = require("steem");
var global = require("./global");
var OpStack = require("./options");

class Currency {
    constructor(name) {
       this.name = name;
       this.amount = 0.0;
       this.opt = new OpStack();
    }

    plus(amount) {
        this.amount += amount;
        this.amount = parseFloat(this.amount.toFixed(3));
    }
    
    isAvailable(weight) {
        if(this.opt.isActive()) {
            let amount = this.calcTransferAmount("", currency, weight);
            return (amount.amount > 0)
        }
        return false;
    }
    
    calcTransferAmount(weight) {
        
        let amount = {
            amount : 0,
            currency : this.name,
            zero : false
        };
        
        let opt = parseFloat(currency.opt);
        if(opt <= 0) {
            return amount;
        }
        
        let ta = parseFloat((opt * weight / 100.0).toFixed(3));
        
        if(ta > 0) {
            if(currency.amount > global.MIN_AMOUNT) {
                if(currency.amount <= ta) {
                    amount.amount = currency.amount - global.MIN_AMOUNT;
                    amount.zero = true;
                    log.debug("amount less then opt");
                } else {
                    log.debug("amount enough");
                    amount.amount = ta;
                }
            } else if(currency.amount == global.MIN_AMOUNT) {
                log.debug("amount enough to inform about zero " + currency.amount);
                amount.amount = 0;
                amount.zero = true;
            } else {
                log.debug("currency.amount <= 0");
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
        this.lastBlock = 0;
        this.GBG = new Currency("GBG");
        this.GOLOS = new Currency("GOLOS");
    }
    
    plus(amount, currency, block, opt) {
        log.trace("\tadd " + amount + " " + currency);
        this[currency].plus(amount);
        if(opt) {
            this[currency].opt.push(opt, block);
        }
    }
    
    getAmount(weight) {

        log.debug("current user balance " + JSON.stringify(this));
        
        let currency = null;
        let curname = "GOLOS";
        if(isAvailable(this.GOLOS, weight)) {
            currency = this.GOLOS;
        }
        if(currency == null) {
            curname = "GBG";
            currency = this.GBG;
        }

        let amount = calcTransferAmount(curname, currency, weight);
        if(amount.amount > 0) {
            currency.amount -= amount.amount;
        }
        
        if(amount.zero) {
            currency.amount -= global.MIN_AMOUNT;
        }
        
        log.debug("reduced user balance " + JSON.stringify(balance));
        log.trace("amount = " + JSON.stringify(amount));
        return amount;
    }    
}

module.exports = Balance;
