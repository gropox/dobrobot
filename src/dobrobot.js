var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var golosjs = require("golos-js");
var Scanner = require("./scanner");
var balancer = require("./balancer");

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
        log.debug("GOLOS = " + (amount.currency == balancer.CURRENCY.GOLOS));
        
        if(amount.amount > global.MIN_AMOUNT && 
                amount.currency == balancer.CURRENCY.GOLOS && 
                (amount.opt.isSanchita() || amount.opt.isPrarabdha())) {
            let reduce = global.MIN_AMOUNT;
            if(amount.opt.isPrarabdha()) {
                reduce = parseFloat((amount.amount / 2.0).toFixed(3));
            }
            let amk = amount.amount - reduce;
            amount.amount = reduce;
            await golos.transferKarma(vote.author, amk);
            balance.GOLOS.reduce(amk);
            await sleep(1000 * 6); //let transfer mature
            text = `${userid} поднял вам карму за ваш пост/комментарий ${vote.permlink}`;
        }
        await golos.transfer(vote.author, amount.amount, amount.currency, text);
        balance[amount.currency].reduce(amount.amount);
        
    }
    if(amount.zero) {
        await golos.transfer(userid, global.MIN_AMOUNT, amount.currency, `${userid} добро на вашем балансе иссякло`);
        balance[amount.currency].reduce(global.MIN_AMOUNT);
    }
}

async function createCheckpoint() {
    await golos.createSavepoint(USER_BALANCES);
}

/**
 * перевод денег пользователям из черного списка. 
 */
async function refundBlacklisted(userid, balance) {
    log.info("\tsponsor blacklisted, refund");
    let to = userid;
    if(balance.GOLOS.amount >= global.MIN_AMOUNT) {
        if(balance.GOLOS.incomeUserId) {
            to = balance.GOLOS.incomeUserId;
        }
        await golos.transfer(to, balance.GOLOS.amount, balance.GOLOS.name, userid + " в черном списке");
        balance.GOLOS.reduce(bal.GOLOS.amount);
    }
    if(balance.GBG.amount >= global.MIN_AMOUNT) {
        if(balance.GBG.incomeUserId) {
            to = balance.GBG.incomeUserId;
        }
        await golos.transfer(to, balance.GBG.amount, balance.GBG.name, userid + " в черном списке");
        balance.GBG.reduce(balance.GBG.amount);
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
            bal.GOLOS.reduce(bal.GOLOS.amount);
        }
    }
    if(bal.GBG.amount >= global.MIN_AMOUNT) {
        if(bal.GBG.incomeUserId) {
            to = bal.GBG.incomeUserId;
            await golos.transfer(to, bal.GBG.amount, bal.GBG.name, userid + " - несуществующий аккаунт");
            bal.GBG.reduce(bal.GBG.amount);
        }
    }
}

async function notifyIncome(userid, currency) {
    if(currency.income && currency.amount >= global.MIN_AMOUNT) {
        let sum = currency.amount - global.MIN_AMOUNT;
        await golos.transfer(userid, global.MIN_AMOUNT, currency.name, 
            `${userid} Ваш баланс добра был пополнен, сумма = ${sum.toFixed(3)} ${currency.name}, опции = ${currency.opt.toString()}`);
        currency.reduce(global.MIN_AMOUNT);
    }
}

async function readBalances() {
    let balancesScanner = new Scanner.Balances(global.settings.dobrobot, global.settings.minBlock);

    await golos.scanHistory(balancesScanner);

    for(tv of balancesScanner.transfer_to_vesting) {
        log.warn("unused transfer to vesting " + JSON.stringify(tv));
    }

    balancer.dump();
}

async function processOpVote(vote, block) {
    let balance = balancer.getUserBalance(vote.voter);
    if(!balance) {
        log.trace(vote.voter + " has no balance!");
        return;
    }

    if(!balance.isAvailable()) {
        log.trace(vote.voter + " has not enough on balance!");
        return;
    }
    log.info(vote.voter + " balance before : " + balance.toString());

    log.info(block + ": " + "process vote of "+ vote.voter + " for " + vote.author + "/" + vote.permlink );
    
    let userRep = await golos.getReputation(vote.author);
    await processVote(vote.voter, userRep, balance, vote);
    log.info(vote.voter + " balance after  : " + balance.toString());
}

async function processOpTransfer(transfer, block) {
    log.info(block + ": " + "process incoming transfer from  "+ transfer.from + " amount " + transfer.amount + " memo " + transfer.memo );
    let income = Scanner.processIncoming(transfer, block);
    let balance = balancer.getUserBalance(income.userid)
    log.info(income.userid + " balance before : " + balance.toString());
    if(!await golos.getAccount(income.userid)) {
        await refundUnknown(income.userid, balance);
    }
    await notifyIncome(income.userid, balance[income.currency]);
    log.info(income.userid + " balance after  : " + balance.toString());
}

async function processBlock(bn) {
    log.debug("processing block " + bn);
    let transactions = await golosjs.api.getOpsInBlockAsync(bn, false);
    //log.debug(JSON.stringify(transactions));
    for(let tr of transactions) {
        let op = tr.op[0];
        let opBody = tr.op[1];
        switch(op) {
            case "vote":
                if(opBody.weight > 0 && opBody.voter != opBody.author) {
                    log.trace("tr " + JSON.stringify(tr));
                    await processOpVote(opBody, bn);
                }
                break;
            case "transfer":
                if(opBody.to == global.settings.dobrobot) {
                    log.trace("tr " + JSON.stringify(tr));
                    await processOpTransfer(opBody, bn)
                }   
                break;
        }
    }              
}

async function cleanupBalance(users) {
    users.sort();
    for(let userid of users) {
        let balance = balancer.getUserBalance(userid)
        if(balance.isAvailable() && !await golos.getAccount(userid)) {
            await refundUnknown(userid, balance);
        }
    }
}

module.exports.run = async function() {
    
    let props = await golos.getCurrentServerTimeAndBlock();
    let currentBlock = props.block;

    await readBalances();
    await cleanupBalance(balancer.getUsers());

    while(true) {
        try {

            props = await golos.getCurrentServerTimeAndBlock();

            if(props.block < currentBlock) {
                //log.info(`no new blocks, skip round`);
                await sleep(1000*6);
                continue;
            }

            await processBlock(currentBlock++);

        } catch(e) {
            log.error("Error catched in main loop!");
            log.error(golos.getExceptionCause(e));
        }  
    } 
    process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
