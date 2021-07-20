const fs = require("fs");
const path = require("path");

const _ = require("lodash");
const resolveHome = require("./resolveHome");
const c = require("print-colors");
const porty = require("porty");

class ConfigProcessError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, ConfigProcessError);
    }
}

class ConfigOpenError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, ConfigOpenError);
    }
}

class PortUnavailableError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, PortUnavailableError);
    }
}

const defaultConfig = {
    protocol: "http:",
    host: "localhost",
    port: 1337,
    verbose: false,
    silent: false,
    routes: {
        "/": path.resolve(__dirname, "splash")
    },
    bs: {}
};

let configState = {};

async function create(incomingConfig = {}, configDir = __dirname) {
    configState.currentConfig = _.defaults(incomingConfig, defaultConfig);

    if (incomingConfig.port === "auto") {
        incomingConfig.port = await porty.find();
    } else if (!(await porty.test(incomingConfig.port))) {
        throw new PortUnavailableError(
            `port ${incomingConfig.port} is already in use.`
        );
    }

    // choose a port for the internal proxy, avoiding the external port just chosen
    incomingConfig.internalPort = await porty.find({
        min: incomingConfig.port,
        avoids: [incomingConfig.port]
    });

    _.extend(
        configState.currentConfig,
        processConf(configState.currentConfig, configDir)
    );

    validateHosts(configState.currentConfig);

    return configState.currentConfig;
}

function get() {
    return configState.currentConfig;
}

async function fromFile(filePath = `${process.cwd()}/spandx.config.js`) {
    let confObj;
    const fullPath = path.resolve(__dirname, filePath);
    try {
        confObj = require(fullPath);
    } catch (e) {
        if (e.toString().indexOf("Error: Cannot find module") === 0) {
            throw new ConfigOpenError(
                `Tried to open spandx config file ${c.fg.l.cyan}${filePath}${c.end
                } but couldn't find it, or couldn't access it.`
            );
        } else {
            throw new ConfigProcessError(
                `Tried to process spandx config file ${c.fg.l.cyan}${filePath}${c.end
                } ` + `but. Got an exception loading the config: ${e}`
            );
        }

        process.exit(1);
    }
    const conf = await create(confObj, path.parse(fullPath).dir);
    return conf;
}

function isSingleHost(conf) {
    const singleHost = _.isString(conf.host);
    const multiHost = _.isPlainObject(conf.host);

    if (singleHost === multiHost) {
        throw new Error(
            "'host' is the wrong type, must be either string or object"
        );
    }

    return singleHost;
}

function validateHosts(conf) {
    const routeHostMaps = _(conf.routes)
        .filter(_.isPlainObject) // only look at routes that are object, not strings (strings indicate local file paths)
        .map("host") // grab the host vaule
        .filter(_.isPlainObject); // grab any host values that are object

    // ERROR if any route hosts have maps with different keys than the spandx host map
    if (!validateEnvsMatch(conf, routeHostMaps)) {
        throw new Error(
            `spandx is configured for multi-host mode ('host' is an object map), but one or more routes have environment names that don't match the names from 'host'`
        );
    }

    return true;
}

function validateEnvsMatch(conf, routeHostMaps) {
    const sortKeys = obj =>
        _(obj)
            .keys()
            .sortBy()
            .value();

    const hasSameKeys = _.curry((envs1, envs2) =>
        _.isEqual(sortKeys(envs1), sortKeys(envs2))
    );

    const spandxHosts = sortKeys(conf.host);

    const matchesSpandxHosts = hasSameKeys(spandxHosts);

    const allEnvsMatch = routeHostMaps
        .map(h => sortKeys(h))
        .filter(envs => !matchesSpandxHosts(envs)) // filter *out* the ones that match spandx hosts
        .isEmpty(); // if empty, then every single route host matched

    return allEnvsMatch;
}

function processConf(conf, configDir = __dirname) {
    // add a conf entry indicating whetehr spandx is running in multi-host mode
    conf.multiHost = !isSingleHost(conf);

    // separate the local disk routes from the web routes
    const routeGroups = _(conf.routes)
        .toPairs()
        .partition(pair => _.isObject(pair[1])); // filter out URLs, only want local file paths here

    const webRoutes = routeGroups.get(0);
    const diskRoutes = routeGroups.get(1);

    const webRouteHosts = _(webRoutes)
        .map(1) // get route value
        .filter(r => _.isString(r.host)); // only select routes with strings for their host; at this point it should be ALL of them, but playing it safe anyway

    // convert any simplified host values into explicit host config (ie,
    // convert from a string like "localhost" to an object like
    // { default: "localhost" }
    if (conf.multiHost) {
        // multi host mode

        // for any web routes that have a single host, change them into a
        // multi-host entry where each env points to the same place
        webRouteHosts.forEach(r => {
            const routeHost = r.host;
            r.host = _({})
                .extend(conf.host)
                .mapValues(v => routeHost)
                .value();
        });
    } else {
        // single host mode
        conf.host = {default: conf.host};
        webRouteHosts.forEach(r => (r.host = {default: r.host})); // convert host string to object
    }

    // build a list of file paths to watch for auto-reload, by combining the
    // local disk route paths with the web routes that provided local paths
    // (web routes can provide an optional path to local files if they want
    // browser-sync to auto-reload their stuff)
    const diskRouteFiles = _(diskRoutes)
        .map(1)
        .map(filePath => path.resolve(configDir, resolveHome(filePath)))
        .value();
    const otherLocalFiles = _(webRoutes)
        .map(1)
        .filter("watch")
        .map("watch")
        .map(filePath => path.resolve(configDir, resolveHome(filePath)))
        .value();

    const files = _.concat(diskRouteFiles, otherLocalFiles);

    // create a list of browserSync 'rewriteRules' that will modify the
    // contents of requests coming back from the proxied remote servers.  this
    // is mainly useful for rewriting links from, say 'www.foo.com' to
    // 'localhost:1337' so that when you click on a link, you stay in your
    // spandx'd environment.
    const protocol = conf.bs.https ? "https:" : "http:";
    const rewriteRules = _(webRoutes)
        .map("1.host")
        .map(h =>
            _.map(h, (v, env) => ({
                match: new RegExp(v, "g"),
                replace: `${protocol}//${conf.host[env]}:${conf.port}`
            }))
        )
        .flatten()
        .value();

    const startPath = conf.startPath || "";
    const spandxUrl = _.map(
        conf.host,
        host => `${protocol}//${host}:${conf.port}${startPath}`
    );

    // allow 'silent' to override 'verbose'
    const verbose = conf.silent ? false : conf.verbose;

    return {
        routeGroups,
        verbose,
        webRoutes,
        diskRoutes,
        diskRouteFiles,
        otherLocalFiles,
        files,
        rewriteRules,
        protocol,
        spandxUrl,
        startPath,
        configDir
    };
}

module.exports = {
    create,
    get,
    fromFile,
    defaultConfig,
    process: processConf
};
