var folder = require("./folder");


var app = exports;


app.init = function() {
    var test = require("./test"),
        mod = require("./mod");

    mod.set("asdf");

    console.log(mod.get());
    console.log(test(true));
};
