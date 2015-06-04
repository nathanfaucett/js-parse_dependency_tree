var has = require("has"),
    isArray = require("is_array"),
    isObject = require("is_object"),
    isString = require("is_string"),
    isFunction = require("is_function"),
    filePath = require("file_path"),
    mixin = require("mixin"),
    resolve = require("resolve");


var helpers = resolve.helpers,
    reComment = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;


module.exports = parseDependencyTree;


function Tree() {
    this.root = null;
    this.rootDirectory = null;
    this.children = [];
    this.childHash = {};
    this.options = {};
}

function Dependency() {

    this.index = null;

    this.fullPath = null;
    this.parent = null;
    this.children = [];

    this.moduleName = null;
    this.version = null;
    this.pkg = null;

    this.mappings = {};
    this.isParsed = false;
}

function parseDependencyTree(index, opts) {
    var tree = new Tree(),
        options = tree.options,
        exts, dependency;

    opts = opts || {};

    exts = opts.extensions || opts.exts;
    options.extensions = isArray(exts) ? exts : (isString(exts) ? [exts] : ["js", "json"]);

    options.builtin = opts.builtin || {};
    options.beforeParse = isFunction(opts.beforeParse) ? opts.beforeParse : false;
    options.useBraces = opts.useBraces != null ? !!opts.useBraces : true;
    options.reInclude = buildIncludeRegExp(opts.includeNames ? opts.includeNames : ["require"], options.useBraces);
    options.packageType = opts.packageType;

    if (!filePath.isAbsolute(index)) {
        index = filePath.join(process.cwd(), index);
    }

    tree.rootDirectory = filePath.dir(index);

    dependency = createDependency({
        fullPath: helpers.findExt(index, options.extensions),
        isModule: true
    }, null, tree);

    tree.root = dependency;

    parseDependecy(dependency, tree);

    return tree;
}

function createDependency(options, parent, tree) {
    var children = tree.children,
        childHash = tree.childHash,

        moduleName = options.moduleName,
        fullPath = options.fullPath,

        id = moduleName ? moduleName : options.fullPath,
        dependency = childHash[id];

    if (!dependency) {
        dependency = new Dependency();

        dependency.index = children.length;
        childHash[id] = children[dependency.index] = dependency;
        if (moduleName) {
            childHash[fullPath] = dependency;
        }
        dependency.fullPath = options.fullPath;

        if (options.moduleName) {
            dependency.moduleName = options.moduleName;
        }
        if (options.version) {
            dependency.version = options.version;
        }
        if (options.pkg) {
            dependency.pkg = options.pkg;
            parsePackageMappings(
                dependency,
                filePath.dir(dependency.fullPath),
                tree.options.packageType
            );
        }

        if (parent) {
            mixin(dependency.mappings, parent.mappings);
        }
    }

    return dependency;
}
parseDependencyTree.createDependency = createDependency;

function parseDependecy(dependency, tree) {
    if (dependency.isParsed === false) {
        dependency.isParsed = true;
        parseDependecies(dependency, tree);
    }

    return dependency;
}
parseDependencyTree.parseDependecy = parseDependecy;

function parseDependecies(dependency, tree) {
    var fullPath = dependency.fullPath,
        content = helpers.readFile(fullPath),
        cleanContent = removeComments(content),

        parentDirname = filePath.dir(fullPath),

        options = tree.options;

    if (options.beforeParse) {
        cleanContent = options.beforeParse(content, cleanContent, dependency, tree);
    }

    options.mappings = dependency.mappings;
    cleanContent.replace(options.reInclude, function(match, includeName, functionName, dependencyPath) {
        var opts, dep;

        options.fromFilename = fullPath;
        opts = resolve(dependencyPath, parentDirname, options);
        options.fromFilename = null;

        dep = createDependency(opts, dependency, tree);
        addChild(dependency, dep);
        parseDependecy(dep, tree);
    });
}
parseDependencyTree.parseDependecies = parseDependecies;

function addChild(parent, child) {
    var children = parent.children;
    child.parent = parent;
    children[children.length] = child;
}

function parsePackageMappings(dependency, dirname, type) {
    var pkg = dependency.pkg,
        mappings = pkg[type],
        out = dependency.mappings,
        key, value;

    if (isObject(mappings)) {
        for (key in mappings) {
            if (has(mappings, key)) {
                value = mappings[key];

                if (isString(value)) {
                    out[key] = filePath.join(dirname, value);
                }
            }
        }
    }
}

/*
var asyncString = "async";

function parseAsyncCallbacks(content, tree) {
    var results = [content],
        index = 0,
        textIndex = 0;

    content.replace(tree.options.reInclude, function(match, includeName, functionName, dependencyPath, offset) {
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

var createFileName_re = /[\/\.]+/;

function createFileName(fullPath, rootDirectory) {
    var relative = filePath.relative(rootDirectory, fullPath),
        ext = filePath.ext(fullPath);
    return filePath.join(filePath.dir(relative), filePath.base(relative, ext)).replace(createFileName_re, "_") + ext;
}
*/

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

function buildIncludeRegExp(functionName, useBraces) {
    functionName = isArray(functionName) ? functionName.join("|") : functionName;

    if (useBraces) {
        return new RegExp(
            "(" + functionName + ")(?:\\.([a-zA-Z_$]+))?\\s*\\(\\s*[\"']([^'\"\\s]+)[\"']\\s*[\\,\\)]", "g"
        );
    } else {
        return new RegExp(
            "(" + functionName + ")(?:\\.([a-zA-Z_$]+))?\\s*[\"']([^'\"\\s]+)[\"']\\s*[\\;\\n]", "g"
        );
    }
}
