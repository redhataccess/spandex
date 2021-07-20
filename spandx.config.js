module.exports = {
    host: {
        local: "localhost",
    },
    port: "auto",
    open: !true,
    startPath: "/",
    verbose: true,
    routes: {
        // Here are some routing examples to get started.

        // Route a URL path to an app server.
        // This is most useful for testing local files (esp JS and CSS) against
        // a remote QA or production server.
        "/foo/bar": {
            host: {
                local: "http://localhost:8081",
            },
            path: "/",
        },

        "/baz/bat": {
            host: {
                local: "http://localhost:8081",
            },
        },
        // Route a URL path to an app server, and watch local files for changes.
        // This is most useful for putting a local development at a certain
        // path on your spandx server.  Includes browser-sync auto-reloading.
        // '/': { host: 'http://localhost:8080/', watch: '~/projects/my-app' },
    },
};
