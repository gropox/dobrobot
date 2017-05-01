var global = require("./global");
var debug = require("debug");

let Logger = function(source, level) {
    console.log("construct logger for " + source);    
    let p = source.split(/[\/\\]/);
    this.s = p[p.length-1].split(".")[0];
    
    this._trc = debug("lotterybot:trc:" + this.s);
    this._dbg = debug("lotterybot:dbg:" + this.s);
    this._inf = debug("lotterybot:inf:" + this.s);
    this._wrn = debug("lotterybot:wrn:" + this.s);
    this._err = debug("lotterybot:err:" + this.s);

    if(typeof process.env.DEBUG == "undefined") {
        let dbgNamespace = "lotterybot:err* lotterybot:wrn* lotterybot:inf*";
        if(global.runtime.dl>0) {
            dbgNamespace = dbgNamespace + " lotterybot:dbg*";
        }       
        if(global.runtime.dl>1) {
            dbgNamespace = dbgNamespace + " lotterybot:trc*";
        }
        console.log("enable " + dbgNamespace);
        debug.enable(dbgNamespace);

    }
    
    this.trace = function(msg) {
        this._trc(msg);
    }
    
    this.debug = function(msg) {
        this._dbg(msg);
    }

    this.info = function(msg) {
        this._inf(msg);
    }

    this.warn = function(msg) {
        this._wrn(msg);
    }

    this.error = function(msg) {
        this._err(msg);
    }
}    
new Logger("f",0);
module.exports.getLogger = function (f,l) {
    return new Logger(f,l);
}

