# spandx & Red Hat Customer Portal

This is a guide for adding spandx to any application that is part of the Red Hat Customer Portal ([access.redhat.com](https://access.redhat.com)).

## Quick-start

First, add spandx as a devDependency of your project.

```
npm i -D spandx
```

Then, answer a few questions to create a `spandx.config.js`.

```
npx spandx init cp
```

If you need to, add local DNS entries for `*.foo.redhat.com`. If you aren't sure if you nee this, it's safe to go ahead and run it. Note: you'll probably need to `sudo` this command, but if you aren't comfortable doing that, run it without sudo and it will print out what you need to paste into `/etc/hosts`.

```
npx spandx init cp addhosts
```

## Portal Chrome settings

This section describes the Portal Chrome-specific settings in more detail. The `spandx init cp` command sets good defaults for Customer Portal work, but if you need to customize the settings, read on.

Portal Chrome settings live in your spandx config file under the `portalChrome` property.

### Resolving SPA comments, such as `<!-- SPA_HEAD -->`

spandx can replace these comments with their corresponding Portal Chrome parts:

-   `<!-- SPA_HEAD -->` &larr; `/services/chrome/head`
-   `<!-- SPA_HEADER -->` &larr; `/services/chrome/header`
-   `<!-- SPA_FOOTER -->` &larr; `/services/chrome/footer`

This can be enabled in your spandx.config.js file with the following setting.

```js
module.exports = {
    portalChrome: {
        resolveSPAComments: true,
    },
};
```

If `resolveSPAComments` is true, spandx will inject Portal Chrome into any `text/html` request that passes through. It looks for the following placeholder comments and will replace them with the corresponding chrome part.

| comment               | location                 | description                                                     |
| --------------------- | ------------------------ | --------------------------------------------------------------- |
| `<!-- SPA_HEAD -->`   | within your `<head>` tag | will be replaced with the contents of `/services/chrome/head`   |
| `<!-- SPA_HEADER -->` | just after `<body>`      | will be replaced with the contents of `/services/chrome/header` |
| `<!-- SPA_FOOTER -->` | just before `</body>`    | will be replaced with the contents of `/services/chrome/footer` |

This setting involves making requests to `/services/chrome/*`, which brings up the question of which host to fetch the chroming from. To make this as easy as possible, this feature taps into your existing spandx routes. In short, if you can hit `/services/chrome/head` from your spandx host, you'll be fine.

For example, if you're routing `/app` to your local application and everything else to the Customer Portal, spandx will be able to resolve `/services/chrome/*` just fine.

```js
routes: {
    '/app' : { host: "http://localhost:8080" },
    '/'    : { host: 'https://access.redhat.com' }
}
```

## Primer settings

Primer is an upcoming re-imagining of Portal Chrome.

### Preview Primer head/header/footer

This feature allows grafting HTML template changes into an existing page, even on a remote server, effectively previewing what the changes will look like when they are deployed to that server.

With `primer.preview` set to `true`, spandx detects the head, header, and footer (the "parts") in Customer Portal pages you visit and replaces them with fresh Primer parts fetched from `/services/primer`.  You can control the routing of this request in your `routes` object.
```js
module.exports = {
    primer: {
        preview: true,
    },
};
```

Primer's head, header, and footer parts are wrapped with comments which are used as tokens to identify the location of each part. These tokens facilitate the removal of old parts and injection of fresh parts.

The wrapper comment tokens look like this:

-   `<!-- CP_PRIMER_HEAD --> ... <!-- /CP_PRIMER_HEAD -->`
-   `<!-- CP_PRIMER_HEADER --> ... <!-- /CP_PRIMER_HEADER -->`
-   `<!-- CP_PRIMER_FOOTER --> ... <!-- /CP_PRIMER_FOOTER -->`
