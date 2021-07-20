module.exports = {
    host: {
        dev: "localhost",
        prod: "127.0.0.1"
    },
    port: 1337,
    silent: true,
    primer: {
        preview: true
    },
    routes: {
        "/services/primer/": "./services/primer/",
        "/": {
            host: {
                dev: "http://localhost:4014",
                prod: "http://localhost:4015"
            }
        }
    }
};
