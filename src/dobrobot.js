var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var Scanner = require("./scanner");
var Balancer = require("./balancer");

async function processVote(userid, userRep, balance, vote) {
    if(vote.weight <= 0) {
        log.debug("flag found " + vote.author + "/" + vote.permlink);
        return;
    }
    if(global.settings.ignorelistAuthors.includes(vote.author)) {
        log.trace("author ignored " + vote.author + "/" + vote.permlink);
        return;
    }
    
    let amount = balance.getAmount(vote.weight / 100);
    if(amount.amount > 0) {
        
        if(amount.opt.isCurator()) {
            let votedRep = await golos.getReputation(vote.author);
            log.debug("\tcheck reputation " + (userRep - votedRep));
            if((userRep - votedRep) < 0) {
                log.debug("\t\t potential curator");
                return ;
            }
        }
        
        let text = `${userid} проголосовал за ваш пост/комментарий ${vote.permlink}`;
        
        log.debug("sanchita = " + amount.opt.isSanchita());
        log.debug("prarabdha = " + amount.opt.isPrarabdha());
        log.debug("GOLOS = " + (amount.currency == Balancer.CURRENCY.GOLOS));
        
        if(amount.amount > global.MIN_AMOUNT && 
                amount.currency == Balancer.CURRENCY.GOLOS && 
                (amount.opt.isSanchita() || amount.opt.isPrarabdha())) {
            let reduce = global.MIN_AMOUNT;
            if(amount.opt.isPrarabdha()) {
                reduce = parseFloat((amount.amount / 2.0).toFixed(3));
            }
            let amk = amount.amount - reduce;
            amount.amount = reduce;
            await golos.transferKarma(vote.author, amk);
            text = `${userid} поднял вам карму за ваш пост/комментарий ${vote.permlink}`;
        }
        await golos.transfer(vote.author, amount.amount, amount.currency, text);
    }
    if(amount.zero) {
        await golos.transfer(userid, global.MIN_AMOUNT, amount.currency, `${userid} добро на вашем балансе иссякло`);
    }
}

async function transferHonor(userid, balance) {

    let voteScanner = new Scanner.Votes(userid, balance.minBlock);    
    await golos.scanUserHistory(userid, voteScanner);
    let votes = voteScanner.votes;
    
    if(votes.length > 0) {
        
        votes.sort((a,b) => {
            return a.block - b.block;
        });

        let userRep = await golos.getReputation(userid);
        //максимально 40 апвотов, что бы не перегружать
        for(let i = 0; i < votes.length && i < 40; i++) {    
            await processVote(userid, userRep, balance, votes[i]);
        }
    
   }
}

async function honor(userid, balance) {
    
    //прежде чем искать голоса в истории, проверить, достаточно ли средств, хотя бы по минимому
    let doHonor = balance.isAvailable();
    
    if(doHonor) {
        await transferHonor(userid, balance)
    } else {
        log.debug(userid + " has zero balance");
    }
}

async function getBalances() {
    let balancesScanner = new Scanner.Balances(global.settings.dobrobot, global.settings.minBlock);
    await golos.scanHistory(balancesScanner);
    
    for(tv of balancesScanner.transfer_to_vesting) {
        log.warn("unused transfer to vesting " + JSON.stringify(tv));
    }
    
    return balancesScanner.balances;
}

/**
 * перевод денег пользователям из черного списка. 
 */
async function refundBlacklisted(userid, bal) {
    log.info("\tsponsor blacklisted, refund");
    let to = userid;
    if(bal.GOLOS.amount >= global.MIN_AMOUNT) {
        if(bal.GOLOS.incomeUserId) {
            to = bal.GOLOS.incomeUserId;
        }
        await golos.transfer(to, bal.GOLOS.amount, bal.GOLOS.name, userid + " в черном списке");
    }
    if(bal.GBG.amount >= global.MIN_AMOUNT) {
        if(bal.GBG.incomeUserId) {
            to = bal.GBG.incomeUserId;
        }
        await golos.transfer(to, bal.GBG.amount, bal.GBG.name, userid + " в черном списке");
    }
}

/**
 * перевод денег неизвестных пользователей. 
 */
async function refundUnknown(userid, bal) {
    log.info("\t unknown userid " + userid + ", refund");
    
    let to = userid;
    if(bal.GOLOS.amount >= global.MIN_AMOUNT) {
        if(bal.GOLOS.incomeUserId) {
            to = bal.GOLOS.incomeUserId;
            await golos.transfer(to, bal.GOLOS.amount, bal.GOLOS.name, userid + " - несуществующий аккаунт");
        }
    }
    if(bal.GBG.amount >= global.MIN_AMOUNT) {
        if(bal.GBG.incomeUserId) {
            to = bal.GBG.incomeUserId;
        }
        await golos.transfer(to, bal.GBG.amount, bal.GBG.name, userid + " - несуществующий аккаунт");
    }
}

async function notifyIncome(userid, currency) {
    if(currency.income && currency.amount >= global.MIN_AMOUNT) {
        let sum = currency.amount - global.MIN_AMOUNT;
        await golos.transfer(userid, global.MIN_AMOUNT, currency.name, 
            `${userid} Ваш баланс добра был пополнен, сумма = ${sum.toFixed(3)} ${currency.name}, опции = ${currency.opt.toString()}`);
    }
}

module.exports.run = async function() {
    
    let lastBlock = 0;
    while(true) {
        try {

            let props = await golos.getCurrentServerTimeAndBlock();
            
            if(props.block < lastBlock) {
                log.error(`Current retrieved block ${props.block} is smaller then last one ${lastblock}!`);
                sleep(1000*60*3);
                continue;
            }
            lastBlock = props.block;
            
            log.info(`
#################
Scan for balances, current block ${props.block}
#################
`);
            let balances = await getBalances();
            
            let users = Object.keys(balances);
            
            for(let userid of users) {
                log.info("balance " + String(userid + "               ").substring(0,15) + " : " + balances[userid].toString());
            }
            
            for(let userid of users) {
                log.debug("process " + userid);
                
                if(balances[userid].GBG.amount > global.MIN_AMOUNT 
                    || balances[userid].GOLOS.amount > global.MIN_AMOUNT) {
                    log.debug("check userid " + userid);
                    let known = await golos.checkUser(userid);
                    log.debug("userid " + known);
                    if(!known) {
                        refundUnknown(userid, balances[userid]);
                        continue;
                    }
                }
                
                if(global.settings.blacklistSponsors.includes(userid)) {
                    await refundBlacklisted(userid,  balances[userid]);
                    continue;
                }
                await notifyIncome(userid, balances[userid].GBG);
                await notifyIncome(userid, balances[userid].GOLOS);
                await honor(userid, balances[userid]);
            }
            
        } catch(e) {
            log.error("Error catched in main loop!");
            log.error(golos.getExceptionCause(e));
        }  

        await sleep(1000*61*2); //sleep 2 minutes   
    }
    log.err("broken loop");
    process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
