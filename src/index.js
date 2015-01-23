var isArray = require("is_array"),
    isString = require("is_string"),
    isFunction = require("is_function"),
    filePath = require("file_path"),
    resolve = require("resolve");


var helpers = resolve.helpers,

    reComment = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;


module.exports = parseDependencyTree;


function parseDependencyTree(index, options) {
    var graph = {
            array: [],
            hash: {}
        },
        exts;

    options = graph.options = options || {};

    options.beforeParse = isFunction(options.beforeParse) ? options.beforeParse : false;

    exts = options.exts;
    options.exts = isArray(exts) ? exts : (isString(exts) ? exts : ["js", "json"]);

    graph.reInclude = buildIncludeRegExp(options.includeNames ? options.includeNames : ["require", "require\\.resolve"]);

    if (!filePath.isAbsolute(index)) {
        index = filePath.join(process.cwd(), index);
    }

    index = filePath.normalize(helpers.ensureExt(index, options.exts));

    graph.root = filePath.dir(index);

    parseDependency({
        fullPath: index
    }, graph);

    return {
        array: graph.array,
        reInclude: graph.reInclude,
        options: options
    };
}

function parseDependency(options, graph) {
    var array = graph.array,
        hash = graph.hash,

        id = options.moduleName ? options.moduleName : options.fullPath,
        dependency = hash[id];

    if (!dependency) {
        dependency = {};

        hash[id] = array[array.length] = dependency;

        if (options.moduleName) {
            dependency.moduleName = options.moduleName;
        }
        if (options.version) {
            dependency.version = options.version;
        }
        if (options.pkg) {
            dependency.pkg = options.pkg;
        }

        if (options.start != null && options.end != null) {
            dependency.start = options.start;
            dependency.end = options.end;
        }

        dependency.fullPath = options.fullPath;
        parseDependencies(dependency, graph);
    }
}

function parseDependencies(dependency, graph) {
    var content = helpers.readFile(dependency.fullPath),
        cleanContent = removeComments(content),
        parentDirname = filePath.dir(dependency.fullPath),
        options = graph.options;

    if (options.beforeParse) {
        cleanContent = options.beforeParse(cleanContent, dependency, graph);
    }

    cleanContent.replace(graph.reInclude, function(match, functionType, dependencyPath, offset) {
        var opts = resolve(dependencyPath, parentDirname, options);

        opts.start = offset;
        opts.end = offset + match.length;

        parseDependency(opts, graph);
    });
}

function buildIncludeRegExp(functionName) {
    return new RegExp(
        "(" + (isArray(functionName) ? functionName.join("|") : functionName) + ")\\s*\\(\\s*[\"']([^'\"\\s]+)[\"']\\s*\\)", "g"
    );
}

function spaces(length) {
    var i = length,
        out = "";

    while (i--) {
        out += " ";
    }
    return out;
}

function removeComments(str) {
    return (str + "").replace(reComment, function(match) {
        return spaces(match.length);
    });
}
