var golos = require("./golos");
var Scanner = require("./scanner");

async function check() {
    var scanner = new Scanner.Balances("dobrobot", 5691376);
    await golos.scanUserHistory("dobrobot", scanner);
    process.exit(123);
}

check();

