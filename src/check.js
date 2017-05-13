var golos = require("./golos");
var Scanner = require("./scanner");

var log = require("./logger").getLogger(__filename, 12);

const minBlock = 5916259;
const maxBlock = 5917639;

class Balances extends Scanner.Scanner {
    constructor() {
        super(null);
    }
        
    process(historyEntry) {
        let block = historyEntry[1].block;
        let id = historyEntry[0];
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        if(op == "transfer") {
            // Исходящий перевод - отнимаем от баланса
            if(opBody.from == "dobrobot") {
                
                let amount = parseFloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                //пример memo: userid благодарит за permlink 
                let userid = opBody.memo.split(" ")[0];
                if(block > minBlock && block < maxBlock) {
                    log.trace("csv\t" + userid + "\t" + "-" + amount.toFixed(3) + "\t" + currency + "\t" +  block);
                }
            }
        }
        return false;
    }    
}

async function checkGoodFlood()  {
    
    var scanner = new Balances("dobrobot", 5691376);
    await golos.scanUserHistory("dobrobot", scanner);
    
}

async function check() {
    var scanner = new Scanner.Balances("dobrobot", 5691376);
    await golos.scanUserHistory("dobrobot", scanner);
    
    let balances = scanner.balances;
    let users = Object.keys(balances);
    
    for(let userid of users) {
        log.info("balance " + String(userid + "                    ").substring(0,20) + " : " + balances[userid].toString());
    }
                
    process.exit(123);
}

check();

