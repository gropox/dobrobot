var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");

async function transfer(userid, balance, vote) {

    //Do transfer
    
}


async function honor(userid, balance) {

    let voteScanner = new Scanner.Votes(userid, balance);
    await golos.scanUserHistory(userid, voteScanner);
    let votes = voteScanner.votes;
    
    votes.sort((a,b) => {
        return a.time - b.time;
    });
    
    for(int i = 0; i < votes.length; i++) {
    
        if(! await transfer(userid, balance, votes[i]) {
            //balance 0
            break;
        }
        
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
            
                if(balances[users[i]].GBG.amount > 0 
                    || balances[users[i]].GOLOS.amount > 0) {
                    await honor(users[i], balances[users[i]]);
                }
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
