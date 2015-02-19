var folder = require("./folder");


var app = exports;


app.init = function() {
    require.async("./math", function(math) {
        var test = require("./test");

        require.async("./mod", function(mod) {
            mod.set("asdf");
            console.log(mod.get());
        });

        console.log(math, test(true));
    });
};
