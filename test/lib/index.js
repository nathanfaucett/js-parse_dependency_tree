var app = require("./app");


require.async("./math", function(math) {
    var test = require("./test");

    require.async("./mod", function(mod) {
        mod.set("asdf");
        console.log(mod.get());
    });

    console.log(math, test(true));
});

var add = require("./math/add");

console.log(app.file, add(5, 10));
