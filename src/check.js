var golos = require("./golos");
var Scanner = require("./scanner");
var log = require("./logger").getLogger(__filename, 12);



async function check() {
    var scanner = new Scanner.Balances("dobrobot", 5691376);
    await golos.scanUserHistory("dobrobot", scanner);
    
    let balances = scanner.balances;
    let users = Object.keys(balances);
    
    for(let userid of users) {
        log.info("balance " + userid + " : " + JSON.stringify(balances[userid]));
    }
                
    process.exit(123);
}


async function check() {
    var scanner = new Scanner.Balances("dobrobot", 5691376);
    await golos.scanUserHistory("dobrobot", scanner);
    
    let balances = scanner.balances;
    let users = Object.keys(balances);
    
    for(let userid of users) {
        log.info("balance " + userid + " : " + JSON.stringify(balances[userid]));
    }
                
    process.exit(123);
}


check();

