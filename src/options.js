var log = require("./logger").getLogger(__filename);

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
    }
    
    //apv
    if(!isNaN(opt)) {
        return new Option(OPTIONS.APV, parseFloat(opt), block);
    }
    
    //остановить бота, по незнакомой команде.
    return new Option(OPTIONS.STOP, opt, block);
}

class OptStack {
    constructor() {
        this.stack = [];
        this.push("/кит", 0); //по умолчанию все киты
    }

    push(opt, block) {
        
        function stackOption(ops, opt, block) {
            let stack = ops.stack;
            let option = buildOption(opt, block);
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
        
        stackOption(this, opt, block);
    }
    
    getAmountPerVote(w) {
        if(!this.isActive()) {
            throw "RuntimeException: currency is not active!";
        }
        
        let weight = 100.0;
        if(w && !isNaN(w)) {
            weight = parseFloat(w);
        }
        
        let apv = null;
        
        for( let o of this.stack) {
            if(o.type == OPTIONS.APV) {
                apv = o.val;
                break;
            }
        }
        
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
    
    isActive() {
        let active = false; 
        for( let o of this.stack) {
            if(o.type == OPTIONS.STOP) {
                return false;
            }
            if(o.type == OPTIONS.APV) {
                active = true;
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
