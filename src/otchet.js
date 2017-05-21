var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var Scanner = require("./scanner");
var options = require("./options");

const REPORT_DURATION = 1000 * 60 * 60 * 24 * 7; //one week


class FindLastReport extends Scanner.Scanner {
    constructor() {
        super();
        this.farEnough = true;
    }
    
    process(historyEntry) {
        let block = historyEntry[1].block;
        return (block <= 5919329);
    }
}

class Currency {
   constructor(name) {
        this.name = name;
        this.payIn = 0;
        this.payOut = 0;
    }    
}

class PostStats {
    constructor(author, permlink) {
        this.author =  author;
        this.permlink = permlink;
        this.GBG = new Currency("GBG");
        this.GOLOS = new Currency("GOLOS");
        this.vesting = 0;
    }
}
    

class AuthorStats {
    constructor() {
        this.GBG = new Currency("GBG");
        this.GOLOS = new Currency("GOLOS");
        this.vesting = 0;
    }
}

class UserStats {
    constructor(userid) {
        this.userid = userid;
        this.GBG = new Currency("GBG");
        this.GOLOS = new Currency("GOLOS");
        this.vesting = 0;
        this.curators = [];
    }
    
    addCurator(curator) {
        if(curator && curator != this.userid && !this.curators.includes(curator)) {
            this.curators.push(curator);
        }
    }
}

class Report extends Scanner.Scanner {
    constructor(currentTime) {
        super();
        this.currentTime = currentTime;
        this.transfer_to_vesting = [];

        this.stats = {
            allPayIn :  0,
            allPayOut : 0,
            allVesting : 0,
            users : {},
            authors : {},
            posts : {},
        }
    }

    process(historyEntry) {
        let block = historyEntry[1].block;
        let time = Date.parse(historyEntry[1].time);

        if(time < this.currentTime - REPORT_DURATION) {
            return true;
        }
                    
        let id = historyEntry[0];
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        
        switch(op) {
            case "transfer" :
                this.handleTransfer(opBody);
                break;
            case "transfer_to_vesting":
                this.   handleTransferToVesting(opBody);
                break;
        }
    }
    
    updateUserStats(userid, amount, currency, curator) {
        let userStats = this.stats.users[userid];
        if(!userStats) {
            userStats = new UserStats();
            this.stats.users[userid] = userStats;
        }
        userStats.addCurator(curator);
        if(amount < 0)  {
            userStats[currency].payOut += Math.abs(amount);
        } else {
            userStats[currency].payIn += Math.abs(amount);
        }
    }
    
    updateAuthorStats(userid, amount, currency) {
        let authorStats = this.stats.authors[userid];
        if(!authorStats) {
            authorStats = new AuthorStats();
            this.stats.authors[userid] = authorStats;
        }
                
        if(amount < 0)  {
            authorStats[currency].payOut += Math.abs(amount);
        } else {
            authorStats[currency].payIn += Math.abs(amount);
        }
    }

    updatePostStats(author, permlink, amount, currency) {
        let link = author + "/" + permlink;
        
        let postStats = this.stats.posts[link];
        if(!postStats) {
            postStats = new PostStats(author, permlink);
            this.stats.posts[link] = postStats;
        }
                
        if(amount < 0)  {
            postStats[currency].payOut += Math.abs(amount);
        } else {
            postStats[currency].payIn += Math.abs(amount);
        }
    }
    
    handleTransferToVesting(ttv) {
        if(ttv.from == this.dobrobot) {
            this.transfer_to_vesting.push(ttv);
        }
    }

    handleTransfer(transfer) {
        if(transfer.from == global.settings.dobrobot) {
            let amount = parseFloat(transfer.amount.split(" ")[0]);
            let currency = transfer.amount.split(" ")[1];

            let memo = transfer.memo.split(" ");
            let userid = memo[0];
            let permlink = memo[memo.length-1];
            
            //check vesting
            var trVesting = this.transfer_to_vesting.pop();
            if(trVesting) {
                if(trVesting.to = transfer.to) {
                    let va = parseFloat(trVesting.amount.split(" ")[0]);
                    amount += va;
                } else {
                    this.transfer_to_vesting.push(trVesting);
                }
            }

            log.trace("\tfound payout to " + userid + ", amount = " + amount.toFixed(3) + " " + currency );

            this.updateUserStats(userid, -1 * amount, currency);
            this.updateAuthorStats(transfer.to, amount, currency);
            this.updatePostStats(transfer.to, permlink, amount, currency);
        } else {
            let amount = parseFloat(transfer.amount.split(" ")[0]);
            let currency = transfer.amount.split(" ")[1];
            let opt = transfer.memo;
            let userid = transfer.from;
            let m = options.isUserTransfer(opt);
            let curator = null;
            if(m) {
                curator = m[1];
            }
            log.trace("\tfound payin from " + userid + ", amount = " + amount.toFixed(3) + " " + currency + "(" + opt + ")");
            this.updateUserStats(userid, amount, currency, curator);
        }
        
    }
}


async function doReport() {
    let curr = await golos.getCurrentServerTimeAndBlock();
    let scanner = new Report(curr.time);

    await golos.scanHistory(scanner);
    
    log.debug(JSON.stringify(scanner.stats, null, 4));
}        


doReport();
    
