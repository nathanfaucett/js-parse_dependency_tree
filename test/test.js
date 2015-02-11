var assert = require("assert"),
    parseDependencyTree = require("../src/index");


describe("parseDependencyTree(path : FilePath String, options : Object)", function() {
    it("should return array of dependencies", function() {
        var graph;

        graph = parseDependencyTree(__dirname + "/lib/index");

        assert.equal(graph.modules[0].dependencies.length, 3);
        assert.equal(graph.modules[1].dependencies.length, 4);
        assert.equal(graph.modules[2].dependencies.length, 1);

        graph = parseDependencyTree(__dirname + "/lib_css/index", {
            includeNames: "\\@import",
            useBraces: false,
            packageType: "style",
            exts: ["less", "css"]
        });
        assert.equal(graph.array.length, 2);
    });
});
