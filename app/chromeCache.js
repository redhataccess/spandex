const request = require("request");

const DEFAULT_CHROME_HOST = "https://access.redhat.com";
const DEFAULT_CHROME_PATH = "/services/chrome/";

const cache = {};
let chromeHost;
let chromePath;

async function getParts({
    host = DEFAULT_CHROME_HOST,
    path = DEFAULT_CHROME_PATH,
    proxy
} = {}) {
    if (cache[host + path]) {
        return cache[host + path];
    }

    const headReq = fetchChromePart({ host, part: "head", path, proxy });
    const headerReq = fetchChromePart({ host, part: "header", path, proxy });
    const footerReq = fetchChromePart({ host, part: "footer", path, proxy });

    const head = await headReq;
    const header = await headerReq;
    const footer = await footerReq;

    cache[host + path] = { head, header, footer };

    chromeHost = host;
    chromePath = path;

    return cache[host + path];
}

function fetchChromePart({
    host = DEFAULT_CHROME_HOST,
    path = DEFAULT_CHROME_PATH,
    part,
    proxy
} = {}) {
    return new Promise((resolve, reject) => {
        const url = `${host}${path}${part}?legacy=false`;
        console.log(`fetching chrome from ${url}`);
        request(
            {
                url,
                strictSSL: false,
                proxy
            },
            function(err, response, body) {
                if (err) {
                    reject(err);
                }
                resolve(body);
            }
        );
    });
}

module.exports = {
    chromeHost,
    chromePath,
    getParts
};
