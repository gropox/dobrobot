var global = require("./global");
var log = require("./logger").getLogger(__filename);
var golos = require("./golos");
var Scanner = require("./scanner");
var options = require("./options");
var fs = require("fs");

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
    
    calcSumIn(price) {
        return this.GOLOS.payIn + this.vesting + 
        (this.GBG.payIn / price);
    }
    
}
    

class AuthorStats {
    constructor(userid) {
        this.userid = userid;
        this.GBG = new Currency("GBG");
        this.GOLOS = new Currency("GOLOS");
        this.vesting = 0;
    }
    
    calcSumIn(price) {
        return this.GOLOS.payIn + this.vesting +
        (this.GBG.payIn / price);
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
    
    calcSumOut(price) {
        return this.GOLOS.payOut + 
        (this.GBG.payOut / price);
    }
    calcSumIn(price) {
        return this.GOLOS.payIn + 
        (this.GBG.payIn / price);
    }
    
}

class Report extends Scanner.Scanner {
    constructor(currentTime) {
        super();
        this.currentTime = currentTime;
        this.transfer_to_vesting = [];

        this.stats = {
            GBG : new Currency("GBG"),
            GOLOS : new Currency("GOLOS"),
            allVesting : 0,
            users : {},
            authors : {},
            posts : {},
        }
    }

    process(historyEntry) {
        let block = historyEntry[1].block;
        let time = Date.parse(historyEntry[1].timestamp);
        if(time < (this.currentTime - REPORT_DURATION)) {
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
                this.handleTransferToVesting(opBody);
                break;
        }
    }
    
    updateUserStats(userid, amount, currency, curator, vesting) {
        let userStats = this.stats.users[userid];
        if(!userStats) {
            userStats = new UserStats(userid);
            this.stats.users[userid] = userStats;
        }
        userStats.addCurator(curator);
        if(amount < 0) {
            if(vesting) {
                userStats.vesting += Math.abs(amount);
            } else {
                userStats[currency].payOut += Math.abs(amount);
            }    
            this.stats[currency].payOut += Math.abs(amount); 
        } else {
            this.stats[currency].payIn += Math.abs(amount); 
            userStats[currency].payIn += Math.abs(amount);
        }
    }
    
    updateAuthorStats(userid, amount, currency, vesting) {
        let authorStats = this.stats.authors[userid];
        if(!authorStats) {
            authorStats = new AuthorStats(userid);
            this.stats.authors[userid] = authorStats;
        }
                
        if(vesting) {
            this.stats.allVesting += Math.abs(amount);
            authorStats.vesting += Math.abs(amount);
        } else {
            authorStats[currency].payIn += Math.abs(amount);
        }
    }

    updatePostStats(author, permlink, amount, currency, vesting) {
        let link = author + "/" + permlink;
        
        let postStats = this.stats.posts[link];
        if(!postStats) {
            postStats = new PostStats(author, permlink);
            this.stats.posts[link] = postStats;
        }
                
        if(vesting) {
            postStats.vesting += Math.abs(amount);
        } else {
            postStats[currency].payIn += Math.abs(amount);
        }
    }
    
    handleTransferToVesting(ttv) {
        if(ttv.from == global.settings.dobrobot) {
            log.trace("ttv = " + ttv.to + " " + ttv.amount);
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

                    this.updateUserStats(userid, -1 * va, currency, true);
                    this.updateAuthorStats(transfer.to, va, currency,  true);
                    this.updatePostStats(transfer.to, permlink, va, currency, true);
                    
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


function printMostPayOut(stats, price) {
    let ret = "";
    let users = Object.keys(stats.users);
    users.sort((a,b) => {
        return stats.users[b].calcSumOut(price) - stats.users[a].calcSumOut(price);
    });
    
    for(var i = 0; i < users.length && i < 20; i++) {
        let us = stats.users[users[i]];

        ret += `@${us.userid} | ${us.GOLOS.payOut.toFixed(3)} | ${us.GBG.payOut.toFixed(3)} | ${us.vesting.toFixed(3)}
`;
    }
    return ret;
}

function getCurators(curators) {
    if(curators.length > 0) {
        return "@" + curators.join(", @");
    } else {
        return "&nbsp;";
    }    
}

function printMostPayIn(stats, price) {
    let ret = "";
    let users = Object.keys(stats.users);
    users.sort((a,b) => {
        return stats.users[b].calcSumIn(price) - stats.users[a].calcSumIn(price);
    });
    
    for(var i = 0; i < users.length && i < 20; i++) {
        let us = stats.users[users[i]];

        ret += `@${us.userid} | ${us.GOLOS.payIn.toFixed(3)} | ${us.GBG.payIn.toFixed(3)} | ${getCurators(us.curators)}
`;
    }
    return ret;
}

function printMostPayedAuthors(stats, price) {
    let ret = "";
    let authors = Object.keys(stats.authors);
    authors.sort((a,b) => {
        return stats.authors[b].calcSumIn(price) - stats.authors[a].calcSumIn(price);
    });
    
    for(var i = 0; i < authors.length && i < 20; i++) {
        let us = stats.authors[authors[i]];

        ret += `@${us.userid} | ${us.GOLOS.payIn.toFixed(3)} | ${us.GBG.payIn.toFixed(3)} | ${us.vesting.toFixed(3)}
`;
    }
    return ret;
}

async function printMostPayedPosts(stats, price) {
    let ret = "";
    let posts = Object.keys(stats.posts);
    posts.sort((a,b) => {
        return stats.posts[b].calcSumIn(price) - stats.posts[a].calcSumIn(price);
    });
    
    for(var i = 0; i < posts.length && i < 20; i++) {
        let us = stats.posts[posts[i]];

        let content = await golos.getContent(us.author, us.permlink);
        if(null == content) {
            continue;
        }
        ret += `@${us.author} | [${content.title}](${global.settings.golos_host}/@${posts[i]}) | ${us.GOLOS.payIn.toFixed(3)} | ${us.GBG.payIn.toFixed(3)} | ${us.vesting.toFixed(3)}
`;
    }
    return ret;
}

async function doReport() {
    let price = await golos.getGolosPrice();
    log.debug("GOLOS price = " + price.toFixed(3));

    let curr = await golos.getCurrentServerTimeAndBlock();
    let scanner = new Report(curr.time);

    await golos.scanHistory(scanner);
    //log.debug(JSON.stringify(scanner.stats.users, null, 4));
        
    await printStats(scanner.stats, price);
}        

async function printStats(stats, price) {
    stats.GOLOS.payIn.toFixed(3);
    stats.GBG.payIn.toFixed(3);
    stats.GOLOS.payOut.toFixed(3);
    stats.GBG.payIn.toFixed(3);
    stats.allVesting.toFixed(3);
    
    let message = `
# Недельная статистика по доброботу

Всего было перечислено доброботу ${stats.GOLOS.payIn.toFixed(3)} GOLOS и ${stats.GBG.payIn.toFixed(3)} GBG. Добробот в свою очередь перечислил ${stats.GOLOS.payOut.toFixed(3)} GOLOS и ${stats.GBG.payOut.toFixed(3)} GBG добра и увеличил силу голоса на общую сумму ${stats.allVesting.toFixed(3)} GOLOS.  

## 20 Пользователей, больше всего перечисливших доброботу

Пользователь | Голоса | Золотые | Кураторы
- | - | - | -
${printMostPayIn(stats, price)}

## 20 Кураторов, больше всего перечисливших добро авторам 

Пользователь | Голоса | Золотые | Сила Голоса
- | - | - | -
${printMostPayOut(stats, price)}
 
## 20 Авторов, больше всего получивших вознаграждений 

Автор | Голоса | Золотые | Сила Голоса
- | - | - | -
${printMostPayedAuthors(stats, price)}

## 20 Постов, больше всего получивших вознаграждений 

Автор | Пост | Голоса | Золотые | Сила Голоса
- | - | - | - | -
${await printMostPayedPosts(stats, price)}

Для сортировки таблиц золотые были переведены в голоса по актуальному на данный момент курсу ${price.toFixed(3)}.

`;
   log.debug(message);
   writeDebug(message);
}

function writeDebug(message) {
    let file = "/tmp/dobrobot_report.txt";
    fs.writeFile(file, message, function(err) {
        if(err) {
            return console.log(err);
        }
    });         
}

doReport();
    
