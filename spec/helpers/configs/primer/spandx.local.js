module.exports = {
    host: "localhost",
    port: 1337,
    silent: true,
    primer: {
        preview: true
    },
    routes: {
        "/services/primer/": "./mock-primer-file",
        "/": "./"
    }
};
