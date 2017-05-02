var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var Scanner = require("./scanner");

const MIN_AMOUNT = 0.001;
    
function getAmount(balance, weight) {

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
            amount.zero = true;
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
        if(global.isBlacklisted(vote.author)) {
            log.debug("author blacklisted " + vote.author + "/" + vote.permlink);
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
    let amount = getAmount(balance, 1);
    
    if(amount.amount > 0) {
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
                log.debug("process " + userid);
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
