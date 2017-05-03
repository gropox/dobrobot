

module.expports.getAmount = function (balance, weight) {

    log.debug("current user balance " + JSON.stringify(balance));
    let amount = {
        amount : 0,
        minTime : 0,
        currency : "GOLOS",
        zero : false
    };
    
    let currency = balance.GOLOS;
    if(currency.amount <= MIN_AMOUNT || isNaN(currency.opt)) {
        log.debug("\tGOLOS is not enough or stopped");
        if(balance.GBG.amount > MIN_AMOUNT) {
            log.debug("\tuse GBG");
            currency = balance.GBG;
            amount.currency = "GBG";
        } else {
            log.debug("GBG is not enough");
        }
    }
    
    log.debug("use currency " + amount.currency);
    opt = parseFloat(currency.opt);
    if(!isNaN(opt)) {
        opt = parseFloat((opt * weight / 100.0).toFixed(3));
        if(currency.amount < opt) {
            log.debug("1 opt is a " + (typeof opt));
            amount.zero = currency.amount > 0;
            if(currency.amount > MIN_AMOUNT) {
                amount.amount = currency.amount - MIN_AMOUNT;
                currency.amount = MIN_AMOUNT;
            } else {
                currency.amount = 0.0;
            }
        } else {
            log.debug("2 opt is a " + (typeof opt));
            amount.amount = opt;
            currency.amount -= opt; 
        }
    } else {
        log.info(amount.currency + " without amount per vote");
    }
    
    log.debug("reduced user balance " + JSON.stringify(balance));
    log.trace("amount = " + JSON.stringify(amount));
    return amount;
}
