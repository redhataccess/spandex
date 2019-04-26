const hush = require("../helpers/hush");

describe("spandx", () => {
    const http = require("http");
    const fs = require("fs");
    const path = require("path");
    const execSync = require("child_process").execSync;
    const execFile = require("child_process").execFile;
    const frisby = require("frisby");

    const serve = require("../helpers/serve");

    const spandxPath = "../../app/spandx";
    let spandx;

    beforeEach(() => {
        spandx = require(spandxPath);
        hush.yourMouth();
    });

    afterEach(() => {
        spandx.exit();
        delete require.cache[require.resolve(spandxPath)];
        hush.speakUp();
    });

    describe("spandx.init()", () => {
        it("should accept default configuration", async done => {
            await spandx.init();

            frisby
                .get("http://localhost:1337")
                .expect("status", 200)
                .expect("bodyContains", /spandx/)
                .done(done);
        });

        it("should accept a js file", async done => {
            // launch a static file server, then init spandx, make a test
            // request, then close the static file server
            await spandx.init(
                "../spec/helpers/configs/js-or-json/spandx.config.js"
            );
            frisby
                .get("http://localhost:1337/")
                .expect("status", 200)
                .expect("bodyContains", /INDEX/)
                .done(done);
        });

        it("should accept a json file", async done => {
            await spandx.init(
                "../spec/helpers/configs/js-or-json/spandx.config.json"
            );

            frisby
                .get("http://localhost:1337/")
                .expect("status", 200)
                .expect("bodyContains", /INDEX/)
                .done(done);
        });

        it("should accept a config object", async done => {
            const { server, port } = await serve(
                "spec/helpers/configs/js-or-json/",
                4014
            );

            await spandx.init({
                /* config object! */
                silent: true,
                routes: {
                    "/": { host: "http://localhost:4014" }
                }
            });

            frisby
                .get("http://localhost:1337/")
                .expect("status", 200)
                .expect("bodyContains", /INDEX/)
                .done(() => {
                    server.close();
                    done();
                });
        });

        it("should accept single-host config", async done => {
            const { server, port } = await serve(
                "spec/helpers/configs/js-or-json/",
                4014
            );

            await spandx.init({
                /* config object! */
                silent: true,
                routes: {
                    "/": { host: "http://localhost:4014" }
                }
            });

            frisby
                .get("http://localhost:1337/")
                .expect("status", 200)
                .expect("bodyContains", /INDEX/)
                .done(() => {
                    server.close();
                    done();
                });
        });

        it("should accept multi-host config", async done => {
            // serve prod dir and dev dir on different ports
            const { server: prodServer, port: prodPort } = await serve(
                "spec/helpers/configs/single-multi/dev",
                4014
            );
            const { server: devServer, port: devPort } = await serve(
                "spec/helpers/configs/single-multi/prod",
                4015
            );

            // launch spandx with two 'environments', dev and prod.  accessing
            // spandx by localhost should route requests to the 'dev' host, and
            // accessing spandx by 127.0.0.1 should route to the prod host.
            await spandx.init({
                host: {
                    dev: "localhost",
                    prod: "127.0.0.1"
                },
                port: 1337,
                silent: true,
                routes: {
                    "/": {
                        host: {
                            dev: "http://localhost:4014",
                            prod: "http://localhost:4015"
                        }
                    }
                }
            });

            const devReq = frisby
                .get("http://localhost:1337/")
                .expect("status", 200)
                .expect("bodyContains", /DEV/);

            const prodReq = frisby
                .get("http://127.0.0.1:1337/")
                .expect("status", 200)
                .expect("bodyContains", /PROD/);

            // wait for both request's promises to
            // resolve, then close up shop
            await Promise.all([devReq._fetch, prodReq._fetch]);
            devServer.close();
            prodServer.close();
            done();
        });

        it("should reject invalid multi-host configs", async done => {
            try {
                await spandx.init(
                    "../spec/helpers/configs/multi-host/spandx.config.js"
                );
                fail();
            } catch (e) {
                done();
            }
        });

        it("should accept overriding browserSync settings", async done => {
            const bs = await spandx.init(
                "../spec/helpers/configs/bs-override/spandx.config.js"
            );
            const opts = bs.getOption("ghostMode");
            expect(opts.get("clicks")).toEqual(false);
            expect(opts.get("scroll")).toEqual(false);
            expect(opts.get("location")).toEqual(false);
            done();
        });

        it("should support port: 'auto'", async done => {
            const bs = await spandx.init(
                "../spec/helpers/configs/port-auto/spandx.config.js"
            );

            const port = bs.getOption("port");

            const devReq = frisby
                .get(`http://localhost:${port}/`)
                .expect("status", 200)
                .expect("bodyContains", /INDEX/)
                .done(done);
        });

        it("should send requests to an unconfigured hostname to the default hostname", async done => {
            const bs = await spandx.init(
                "../spec/helpers/configs/unconfigured-hostname/spandx.config.js"
            );

            const port = bs.getOption("port");

            frisby
                .get(`http://127.0.0.1:${port}/`)
                .expect("status", 200)
                .expect("bodyContains", /INDEX/)
                .done(done);
        });

        it("should fail when port is already in use", async done => {
            try {
                await spandx.init({
                    host: "localhost",
                    port: 1337,
                    silent: true,
                    routes: { "/": "./" }
                });
                await spandx.init({
                    host: "localhost",
                    port: 1337,
                    silent: true,
                    routes: { "/": "./" }
                });
            } catch (e) {
                done();
            }
        });
    });

    describe("trailing slashes", () => {
        describe("when routing to local directories", () => {
            it("should resolve root dir without trailing slash", async done => {
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.local.js"
                );
                frisby
                    .get("http://localhost:1337")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN ROOT DIR/)
                    .done(done);
            });
            it("should resolve root dir with trailing slash", async done => {
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.local.js"
                );
                frisby
                    .get("http://localhost:1337/")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN ROOT DIR/)
                    .done(done);
            });
            it("should resolve subdir without trailing slash", async done => {
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.local.js"
                );
                frisby
                    .get("http://localhost:1337/subdir")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN SUBDIR/)
                    .done(done);
            });
            it("should resolve subdir with trailing slash", async done => {
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.local.js"
                );
                frisby
                    .get("http://localhost:1337/subdir/")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN SUBDIR/)
                    .done(done);
            });
        });

        describe("when routing to remote host", () => {
            it("should resolve root dir without trailing slash", async done => {
                const { server, port } = await serve(
                    "spec/helpers/configs/root-and-subdir/",
                    4014
                );
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.remote.js"
                );
                frisby
                    .get("http://localhost:1337")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN ROOT DIR/)
                    .done(() => {
                        server.close();
                        done();
                    });
            });
            it("should resolve root dir with trailing slash", async done => {
                const { server, port } = await serve(
                    "spec/helpers/configs/root-and-subdir/",
                    4014
                );
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.remote.js"
                );
                frisby
                    .get("http://localhost:1337/")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN ROOT DIR/)
                    .done(() => {
                        server.close();
                        done();
                    });
            });
            it("should resolve subdir without trailing slash", async done => {
                const { server, port } = await serve(
                    "spec/helpers/configs/root-and-subdir/",
                    4014
                );
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.remote.js"
                );
                frisby
                    .get("http://localhost:1337/subdir")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN SUBDIR/)
                    .done(() => {
                        server.close();
                        done();
                    });
            });
            it("should resolve subdir with trailing slash", async done => {
                const { server, port } = await serve(
                    "spec/helpers/configs/root-and-subdir/",
                    4014
                );
                await spandx.init(
                    "../spec/helpers/configs/root-and-subdir/spandx.remote.js"
                );
                frisby
                    .get("http://localhost:1337/subdir/")
                    .expect("status", 200)
                    .expect("bodyContains", /INDEX IN SUBDIR/)
                    .done(() => {
                        server.close();
                        done();
                    });
            });
        });
    });

    describe("portal chrome", () => {
        it("should resolve SPA comments into Portal Chrome on local routes", async done => {
            await spandx.init(
                "../spec/helpers/configs/portal-chrome/spandx.local.js"
            );
            const res = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://localhost:1337/test-page.html");

            expect(res.body).toMatch(/HEAD CONTENT/);
            expect(res.body).toMatch(/HEADER CONTENT/);
            expect(res.body).toMatch(/FOOTER CONTENT/);

            done();
        });
        it("should resolve SPA comments into Portal Chrome on single host routes", async done => {
            const { server, port } = await serve(
                "spec/helpers/configs/portal-chrome/",
                4014
            );
            await spandx.init(
                "../spec/helpers/configs/portal-chrome/spandx.single.js"
            );
            const res = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://localhost:1337/test-page.html");

            expect(res.body).toMatch(/HEAD CONTENT/);
            expect(res.body).toMatch(/HEADER CONTENT/);
            expect(res.body).toMatch(/FOOTER CONTENT/);

            server.close();
            done();
        });
        it("should resolve SPA comments into Portal Chrome on multi host routes", async done => {
            const { server: server1 } = await serve(
                "spec/helpers/configs/portal-chrome/",
                4014
            );
            const { server: server2 } = await serve(
                "spec/helpers/configs/portal-chrome/",
                4015
            );
            await spandx.init(
                "../spec/helpers/configs/portal-chrome/spandx.single.js"
            );
            const res = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://localhost:1337/test-page.html");

            expect(res.body).toMatch(/HEAD CONTENT/);
            expect(res.body).toMatch(/HEADER CONTENT/);
            expect(res.body).toMatch(/FOOTER CONTENT/);

            const res2 = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://127.0.0.1:1337/test-page.html");

            expect(res2.body).toMatch(/HEAD CONTENT/);
            expect(res2.body).toMatch(/HEADER CONTENT/);
            expect(res2.body).toMatch(/FOOTER CONTENT/);

            server1.close();
            server2.close();
            done();
        });
        it("should rewrite URLs within Portal Chrome snippets, on single host routes", async done => {
            const { server, port } = await serve(
                "spec/helpers/configs/portal-chrome/",
                4014
            );
            await spandx.init(
                "../spec/helpers/configs/portal-chrome/spandx.single.js"
            );
            const res = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://localhost:1337/test-page.html");

            expect(res.body).toMatch(/localhost:1337/);
            expect(res.body).not.toMatch(/localhost:4014/);

            server.close();
            done();
        });
        it("should rewrite URLs within Portal Chrome snippets, on multi host routes", async done => {
            const { server: server1 } = await serve(
                "spec/helpers/configs/portal-chrome/",
                4014
            );
            const { server: server2 } = await serve(
                "spec/helpers/configs/portal-chrome/",
                4015
            );
            await spandx.init(
                "../spec/helpers/configs/portal-chrome/spandx.multi.js"
            );
            const res = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://localhost:1337/test-page.html");

            expect(res.body).toMatch(/localhost:1337/);
            expect(res.body).not.toMatch(/localhost:4014/);

            const res2 = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://127.0.0.1:1337/test-page.html");

            expect(res2.body).toMatch(/localhost:1337/);
            expect(res2.body).not.toMatch(/localhost:4015/);

            server1.close();
            server2.close();
            done();
        });
        it("should not resolve SPA comments into Portal Chrome when config says not to", async done => {
            await spandx.init(
                "../spec/helpers/configs/portal-chrome/spandx.chrome-off.js"
            );
            const res = await frisby
                .setup({
                    request: {
                        headers: {
                            Accept: "text/html,*/*"
                        }
                    }
                })
                .get("http://localhost:1337/test-page.html");

            expect(res.body).not.toMatch(/HEAD CONTENT/);
            expect(res.body).not.toMatch(/HEADER CONTENT/);
            expect(res.body).not.toMatch(/FOOTER CONTENT/);

            done();
        });
    });

    describe("URL rewriting", () => {
        describe("when routing to local directories", () => {
            it("should rewrite URLs to match the spandx origin", async done => {
                await spandx.init(
                    "../spec/helpers/configs/url-rewriting/spandx.local.js"
                );
                frisby
                    .setup({
                        request: {
                            headers: {
                                Accept: "text/html,*/*"
                            }
                        }
                    })
                    .get("http://localhost:1337/")
                    .expect("status", 200)
                    .expect("bodyContains", /URL REWRITING INDEX/)
                    .expect("bodyContains", "//localhost:1337")
                    .done(done);
            });
        });
        describe("when routing to remote directories", () => {
            it("should rewrite URLs to match the spandx origin", async done => {
                const { server, port } = await serve(
                    "spec/helpers/configs/url-rewriting/",
                    4014
                );
                await spandx.init(
                    "../spec/helpers/configs/url-rewriting/spandx.remote.js"
                );
                frisby
                    .setup({
                        request: {
                            headers: {
                                Accept: "text/html,*/*"
                            }
                        }
                    })
                    .get("http://localhost:1337/")
                    .expect("status", 200)
                    .expect("bodyContains", /URL REWRITING INDEX/)
                    .expect("bodyContains", "//localhost:1337")
                    .done(() => {
                        server.close();
                        done();
                    });
            });
            it("should rewrite URLs when using multi-host", async done => {
                // serve prod dir and dev dir on different ports
                const { server: prodServer, port: prodPort } = await serve(
                    "spec/helpers/configs/single-multi/dev",
                    4014
                );
                const { server: devServer, port: devPort } = await serve(
                    "spec/helpers/configs/single-multi/prod",
                    4015
                );

                // launch spandx with two 'environments', dev and prod.  accessing
                // spandx by localhost should route requests to the 'dev' host, and
                // accessing spandx by 127.0.0.1 should route to the prod host.
                await spandx.init({
                    host: {
                        dev: "localhost",
                        prod: "127.0.0.1"
                    },
                    port: 1337,
                    silent: true,
                    routes: {
                        "/": {
                            host: {
                                dev: "http://localhost:4014",
                                prod: "http://localhost:4015"
                            }
                        }
                    }
                });

                const devReq = frisby
                    .setup({
                        request: {
                            headers: {
                                Accept: "text/html,*/*"
                            }
                        }
                    })
                    .get("http://localhost:1337/")
                    .expect("status", 200)
                    .expect("bodyContains", /localhost/);

                const prodReq = frisby
                    .setup({
                        request: {
                            headers: {
                                Accept: "text/html,*/*"
                            }
                        }
                    })
                    .get("http://127.0.0.1:1337/")
                    .expect("status", 200)
                    .expect("bodyContains", /127\.0\.0\.1/);

                // wait for both request's promises to
                // resolve, then close up shop
                await Promise.all([devReq._fetch, prodReq._fetch]);
                devServer.close();
                prodServer.close();
                done();
            });
        });
    });

    describe("remote fallback", () => {
        it("if a file is not found on a local route, attempt to fetch it from the '/' remote route", async done => {
            const { server, port } = await serve(
                "spec/helpers/configs/remote-fallback/remote-files",
                4014
            );
            await spandx.init(
                "../spec/helpers/configs/remote-fallback/spandx.config.js"
            );
            frisby
                .get("http://localhost:1337/subdir/remote-only.html")
                .expect("status", 200)
                .expect("bodyContains", /REMOTE ONLY/)
                .done(() => {
                    server.close();
                    done();
                });
        });
        it("if a file exists in both a local route and a remote '/' route, serve the local one", async done => {
            const { server, port } = await serve(
                "spec/helpers/configs/remote-fallback/remote-files",
                4014
            );
            await spandx.init(
                "../spec/helpers/configs/remote-fallback/spandx.config.js"
            );
            frisby
                .get("http://localhost:1337/subdir/index.html")
                .expect("status", 200)
                .expect("bodyContains", /LOCAL SUBDIR INDEX/)
                .done(() => {
                    server.close();
                    done();
                });
        });
    });

    describe("routing order", () => {
        it("should pick longer routes over shorter routes", async done => {
            const { server, port } = await serve(
                "spec/helpers/configs/route-order/",
                4014
            );

            await spandx.init(
                "../spec/helpers/configs/route-order/spandx.config.js"
            );

            frisby
                .get("http://localhost:1337/")
                .expect("status", 200)
                .expect("bodyContains", /^\//)
                .get("http://localhost:1337/a")
                .expect("status", 200)
                .expect("bodyContains", /^\/a/)
                .get("http://localhost:1337/a/b")
                .expect("status", 200)
                .expect("bodyContains", /^\/a\/b/)
                .get("http://localhost:1337/a/b/c")
                .expect("status", 200)
                .expect("bodyContains", /^\/a\/b\/c/)
                .done(() => {
                    server.close();
                    done();
                });
        });
    });

    describe("command-line flags and output", () => {
        const configPathRel = "./spandx.config.js";
        it("init should generate a sample config", () => {
            const sampleConfig = fs.readFileSync("spandx.config.js").toString();
            const stdout = execSync("node app/cli.js init").toString();
            // ensure `spandx init` output matches the sample config file
            expect(stdout.trim() === sampleConfig.trim()).toBeTruthy();
        });
        it("can be executed with no arguments", async done => {
            // launch spandx and scan the output for desired strings
            const shell = execFile(`app/cli.js`);
            let urlPrompted = false;
            let urlPrinted = false;
            shell.stdout.on("data", data => {
                // these ifs look weird, but since the stdout is available only
                // in chunks, we need to check if this is the right chunk
                // before expect()ing it toContain() the strings we're looking
                // for.
                if (!urlPrompted && data.includes("spandx URL")) {
                    urlPrompted = true;
                    expect(data).toContain("spandx URL");
                }
                if (!urlPrinted && data.includes("http://localhost:")) {
                    urlPrinted = true;
                    expect(data).toContain("http://localhost:");
                }
                if (urlPrompted && urlPrinted) {
                    shell.kill();
                    done();
                }
            });
            shell.stderr.on("data", err => {
                fail(err);
                done();
            });
        });
        it("-c should accept a relative config file path", async done => {
            // launch spandx and scan the output for desired strings
            const shell = execFile(`app/cli.js`, [`-c`, `${configPathRel}`]);
            let urlPrompted = false;
            let urlPrinted = false;
            shell.stdout.on("data", data => {
                // these ifs look weird, but since the stdout is available only
                // in chunks, we need to check if this is the right chunk
                // before expect()ing it toContain() the strings we're looking
                // for.
                if (!urlPrompted && data.includes("spandx URL")) {
                    urlPrompted = true;
                    expect(data).toContain("spandx URL");
                }
                if (!urlPrinted && data.includes("http://localhost:")) {
                    urlPrinted = true;
                    expect(data).toContain("http://localhost:");
                }
                if (urlPrompted && urlPrinted) {
                    shell.kill();
                    done();
                }
            });
            shell.stderr.on("data", err => {
                fail(err);
            });
        });
        it("-c should accept a absolute config file path", async done => {
            // launch spandx and scan the output for desired strings
            const shell = execFile(`app/cli.js`, [
                `-c`,
                `${path.resolve(__dirname, "../../", configPathRel)}`
            ]);
            let urlPrompted = false;
            let urlPrinted = false;
            shell.stdout.on("data", data => {
                // these ifs look weird, but since the stdout is available only
                // in chunks, we need to check if this is the right chunk
                // before expect()ing it toContain() the strings we're looking
                // for.
                if (!urlPrompted && data.includes("spandx URL")) {
                    urlPrompted = true;
                    expect(data).toContain("spandx URL");
                }
                if (!urlPrinted && data.includes("http://localhost:")) {
                    urlPrinted = true;
                    expect(data).toContain("http://localhost:");
                }
                if (urlPrompted && urlPrinted) {
                    shell.kill();
                    done();
                }
            });
            shell.stderr.on("data", err => {
                fail(err);
            });
        });
    });
});
