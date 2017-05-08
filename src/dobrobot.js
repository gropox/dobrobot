var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var Scanner = require("./scanner");
var balancer = require("./balancer");

async function transferHonor(userid, balance) {

    let voteScanner = new Scanner.Votes(userid, balance.minBlock);    
    await golos.scanUserHistory(userid, voteScanner);
    let votes = voteScanner.votes;
    
    votes.sort((a,b) => {
        return a.block - b.block;
    });
    
    for(let vote of votes) {
        if(vote.weight <= 0) {
            log.debug("flag found " + vote.author + "/" + vote.permlink);
        }
        if(global.settings.ignorelistAuthors.includes(vote.author)) {
            log.info("author blacklisted " + vote.author + "/" + vote.permlink);
            continue;
        }
        
        let amount = balancer.getAmount(balance, vote.weight / 100);
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

async function getBalances() {
    let balancesScanner = new Scanner.Balances();
    await golos.scanHistory(balancesScanner);
    
    return balancesScanner.balances;
}

async function refund(userid, bal) {
    log.info("\tsponsor blacklisted, refund");

    if(bal.GOLOS.amount >= MIN_AMOUNT) {
        await golos.transfer(userid, bal.GOLOS.amount, "GOLOS", userid + " Возврат");
    }
    if(bal.GBG.amount >= MIN_AMOUNT) {
        await golos.transfer(userid, bal.GBG.amount, "GBG", userid + " Возврат");
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
Scan for balances
#################
`);
            let balances await getBalances();
            
            let users = Object.keys(balances);
            
            for(let userid of users) {
                log.info("balance " + userid + " : " + JSON.stringify(balances[userid]));
            }
            
            for(let userid of users) {
                log.debug("process " + userid);
                if(global.settings.blacklistSponsors.includes(userid)) {
                    refund(userid,  balances[userid]);
                    continue;
                }
                await honor(userid, balances[userid]);
            }
            
        } catch(e) {
            log.error("Error catched in main loop!");
            log.error(golos.getExceptionCause(e));
        }  

        await sleep(1000*61*3); //sleep 5 minutes   
    }
    log.err("broken loop");
    process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
