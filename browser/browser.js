
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

const EXCLUDED_USERID = ["robot"];

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
    
    var scanner = new Balances(dobrobot,minBlock);
    
    function getOpts(stack) {
    
        let ret = "";
        let comma = "";
        for(let o of stack.stack) {
            if(OPTIONS.APV == o.type) {
                ret += comma + OPTIONS.APV + "=" + o.val;
                comma = "<br/>";
            } else {
                ret += comma + o.type;
                comma = "<br/>";
            }
        }
        return ret;
    }
    
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
        <th>Блок последнего перевода</th>
       </tr>
`;
       
        for(let userid of Object.keys(scanner.balances).sort()) {
            if(EXCLUDED_USERID.includes(userid)) {
                continue;
            }
            console.log(userid + " = " + JSON.stringify(scanner.balances[userid]));
            let bal = scanner.balances[userid];
            if(nonzero) {
                if(bal.GOLOS.amount < 0.001 && bal.GOLOS.amount > -0.001
                   && bal.GBG.amount < 0.001 && bal.GBG.amount > -0.001
                ) {
                    continue;
                }
            }
            html += `
<tr>
    <td valign="top">${userid}</td>
    <td valign="top">${bal.GOLOS.amount.toFixed(3)}</td>
    <td valign="top">${getOpts(bal.GOLOS.opt)}</td>
    <td valign="top">${bal.GBG.amount.toFixed(3)}</td>
    <td valign="top">${getOpts(bal.GBG.opt)}</td>
    <td valign="top">${bal.minTime}</td>
</tr>
`;
        }
        html += "</table>";
        balance.innerHTML = html;
    }
    
    function readHistory(end) {
    
        //read in blocks of 1000 elements
        var count = Math.min((end), 500);
        console.log("read history ending by " + end + " count = " + count);
        steem.api.getAccountHistory(dobrobot, end, count, function(err, result) {
            if(err) {
                console.error("Ошибка чтения истории!", err);
            } else {
                console.log("\nREAD history block");
                for(var i = 0; i < result.length; i++, end--) {
                    scanner.process(result[i]);
                }
                drawBalances();
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
