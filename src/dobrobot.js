var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var Scanner = require("./scanner");

const MIN_AMOUNT = 0.001;

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
        if(currency.amount > MIN_AMOUNT) {
            if(currency.amount <= ta) {
                amount.amount = currency.amount - MIN_AMOUNT;
                amount.zero = true;
                log.debug("amount less then opt");
            } else {
                log.debug("amount enough");
                amount.amount = ta;
            }
        } else if(currency.amount > 0) {
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
        currency.amount -= MIN_AMOUNT;
    }
    
    log.debug("reduced user balance " + JSON.stringify(balance));
    log.trace("amount = " + JSON.stringify(amount));
    return amount;
}

async function transferHonor(userid, balance) {

    let voteScanner = new Scanner.Votes(userid, balance.minTime);    
    await golos.scanUserHistory(userid, voteScanner);
    let votes = voteScanner.votes;
    
    votes.sort((a,b) => {
        return a.time - b.time;
    });
    
    for(let vote of votes) {
        if(vote.weight <= 0) {
            log.debug("flag found " + vote.author + "/" + vote.permlink);
        }
        if(global.settings.ignorelistAuthors.includes(vote.author)) {
            log.info("author blacklisted " + vote.author + "/" + vote.permlink);
            continue;
        }
        
        let amount = getAmount(balance, vote.weight / 100);
        if(amount.amount > 0) {
            await golos.transfer(vote.author, amount.amount, amount.currency, `${userid} проголосовал за ваш пост/комментарий ${vote.permlink}`);
        }
        if(amount.zero) {
            await golos.transfer(userid, MIN_AMOUNT, amount.currency, `${userid} добро на вашем балансе иссякло`);
        }
    }
}

async function honor(userid, balance) {
    
    //прежде чем искать голоса в истории, проверить, достаточно ли средств, хотя бы по минимому
    let doHonor = balance.GOLOS.amount > 0 || balance.GBG.amount > 0;
    
    if(doHonor) {
        await transferHonor(userid, balance)
    } else {
        log.debug(userid + " has zero balance");
    }
}

module.exports.run = async function() {
    
    while(true) {
        try {
            log.info("\n\n\nScan for balances");
            let balancesScanner = new Scanner.Balances();
            await golos.scanHistory(balancesScanner);
            
            let balances = balancesScanner.balances;
            let users = Object.keys(balances);
            
            for(let userid of users) {
                log.info("balance " + userid + " : " + JSON.stringify(balances[userid]));
            }
            
            for(let userid of users) {
                log.debug("process " + userid);
                if(global.settings.blacklistSponsors.includes(userid)) {
                    log.info("\tsponsor blacklisted, refund");
                    let bal = balances[userid]
                    if(bal.GOLOS.amount >= MIN_AMOUNT) {
                        await golos.transfer(userid, bal.GOLOS.amount, "GOLOS", userid + " Возврат");
                    }
                    if(bal.GBG.amount >= MIN_AMOUNT) {
                        await golos.transfer(userid, bal.GBG.amount, "GBG", userid + " Возврат");
                    }
                    continue;
                }
                await honor(userid, balances[userid]);
            }
            
        } catch(e) {
            log.error("Error catched in main loop!");
            log.error(golos.getExceptionCause(e));
        }  

        await sleep(1000*61*1); //sleep 5 minutes   
    }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
