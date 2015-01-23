var utils = require("../utils/utils"),
    sub = require("./sub");


var mod = module.exports;


mod.add = function() {
    var i = 0,
        il = arguments.length - 1,
        value = arguments[0];

    while (i++ < il) {
        value = utils.add(value, arguments[i]);
    }

    return value;
};

mod.sub = function() {
    var i = 0,
        il = arguments.length - 1,
        value = arguments[0];

    while (i++ < il) {
        value = sub(value, arguments[i]);
    }

    return value;
};
