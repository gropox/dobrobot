var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");

const MSG_ZERO_BALANCE = "Добро на балансе иссякло";
const MIN_AMOUNT = 0.001;
    
function getAmount(balance) {
s    
    let amount = {
        amount : 0,
        minTime : 0,
        currency : 0,
        zero : false
    };
    
    let currency = balance.GOLOS;
    if(currency.amount <= MIN_AMOUNT) {
        if(balance.GBG.amount > MIN_AMOUNT) {
            currency = balance.GBG
        }
    }
    
    //TODO
}

async function transferHonor(userid, balance) {

    let voteScanner = new Scanner.Votes(userid, amount.minTime);    
    await golos.scanUserHistory(userid, voteScanner);
    let votes = voteScanner.votes;
    
    votes.sort((a,b) => {
        return a.time - b.time;
    });
    
    for(let vote of votes) {
        if(global.settings.blacklist.includes(vote.author)) {
            continue;
        }
        
        let amount = getAmount(balance);
        if(amount > 0) {
            await golos.transfer(
        
        if(! await transfer(userid, balance, votes[i]) {
            //balance 0
            break;
        }
    }
}


async function honor(userid, balance) {
    
    //Do transfer
    let amount = getAmount(balance);
    
    if(amount.amount > 0) {
        amount = await transferHonor(userid, balance)
    }
    
    if(amount.zero) {
        await golos.transfer(userid, 0.001, amount.currency, MSG_ZERO_BALANCE);
    }
}


module.exports.run = async function() {
    
    while(true) {
        try {

            let balancesScanner = new Scanner.Balances();
            await golos.scanHistory(balancesScanner);
            
            let balances = balancesScanner.balances;
            let users = Object.keys(balances);
            
            for(int i = 0; i < users.length; i++) {
                await honor(users[i], balances[users[i]]);
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
