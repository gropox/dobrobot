
function recoverData() {
    
    let recoverName = true;
    let recoverBlock = true;
	//console.log("updateValues = " + JSON.stringify(site));     
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    
    if(vars["dobrobot"]) {
        recoverName = false;
        document.getElementById("dobrobot").value = vars["dobrobot"];
    }    
    if(vars["minBlock"]) {
        recoverBlock = false;
        document.getElementById("minBlock").value = vars["minBlock"];
    }    
    
    if(recoverName) {
        let dobrobot = document.getElementById("dobrobot");
        dobrobot.value = localStorage.getItem("dobrobot");
    }
    if(recoverBlock) {
        let minBlock = document.getElementById("minBlock");
        minBlock.value = localStorage.getItem("minBlock");
    }
}


function scanHistory() {
    console.log("scanning history");
    
    steem.api.setWebSocket(golos_ws);
    
    var dobrobot = document.getElementById("dobrobot").value;
    var minBlock = document.getElementById("minBlock").value;
    var nonzero = document.getElementById("nonzero").checked;
    
    localStorage.setItem("dobrobot", dobrobot);
    localStorage.setItem("minBlock", minBlock);
    
    if(typeof dobrobot == "undefined" || dobrobot == "") {
        alert("Введите имя пользователя dobrobot!");
        return;
    }
    
    var balances = {};
    
    function drawBalances() {
        console.log("\n\n");
        
        let balance = document.getElementById("balance");
        
        let html = `
       <table> 
       <tr>
        <th>Пользователь</th>
        <th>Голоса (GOLOS)</th>
        <th>Опция для раздачи Голосов</th>
        <th>Золотые (GBG)</th>
        <th>Опция для раздачи Золотых</th>
        <th>Время последнего перевода</th>
       </tr>
`;
       
        for(let userid of Object.keys(balances).sort()) {
            console.log(userid + " = " + JSON.stringify(balances[userid]));
            let bal = balances[userid];
            if(nonzero) {
                if(bal.GOLOS.amount < 0.001 && bal.GOLOS.amount > -0.001
                   && bal.GBG.amount < 0.001 && bal.GBG.amount > -0.001
                ) {
                    continue;
                }
            }
            html += `
<tr>
    <td>${userid}</td>
    <td>${bal.GOLOS.amount.toFixed(3)}</td>
    <td>${bal.GOLOS.opt}</td>
    <td>${bal.GBG.amount.toFixed(3)}</td>
    <td>${bal.GBG.opt}</td>
    <td>${bal.minTime}</td>
</tr>
`;
        }
        html += "</table>";
        balance.innerHTML = html;
    }
    
    function plus(userid, amount, currency, time, opt) {
        
        if(balances[userid]) {
        } else {
            balances[userid] = {
                minTime: 0,
                GOLOS : {
                    amount : 0, 
                    opt : 1
                },
                GBG : {
                    amount : 0, 
                    opt : 1
                }
            };
        }
        
        balances[userid][currency].amount += amount;

        if(balances[userid].minTime < time) {
            balances[userid].minTime = time;
            // Если в memo входящего переводы было число, 
            // считаем его как  amount per vote
            if(opt) {
                balances[userid][currency].opt = opt;
            }
        }
    }
    
    function minus(userid, amount, currency, payoutTime) {
        plus(userid, -1 * amount, currency, payoutTime, null);
    }
    
    function updateBalance(historyEntry) {
        let time =  Date.parse(historyEntry[1].timestamp);
        let block = historyEntry[1].block;
        if(block <= minBlock) {
            //Неучитывать данные после релиза
            return true;
        }
        let id = historyEntry[0];
        let op = historyEntry[1].op[0];
        let opBody = historyEntry[1].op[1];
        
        if(op == "transfer") {
            // Исходящий перевод - отнимаем от баланса
            if(opBody.from == dobrobot) {
                
                let amount = parseFloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                //пример memo: userid благодарит за permlink 
                let userid = opBody.memo.split(" ")[0];

                console.log("\tfound payout to " + userid + ", amount = " + amount.toFixed(3) + " " + currency );
                console.log(userid + "\t" + "-" + amount.toFixed(3) + "\t" + currency);
                minus(userid, amount, currency, time);
            }
            
            // Входящий перевод - прибавляем к балансу
            if(opBody.to == dobrobot) {
                let amount = parseFloat(opBody.amount.split(" ")[0]);
                let currency = opBody.amount.split(" ")[1];
                let opt = opBody.memo;
                let userid = opBody.from;
                console.log("\tfound payin from " + userid + ", amount = " + amount.toFixed(3) + " " + currency + "(" + opt + ")");
                console.log(userid + "\t" + "+" + amount.toFixed(3) + "\t" + currency);
                plus(userid, amount, currency, time, opt);

            }
        }
    }
    
    
    function readHistory(end) {
    
        //read in blocks of 1000 elements
        var count = Math.min((end), 1000);
        console.log("read history ending by " + end + " count = " + count);
        steem.api.getAccountHistory(dobrobot, end, count, function(err, result) {
            if(err) {
                console.error("Ошибка чтения истории!", err);
            } else {
                for(var i = 0; i < result.length; i++, end--) {
                    updateBalance(result[i]);
                    drawBalances();
                }
            }
        });
    }
    
    steem.api.getAccountHistory(dobrobot, -1, 0, function(err, result) {
        
        if(err) {
            console.error("Ошибка чтения истории!", err);
        } else {
            let lastId = result[0][0];    
            readHistory(lastId);        
        }
    });
}
