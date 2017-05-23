var log = require("./logger").getLogger(__filename);
var global = require("./global");
class Option {
    constructor(type, val, block) {
        this.type = type;
        this.val = val;
        this.block = block;
    }
}

const OPTIONS = {
    APV : "д/г",
    STOP : "стоп",
    START : "старт",
    WHALE: "кит",
    FISH: "рыба",
    SANCHITA: "санчита",
    KRIYAMANA: "криямана",    
    PRARADBHA: "прарабдха",
    CURATOR: "куратор",
    MOTH: "мот"
};

function checkSwitch(o, option, types) {
    return (types.includes(o.type) && types.includes(option.type))
}


function getStackIndex(stack, option) {
    for(let i = 0; i < stack.length; i++) {
        if(checkSwitch(stack[i], option, [OPTIONS.STOP, OPTIONS.START])) {
            return i;
        } else if(checkSwitch(stack[i], option, [OPTIONS.WHALE, OPTIONS.FISH])) {
            return i;
        } else if(checkSwitch(stack[i], option, [OPTIONS.SANCHITA, OPTIONS.KRIYAMANA, OPTIONS.PRARADBHA])) {
            return i;
        } else {
            if(stack[i].type == option.type) {
                return i;
            }
        }
    }
}

function buildOption(opt, block) {
    //switches
    switch(opt) {
        case "/старт": return new Option(OPTIONS.START, opt, block);
        case "/стоп": return new Option(OPTIONS.STOP, opt, block);
        
        case "/кит": return new Option(OPTIONS.WHALE, opt, block);
        case "/рыба": return new Option(OPTIONS.FISH, opt, block);

        case "/санчита": return new Option(OPTIONS.SANCHITA, opt, block);
        case "/криямана": return new Option(OPTIONS.KRIYAMANA, opt, block);
        case "/прарабдха": return new Option(OPTIONS.PRARADBHA, opt, block);
        
        case "/куратор": return new Option(OPTIONS.CURATOR, opt, block);
        case "/мот": return new Option(OPTIONS.MOTH, opt, block);        
    }
    
    //apv
    if(!isNaN(opt)) {
        return new Option(OPTIONS.APV, parseFloat(opt), block);
    }
    
    return null;
}

class OptStack {
    constructor() {
        this.stack = [];
        this.push("/кит", 0); //по умолчанию все киты
        this.push("/куратор", 0); //по умолчанию все кураторы
    }

    push(opt, block) {
        
        function stackOption(ops, opt, block) {
            let stack = ops.stack;
            let option = buildOption(opt, block);
            if(option) {
                let update = false;
                
                let idx = getStackIndex(stack, option);
                if(idx < stack.length) {
                    if(stack[idx].block < option.block) {
                        stack[idx] = option;
                        update = true;
                    }
                } else {
                    stack.push(option);
                    update = true;
                }
                if(update && option.type == OPTIONS.APV) {
                    ops.push("/старт", block);
                }
            }
        }        
        
        stackOption(this, opt, block);
    }
    
    getAPV() {
        let apv = global.MIN_AMOUNT;
        
        for( let o of this.stack) {
            if(o.type == OPTIONS.APV) {
                apv = o.val;
                break;
            }
        }
        return apv;
    }
    
    getAmountPerVote(w) {
        if(!this.isActive()) {
            throw "RuntimeException: currency is not active!";
        }
        
        let weight = 100.0;
        if(w && !isNaN(w)) {
            weight = parseFloat(w);
        }
        
        let apv = this.getAPV();
        
        if(this.isWeighted()) {
            apv =  parseFloat((apv * weight / 100.0).toFixed(3));
        }
        return apv;
    }

    isWeighted() {
        for( let o of this.stack) {
            if(o.type == OPTIONS.FISH) {
                return true;
            }
        }
        return false;
    }    
    
    isSanchita() {
        for( let o of this.stack) {
            if(o.type == OPTIONS.SANCHITA) {
                return true;
            }
        }
        return false;
    }    

    isPrarabdha() {
        for( let o of this.stack) {
            if(o.type == OPTIONS.PRARADBHA) {
                return true;
            }
        }
        return false;
    }
    
    isCurator() {
        for( let o of this.stack) {
            if(o.type == OPTIONS.CURATOR) {
                return true;
            }
        }
        return false;
    }
    
    isActive() {
        let active = true; 
        for( let o of this.stack) {
            if(o.type == OPTIONS.STOP) {
                return false;
            }
        }
        return active;
    }
}

function isUserTransfer(opt) {
    return opt.match(/^@([a-z][-\.a-z\d]+[a-z\d])$/);
}

OptStack.OPTIONS = OPTIONS;
OptStack.isUserTransfer = isUserTransfer;

module.exports = OptStack;

if(!(typeof window === "undefined")) {
    window.OPTIONS = OPTIONS;
}
