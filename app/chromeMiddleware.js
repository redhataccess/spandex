const chromeCache = require("./chromeCache");
const { createTokenSlicer } = require("token-slice");
const got = require("got");

function SPACommentResolver(conf) {
    return async function SPACommentResolverMiddleware(data, req, res) {
        const isHTML = (res.getHeader("content-type") || "").includes("html");
        if (isHTML) {
            const host = req.headers["x-spandx-origin"];
            const chromeParts = await chromeCache.getParts({ host });
            return data
                .toString()
                .replace(/<!--\s+SPA_HEAD\s+-->/, chromeParts.head)
                .replace(/<!--\s+SPA_HEADER\s+-->/, chromeParts.header)
                .replace(/<!--\s+SPA_FOOTER\s+-->/, chromeParts.footer);
        } else {
            return data;
        }
    };
}

function chromeSwapper(conf) {
    return async function ChromeSwapperMiddleware(data, req, res) {
        const isHTML = (res.getHeader("content-type") || "").includes("html");
        const isPrimerAlready = req.url.startsWith("/services/primer");
        if (isHTML && !isPrimerAlready) {
            const origin = req.headers["x-spandx-origin"];
            console.log({ origin });
            const chromeParts = await chromeCache.getParts({
                host: origin,
                path: "/services/primer/",
                useCached: false,
            });

            return data
                .toString()
                .replace(
                    /<!--\s*CP_PRIMER_HEAD\s*-->.*<!--\s*\/CP_PRIMER_HEAD\s*-->/s,
                    `${chromeParts.head}`
                )
                .replace(
                    /<!--\s*CP_PRIMER_HEADER\s*-->.*<!--\s*\/CP_PRIMER_HEADER\s*-->/s,
                    `${chromeParts.header}`
                )
                .replace(
                    /<!--\s*CP_PRIMER_FOOTER\s*-->.*<!--\s*\/CP_PRIMER_FOOTER\s*-->/s,
                    `${chromeParts.footer}`
                );

            // if any tokens were found, swap them
            // if (tokens.result.length) {
            //     tokens.result.sort(
            //         (a, b) => a.outer.startIndex - b.outer.startIndex
            //     );

            //     // TODO make this work when only 1 or 2 of the token pairs were found
            //     const ret =
            //         // body pre-head
            //         body.slice(0, tokens.result[0].outer.startIndex) +
            //         // head
            //         chromeParts.head +
            //         // body post-head
            //         body.slice(
            //             tokens.result[0].outer.endIndex,
            //             tokens.result[1].outer.startIndex
            //         ) +
            //         // header
            //         chromeParts.header +
            //         // body post-header
            //         body.slice(
            //             tokens.result[1].outer.endIndex,
            //             tokens.result[2].outer.startIndex
            //         ) +
            //         // footer
            //         chromeParts.footer +
            //         // body post-footer
            //         body.slice(tokens.result[2].outer.endIndex, body.length);

            //     return "HELLO";
            // }
        }

        return data;
    };
}

module.exports = { SPACommentResolver, chromeSwapper };
