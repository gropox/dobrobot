var log = require("./logger").getLogger(__filename, 12);
var steem = require("steem");
var global = require("./global")

function calcTransferAmount(currname, currency, weight) {
    
    let amount = {
        amount : 0,
        currency : currname,
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

function isAvailable(currency, weight) {
    if(isNaN(currency.opt)) {
        return false;
    }
    let amount = calcTransferAmount("", currency, weight);
    return (amount.amount > 0)
}

function getAmount(balance, weight) {

    log.debug("current user balance " + JSON.stringify(balance));
    
    
    let currency = null;
    let curname = "GOLOS";
    if(isAvailable(balance.GOLOS, weight)) {
        currency = balance.GOLOS;
    }
    if(currency == null) {
        curname = "GBG";
        currency = balance.GBG;
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

module.exports.getAmount = getAmount;
module.exports.calcTransferAmount = calcTransferAmount;
