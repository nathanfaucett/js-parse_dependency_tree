var isArray = require("is_array"),
    isString = require("is_string"),
    isFunction = require("is_function"),
    extend = require("extend"),
    filePath = require("file_path"),
    indexOf = require("index_of"),
    resolve = require("resolve");


var helpers = resolve.helpers,
    nativeFunctions = {},
    reComment = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;


module.exports = parse;


function parse(index, options) {
    var graph = {
        reInclude: null,
        root: null,
        options: null,
        module: null,
        modules: [],
        moduleHash: {},
        array: [],
        hash: {}
    };

    options = options || {};
    options.functions = extend(options.functions || {}, nativeFunctions);
    options.beforeParse = isFunction(options.beforeParse) ? options.beforeParse : false;
    options.exts = isArray(options.exts) ? options.exts : (isString(options.exts) ? options.exts : ["js", "json"]);
    graph.reInclude = buildIncludeRegExp(options.includeNames ? options.includeNames : ["require", "require\\.resolve", "require\\.async"], options.useBraces);

    if (!filePath.isAbsolute(index)) {
        index = filePath.join(process.cwd(), index);
    }

    graph.root = filePath.dir(index);
    graph.options = options;

    graph.module = createDependency({
        fullPath: helpers.findExt(index, options.exts)
    }, graph, true);

    parseDependecy(graph.module, graph, true);

    return graph;
}

function createDependency(options, graph, isModule) {
    var array = graph.array,
        hash = graph.hash,
        modules = graph.modules,
        moduleHash = graph.moduleHash,
        id = options.moduleName ? options.moduleName : options.fullPath,
        dependency = isModule ? moduleHash[id] : hash[id];

    if (!dependency) {
        dependency = {};

        dependency.dependencies = [];
        dependency.fullPath = options.fullPath;

        if (isModule) {
            dependency.moduleIndex = modules.length;
            modules[dependency.moduleIndex] = moduleHash[id] = dependency;
            dependency.moduleFileName = createFileName(options.fullPath, graph.root);
            dependency.dependencies[0] = dependency;
        }

        dependency.module = graph.module;

        dependency.index = array.length;
        hash[id] = array[dependency.index] = dependency;

        if (options.moduleName) {
            dependency.moduleName = options.moduleName;
        }
        if (options.version) {
            dependency.version = options.version;
        }
        if (options.pkg) {
            dependency.pkg = options.pkg;
        }
    }

    return dependency;
}
parse.createDependency = createDependency;

function parseDependecy(dependency, graph, isModule) {
    var lastModule = graph.module;

    if (isModule) {
        graph.module = dependency;
    }
    parseDependecies(dependency, graph);
    if (isModule) {
        graph.module = lastModule;
    }
    return dependency;
}
parse.parseDependecy = parseDependecy;

function parseDependecies(dependency, graph) {
    var dependencies = dependency.dependencies,
        dependencyModule = dependency.module,

        content = helpers.readFile(dependency.fullPath),
        cleanContent = removeComments(content),

        parentDirname = filePath.dir(dependency.fullPath),
        options = graph.options,
        functions = options.functions;

    if (options.beforeParse) {
        cleanContent = options.beforeParse(content, cleanContent, dependency, graph);
    }

    cleanContent.replace(graph.reInclude, function(match, functionType, dependencyPath) {
        var opts = resolve(dependencyPath, parentDirname, options),
            fn = functions[functionType],
            dep;

        if (fn) {
            fn(opts, cleanContent, match.length, dependency, graph);
        } else {
            dep = createDependency(opts, graph);
            if (dep.module === dependencyModule && indexOf(dependencies, dep) === -1) {
                dependencies[dependencies.length] = dep;
            }
            parseDependecy(dep, graph);
        }
    });
}
parse.parseDependecies = parseDependecies;

nativeFunctions["require.async"] = requireAsync;

function requireAsync(options, content, offset, parentDependency, graph) {
    var dependency = createDependency(options, graph, true),

        lastModule = graph.module,
        body = parseAsyncCallback(content, offset),

        graphOptions = graph.options,
        functions = graphOptions.functions,

        parentDirname = filePath.dir(parentDependency.fullPath),
        dependencies = dependency.dependencies;

    graph.module = dependency;
    body.replace(graph.reInclude, function(match, functionType, dependencyPath) {
        var opts = resolve(dependencyPath, parentDirname, graphOptions),
            fn = functions[functionType],
            dep;

        if (fn) {
            fn(opts, body, match.length, parentDependency, graph);
        } else {
            dep = createDependency(opts, graph);
            if (dep.module === dependency && indexOf(dependencies, dep) === -1) {
                dependencies[dependencies.length] = dep;
            }
            parseDependecy(dep, graph);
        }
    });
    graph.module = lastModule;

    parseDependecy(dependency, graph);
}

function parseAsyncCallback(content, index) {
    var body = "",
        last = true,
        length = content.length,
        ch = content.charAt(index);

    while (ch !== "{" && index < length) {
        index++;
        ch = content.charAt(index);
    }

    while (index < length) {
        index++;
        ch = content.charAt(index);

        if (ch === "{") {
            last = false;
        } else if (ch === "}") {
            if (last) {
                break;
            } else {
                last = true;
            }
        } else {
            body += ch;
        }
    }

    return body;
}

function buildIncludeRegExp(functionName, useBraces) {
    functionName = isArray(functionName) ? functionName.join("|") : functionName;

    if (useBraces !== false) {
        return new RegExp(
            "(" + functionName + ")\\s*\\(\\s*[\"']([^'\"\\s]+)[\"']\\s*[\\,\\)]", "g"
        );
    } else {
        return new RegExp(
            "(" + functionName + ")\\s*[\"']([^'\"\\s]+)[\"']\\s*[\\;\\n]", "g"
        );
    }
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

function createFileName(fullPath, root) {
    var relative = filePath.relative(root, fullPath),
        ext = filePath.ext(fullPath);
    return filePath.join(filePath.dir(relative), filePath.base(relative, ext)).replace(createFileName.re, "_") + ext;
}
createFileName.re = /[\/\.]+/;
