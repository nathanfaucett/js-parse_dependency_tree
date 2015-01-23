var assert = require("assert"),
    parseDependencyTree = require("../src/index");


describe("parseDependencyTree(path : FilePath String, options : Object)", function() {
    it("should return array of dependencies", function() {
        var graph = parseDependencyTree(__dirname + "/lib/index");
        assert.equal(graph.array.length, 5);
    });
});
