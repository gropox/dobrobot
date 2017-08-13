var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var Scanner = require("./scanner");
var Balancer = require("./balancer");

let USER_BALANCES = {};
let MINBLOCK = 0;

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
            balance.GOLOS.debit(amk);
            text = `${userid} поднял вам карму за ваш пост/комментарий ${vote.permlink}`;
        }
        await golos.transfer(vote.author, amount.amount, amount.currency, text);
        balance[amount.currency].debit(amount.amount);
        
    }
    if(amount.zero) {
        await golos.transfer(userid, global.MIN_AMOUNT, amount.currency, `${userid} добро на вашем балансе иссякло`);
        balance[amount.currency].debit(global.MIN_AMOUNT);
    }
}

async function transferHonor(userid, balance) {

    let voteScanner = new Scanner.Votes(userid, Math.max(MINBLOCK, balance.minBlock));    
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

function dump(balances) {
    let users = Object.keys(balances).sort();
    
    for(let userid of users) {
        log.info("balance " + String(userid + "               ").substring(0,15) + " : " + balances[userid].toString());
    }
}

async function getBalances() {
    log.debug("update balance since " + MINBLOCK);
    let balancesScanner = new Scanner.Balances(global.settings.dobrobot, MINBLOCK, USER_BALANCES);

    await golos.scanHistory(balancesScanner);

    for(tv of balancesScanner.transfer_to_vesting) {
        log.warn("unused transfer to vesting " + JSON.stringify(tv));
    }

    return balancesScanner;
}

async function createCheckpoint() {
    await golos.createSavepoint(USER_BALANCES);
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
        bal.GOLOS.debit(bal.GOLOS.amount);
    }
    if(bal.GBG.amount >= global.MIN_AMOUNT) {
        if(bal.GBG.incomeUserId) {
            to = bal.GBG.incomeUserId;
        }
        await golos.transfer(to, bal.GBG.amount, bal.GBG.name, userid + " в черном списке");
        bal.GBG.debit(bal.GBG.amount);
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
            bal.GOLOS.debit(bal.GOLOS.amount);
        }
        await golos.transfer(to, bal.GOLOS.amount, bal.GOLOS.name, userid + " - несуществующий аккаунт");
    }
    if(bal.GBG.amount >= global.MIN_AMOUNT) {
        if(bal.GBG.incomeUserId) {
            to = bal.GBG.incomeUserId;
        }
        await golos.transfer(to, bal.GBG.amount, bal.GBG.name, userid + " - несуществующий аккаунт");
        bal.GBG.debit(bal.GBG.amount);
    }
}

async function notifyIncome(userid, currency) {
    if(currency.income && currency.amount >= global.MIN_AMOUNT) {
        let sum = currency.amount - global.MIN_AMOUNT;
        await golos.transfer(userid, global.MIN_AMOUNT, currency.name, 
            `${userid} Ваш баланс добра был пополнен, сумма = ${sum.toFixed(3)} ${currency.name}, опции = ${currency.opt.toString()}`);
        currency.debit(global.MIN_AMOUNT);
    }
}

module.exports.run = async function() {
    
    MINBLOCK = global.settings.minBlock;

    let lastBlock = 0;
    while(true) {
        try {

            let props = await golos.getCurrentServerTimeAndBlock();
            
            if(props.block <= lastBlock) {
                log.info(`no changes, skip round`);
                await sleep(1000*15);
                continue;
            }
            lastBlock = props.block;
            
            log.info(`
#################
${new Date().toISOString()} Scan for balances, current block ${props.block}
#################
`);
            
            scanner = await getBalances();
            if(scanner.updated) {
                await createCheckpoint();
            }

            log.info("MINBLOCK = " + MINBLOCK + ", LASTBLOCK = " + scanner.lastBlock);

            dump(USER_BALANCES);
            
            let transferred = false;

            for(let userid of Object.keys(USER_BALANCES)) {
                log.debug("process " + userid);
                
                if(USER_BALANCES[userid].GBG.amount > global.MIN_AMOUNT 
                    || USER_BALANCES[userid].GOLOS.amount > global.MIN_AMOUNT) {
                    log.debug("check userid " + userid);
                    let known = await golos.checkUser(userid);
                    log.debug("userid " + known);
                    if(!known) {
                        refundUnknown(userid, USER_BALANCES[userid]);
                        continue;
                    }
                }
                
                if(global.settings.blacklistSponsors.includes(userid)) {
                    await refundBlacklisted(userid,  USER_BALANCES[userid]);
                    continue;
                }
                await notifyIncome(userid, USER_BALANCES[userid].GBG);
                await notifyIncome(userid, USER_BALANCES[userid].GOLOS);

                await honor(userid, USER_BALANCES[userid]);
            }
            MINBLOCK = scanner.lastBlock; //последний отсканированый блок

        } catch(e) {
            log.error("Error catched in main loop!");
            log.error(golos.getExceptionCause(e));
        }  

        await sleep(1000*60*2); //дать время пользователям поработать
    }
    log.err("broken loop");
    process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
