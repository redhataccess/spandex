const fs = require("fs");
const path = require("path");
const URL = require("url");
const c = require("print-colors");
const _ = require("lodash");
const { flow, includes, get } = require("lodash/fp");
const finalhandler = require("finalhandler");
const serveStatic = require("serve-static");
const resolveHome = require("./resolveHome");
const ProxyAgent = require("proxy-agent");
const priv = {};

priv.tryPlugin = (plugin, req, res, target, cb) => {
    if (typeof plugin === "function") {
        plugin(req, res, target).then((t) => {
            // Plugin may have sent back a new target
            // if they did use it
            t = t || target;
            cb(t);
        }); // TODO what to do if the plugin Promise fails ??
    } else {
        // Run with the default target
        cb(target);
    }
};

priv.doProxy = (proxy, req, res, target, confProxy = null) => {
    if (target) {
        const options = {
            target,
            ignorePath: true,
        };

        if (confProxy) {
            const regex = RegExp(confProxy.pattern);

            // if the target URL passes the regex test based on the
            // pattern provided in the proxy.pattern property,
            // add a new HttpsProxyAgent
            if (regex.test(target)) {
                options.agent = new ProxyAgent(confProxy.host);
            }
        }

        proxy.web(req, res, options, (e) => {
            console.error(e);
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.write(
                `HTTP 502 Bad gateway\n\nRequest to ${req.url} was proxied to ${target} which did not respond.`
            );
            res.end();
        });
    } else {
        res.writeHead(404);
        res.end();
    }
};

module.exports = (conf, proxy) => {
    // for each local file path in the conf, create a serveStatic object for
    // serving that dir
    const serveLocal = _(conf.routes)
        .omitBy(_.isObject)
        .mapValues((dir) =>
            serveStatic(path.resolve(conf.configDir, resolveHome(dir)), {
                redirect: true,
            })
        )
        .value();
    return (req, res, next) => {
        // figure out which target to proxy to based on the requested resource path
        const sortedRoutes = _(conf.routes)
            .toPairs()
            .filter((v) => _.startsWith(req.url, v[0]))
            .sortBy((v) => -v[0].length)
            .value();

        const env = req.headers["x-spandx-env"];

        for (let routeCandidate of sortedRoutes) {
            const routeKey = routeCandidate[0];
            const route = conf.routes[routeKey];
            const acceptHTML = flow(
                get("headers.accept"),
                includes("text/html")
            )(req);
            const hasExtension = URL.parse(req.url).path.includes(".");
            const isDoc = acceptHTML && !hasExtension;
            const useSingle = route.single && isDoc;
            const routePath = route.path || routeKey;
            const targetPath = useSingle
                ? routePath
                : req.url.replace(new RegExp(`^${routeKey}`), routePath);

            const targetHost = route.host && route.host[env];
            let fileExists;
            let needsSlash = false;
            const localFile = !targetHost;
            let target = targetHost + targetPath;

            // determine if the URL path maps to a local directory
            // if it maps to a local directory, and if the file exists, serve it
            // up.  if the URL path maps to an HTTP server, OR if it maps to a file
            // but the file doesn't exist, in either case proxy to a remote server.
            if (localFile) {
                const url = URL.parse(req.url);
                const relativeFilePath = url.pathname.replace(
                    new RegExp(`^${routeKey}/?`),
                    "/"
                ); // remove route path (will be replaced with disk path)

                const absoluteFilePath = path.resolve(
                    conf.configDir,
                    resolveHome(route),
                    relativeFilePath.replace(/^\//, "")
                );
                fileExists = fs.existsSync(absoluteFilePath);

                if (fileExists) {
                    if (conf.verbose) {
                        console.log(
                            `GET ${c.fg.l.green}${req.url}${c.end} from ${c.fg.l.cyan}${absoluteFilePath}${c.end} ${env}`
                        );
                    }

                    req.url = relativeFilePath; // update the request's url to be relative to the on-disk dir
                    serveLocal[routeKey](req, res, finalhandler(req, res));
                    return; // stop here, don't continue to HTTP proxy section
                }
            }

            if (localFile && !fileExists && routeKey.length > 1) {
                continue;
            }

            if (localFile && (!fileExists || needsSlash)) {
                target = conf.routes["/"].host
                    ? conf.routes["/"].host[env]
                    : undefined;
            }

            if (conf.verbose) {
                console.log(
                    `GET ${c.fg.l.green}${req.url}${c.end} from ${
                        c.fg.l.blue
                    }${target.replace(new RegExp(`${req.url}$`), "")}${c.end}${
                        c.fg.l.green
                    }${req.url}${c.end}`
                );
            }

            priv.tryPlugin(conf.routerPlugin, req, res, target, (t) => {
                priv.doProxy(proxy, req, res, t, conf.proxy);
            });

            return;
        }
    };
};

if (process.env.NODE_ENV === "test") {
    // only leak in test
    module.exports.priv = priv;
}
