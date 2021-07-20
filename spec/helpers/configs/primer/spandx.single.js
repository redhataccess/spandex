module.exports = {
    host: "localhost",
    port: 1337,
    silent: true,
    primer: {
        preview: true
    },
    routes: {
        "/services/primer/": "./services/primer/",
        "/": {host: "http://localhost:4014"}
    }
};
