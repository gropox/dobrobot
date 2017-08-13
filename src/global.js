var dateFormat = require('dateformat');

module.exports.MIN_AMOUNT = 0.001;

module.exports.runtime = {
    dl : 0
}

module.exports.SAVEPOINT = "balance";

if(typeof window == "undefined") {

    var fs = require("fs");


    function getConfigDir() {
        if(process.env.CONFIGDIR) {
            return process.env.CONFIGDIR;
        } else {
            return require('os').homedir();
        }
    }

    const CONFIG_DIR = getConfigDir();
    const CONFIG_FILE = CONFIG_DIR + "/dobrobot.js";


    module.exports.settings = {
        golos_host : "https://golos.io",
        golos_websocket : "wss://ws.golos.io",
        broadcast : false,
        dobrobot : "testuser",
        dobrobotActiveKey : "5df47f4f4f",
        minBlock : 0,
        chain_id : "782a3039b478c839e4cb0c941ff4eaeb7df40bdd68bd441afd444b9da763de12",
        ignorelistAuthors : ["golos.loto", "lotobot", "habreplicator"],
        blacklistSponsors : ["znation", "anyone"]
    };


    function init() {
        //Load setting Object
        try {
            let sets = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
            module.exports.settings = sets;  
            //console.log("loaded settings:\n" + JSON.stringify(module.exports.settings, null, 4));     
        } catch(e) {
            console.warn("unable to read config (" + CONFIG_FILE + ")");
            try {
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(module.exports.settings, null, 4), "utf8");
            } catch(e) {
                console.error("unable to create dummy config (" + CONFIG_FILE + ")");
            }
        }
    }


    module.exports.formatDateTime = function(ms) {
        var options = {

        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timezone: 'UTC',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
        };
        
        return dateFormat(new Date(ms), "dd.mm.yyyy h:MM:ss");
    }

    module.exports.isBlacklisted = function(userid) {
        
        if(module.exports.settings.blacklist) {
            return module.exports.settings.blacklist.includes(userid);
        }
        return false;
    }

    init();
}
