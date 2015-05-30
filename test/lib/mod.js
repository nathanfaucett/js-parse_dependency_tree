var mod = exports,
    value = null;


mod.set = function(newValue) {
    value = newValue;
};

mod.get = function() {
    return value;
};
