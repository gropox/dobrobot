var log = require("./logger").getLogger(__filename, 12);
var Scanner = require("./scanner");
var golos = require("./golos");


async function test() {
    try {
        var bs = new Scanner.Balances("dobrobot", 5691376);
        await golos.scanUserHistory("dobrobot", bs);
        
        for(let u of Object.keys(bs.balances)) {
            let b = bs.balances[u];
            if(b.GOLOS.amount < 0 || b.GBG.amount < 0) {
                log.debug(u + " : " + JSON.stringify(bs.balances[u]));
            }
        }
    } catch(e) {
        log.error(e);
        
    }
    process.exit(1);
}    


test();

