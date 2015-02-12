var isArray = require("is_array"),
    isString = require("is_string"),
    isFunction = require("is_function"),
    filePath = require("file_path"),
    forEach = require("for_each"),
    indexOf = require("index_of"),
    resolve = require("resolve");


var helpers = resolve.helpers,
    reComment = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;


module.exports = parse;


function parse(index, options) {
    var graph = {
            reInclude: null,
            root: null,
            options: null,
            module: null,
            rootModule: null,
            modules: [],
            moduleHash: {},
            array: [],
            hash: {}
        },
        module;

    options = options || {};
    options.parseAsync = options.parseAsync != null ? !!options.parseAsync : true;
    options.beforeParse = isFunction(options.beforeParse) ? options.beforeParse : false;
    options.exts = isArray(options.exts) ? options.exts : (isString(options.exts) ? options.exts : ["js", "json"]);
    graph.reInclude = buildIncludeRegExp(options.includeNames ? options.includeNames : ["require"], options.useBraces);

    if (!filePath.isAbsolute(index)) {
        index = filePath.join(process.cwd(), index);
    }

    graph.root = filePath.dir(index);
    graph.options = options;

    module = createDependency({
        fullPath: helpers.findExt(index, options.exts),
        isModule: true
    }, graph);

    module.module = graph.module = graph.rootModule = module;
    parseDependecy(graph.module, graph, true);

    return graph;
}

function createDependency(options, graph) {
    var array = graph.array,
        hash = graph.hash,

        modules = graph.modules,
        moduleHash = graph.moduleHash,

        id = options.moduleName ? options.moduleName : options.fullPath,
        dependency = options.isModule ? moduleHash[id] : hash[id];

    if (!dependency) {
        dependency = {};

        dependency.async = false;
        dependency.parsed = false;
        dependency.dependencies = [];
        dependency.fullPath = options.fullPath;

        if (options.isModule) {
            modules[modules.length] = moduleHash[id] = dependency;
            dependency.moduleFileName = createFileName(options.fullPath, graph.root);
        }

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
    var graphModule = graph.module,
        dependencyModule = dependency.module ? dependency.module : (dependency.module = isModule ? dependency : graphModule),
        dependencies = dependencyModule.dependencies;

    if (indexOf(dependencies, dependency) === -1) {
        dependencies[dependencies.length] = dependency;
    }

    if (dependency.parsed === false) {
        dependency.parsed = true;
        parseDependecies(dependency, graph);
    }

    return dependency;
}
parse.parseDependecy = parseDependecy;

function parseDependecies(dependency, graph) {
    var content = helpers.readFile(dependency.fullPath),
        cleanContent = removeComments(content),

        parentDirname = filePath.dir(dependency.fullPath),
        options = graph.options,
        parseAsync = options.parseAsync,

        contents;

    dependency.async = false;

    if (options.beforeParse) {
        cleanContent = options.beforeParse(content, cleanContent, dependency, graph);
    }

    if (parseAsync) {
        contents = parseAsyncCallbacks(cleanContent, graph);

        forEach(contents, function(content) {
            var graphModule = graph.module;

            content.replace(graph.reInclude, function(match, includeName, functionName, dependencyPath) {
                var opts = resolve(dependencyPath, parentDirname, options),
                    dep;

                opts.isModule = functionName === asyncString;
                dep = createDependency(opts, graph);

                if (opts.isModule) {
                    graph.module = dep;
                }
                parseDependecy(dep, graph);
            });
            graph.module = graphModule;
        });
    } else {
        cleanContent.replace(graph.reInclude, function(match, includeName, functionName, dependencyPath) {
            var opts = resolve(dependencyPath, parentDirname, options),
                dep;

            dep = createDependency(opts, graph);
            parseDependecy(dep, graph);
        });
    }
}
parse.parseDependecies = parseDependecies;

var asyncString = "async";

function parseAsyncCallbacks(content, graph) {
    var results = [content],
        index = 0,
        textIndex = 0;

    content.replace(graph.reInclude, function(match, includeName, functionName, dependencyPath, offset) {
        var last, c, start;

        if (functionName === asyncString) {
            last = results[index];
            c = parseAsyncCallback(content, offset);
            start = parseAsyncCallback_lastStart - textIndex;

            results[index] = last.substr(0, start) + last.substr(start + c.length, last.length);
            results[results.length] = c;

            textIndex = start;
            index++;
        }
    });

    return results;
}

var parseAsyncCallback_lastStart = 0,
    parseAsyncCallback_lastEnd = 0;

function parseAsyncCallback(content, index) {
    var body = "",
        last = true,
        length = content.length,
        ch;

    parseAsyncCallback_lastStart = index;

    while (index < length) {
        ch = content.charAt(index++);

        if (ch === "{") {
            last = false;
        } else if (ch === "}") {
            if (last === true) {
                break;
            } else {
                last = true;
            }
        }

        body += ch;
    }

    parseAsyncCallback_lastEnd = index;

    return body;
}

function buildIncludeRegExp(functionName, useBraces) {
    functionName = isArray(functionName) ? functionName.join("|") : functionName;

    if (useBraces !== false) {
        return new RegExp(
            "(" + functionName + ")(?:\\.([a-zA-Z_$]+))?\\s*\\(\\s*[\"']([^'\"\\s]+)[\"']\\s*[\\,\\)]", "g"
        );
    } else {
        return new RegExp(
            "(" + functionName + ")(?:\\.([a-zA-Z_$]+))?\\s*[\"']([^'\"\\s]+)[\"']\\s*[\\;\\n]", "g"
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
