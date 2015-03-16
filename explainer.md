# `navigator.connect()` Explained

## What's This All About?

`navigator.connect()` is like `postMessage` to/from `<iframe>`s, but without the need for documents.

This comes up in the context of [Service Workers](https://github.com/slightlyoff/ServiceWorker/blob/master/explainer.md): can one Service Worker consult another when there's no direct `postMessage()` interface and when all requests from a document go to the controlling SW and not the origin which might be the destination of the request?

`navigator.connect()` provides an explicit API for having conversations with third-party Service Workers, both for handling fetches (see the Fonts discussion below) and for generic RPC to other local services.

We also discuss mechanisms for low-friction Service Worker installation which also do not require documents (thus skipping the "`<iframe>` dance").

## We Have Both Kinds of Connections: Network _and_ `postMessage()`

Service Workers offer two types of communication channel with documents:

- `postMessage` for explicit, potentially long-lived, communication and coordination
- `onfetch` event handling & response

The `onfetch` channel is implicit. Registering a Service Worker and scope creates the necessary mapping for browsers to decide that a SW is competent to handle top-level fetches for documents which match the scope and registration. Subsequent sub-resource requests are routed to the originating SW (creating more `onfetch` events).

The `postMessage` channel is made available through Service Worker Registration Objects and through the `clients` collection (inside the SW execution context).

Until `navigator.connect()`, applications which wished to communicate to cross-origin Service Workers needed to create `<iframe>`s to create a cross-origin `postMessage` channel -- meaning that Service Workers were unable to talk to other Service Workers as `<iframe>`s are not available inside Service Workers contexts.

There has been no ability to date to allow a cross-origin Service Workers to handle `onfetch` events for resource requests (not navigations).

### Inter-App RPC

One of the most tantalizing futures for Service Workers is the ability to mash-up services locally. Installed application platforms have many ways of accomplishing this today, but the web platform has missed out. [Various](https://code.google.com/p/webintroducer/) [attempts](http://webintents.org/) [to solve this problem](https://developer.mozilla.org/en-US/docs/Web/API/Web_Activities) have failed to reach consensus and remain out of reach of developers.

Instead, `postMessage()` between `<iframe>`s remains the state of the art. This presents a problem in background execution contexts like Service Workers which do not have DOMs (owing to the memory and model issues resulting from DOM-in-workers). This is unsatisfying.

We propose `navigator.connect()` as a way of enabling `postMessage()` style cross-origin communcation to (and from) Service Workers:

```js
// http://acme.com/client.js
navigator.connect('https://example.com/services/foobar')
  .then(function(port) {
      // do something with the MessagePort
    });

// https://example.com/service-sw.js
self.addEventListener('connect', function(e) {
  // check e.origin, e.targetUrl
  // do something with the port in e.port
});
```

But what about long lived connections? If all the service worker gets is a `MessagePort`, the connection would automatically be severed as soon as the Service Worker gets unloaded, so we need some way to persist a `MessagePort` accross reloading the service worker. Also keep in mind that both the client and the service side of a connection could be a Service Worker. To solve this, we propose a new mechanism superficially similar to [PortCollection](https://html.spec.whatwg.org/multipage/comms.html#broadcasting-to-many-ports) that enables a Service Worker to mark a `MessagePort` as long-lived.

This could look something like this:

```js
// https://acme.com/client-sw.js
navigator.connect('https://example.com/services/foobar')
  .then(function(port) {
      self.ports.add('foobar', port);
    });

// After saving the port, future messages arrive in a separate onmessage event
self.ports.addEventListener('message', function(e) {
  // do something with the MessageEvent
});
```

### Solving the Fonts Problem

Cross-origin composition is a key feature of the web platform. Today, Service Workers enable sites to use and compose third-party resources by storing `CORSResponse` and `OpaqueResponse` instances in `caches`. These cross-origin resources are requested from the perspective of the first-party and stored by the first-party without any further ability (post initial fetch) for the third party to participate.

This creates global coordination challenges.

For instance, many [Web Fonts are available in large numbers of localised variants](https://www.google.com/get/noto/), primarialy to reduce the total overhead on the wire of sending and storing an "entire" font. Sites individually request these fonts which can be as large as the tens of megabytes per language. Codepoint subsetting and other exotic techniques help, but they only optimise the per-site case. Using a webfonts service across many CJK sites may create dozens of overlapping-but-exclusive subsets of a particular font on disk and in cache, with separate update timeframes and download strategies per site. This is clearly sub-optimal.

A more global perspective might allow a site to request a CJK font subset _from the Service Worker for the webfonts service_. Such a Service Worker could intelligently manage caches, updates, and re-compute subsets based on more optimal knowledge of patterns-of-use.

We propose extensions to Service Workers that enable opt-in fall-through fetch handling to enable this scenario.

For instance, `https://example.com` may wish to use a subsetted webfont from `https://fonts.example.com`. Since these are separate origins, they do not share Service Workers. The following snippet shows how a Service Worker for `https://fonts.example.com` can handle font requests for `https://example.com` (and any other origin), even if they have Service Workers.

```js
// https://fonts.example.com/sw.js
self.addEventListener('install', function(e) {
  // Registration in the install phase allows changes as the SW updates
  e.handleFallThroughRequests(['/resources', '/font']);
});

self.addEventListener('fetch', function(e) {
  if (e.isFallThrough) {
    // This is a fallthrough request, handle it
  }
});
```

The key thing to note is that the `https://fonts.example.com` Service Worker is granted a "saving throw" for matching requests. Once `https://example.com`'s Service Worker lets the request go to the network,  `https://fonts.example.com` finally gets the chance to handle the fetch.

An interesting wrinkle is how such a SW would get bootstrapped. We discuss one option in the next section.

## Mommy, Where Do Service Workers Come From?

Since both connection types require the target service worker to actually be installed before communication is possible, a new way of installing a service worker is needed. To enable this we introduce two new headers as part of the http response for any resource:

```
Service-Worker-Scope: scopeURL
Service-Worker-Script: scriptURL
```

Note that in conjuction with these headers, the `Service-Worker-Allowed` header in the response to the actual script fetch, if present, is used to set the maximum scope allowed.

When the `Service-Worker-Scope` header is absent, the scope defaults to the script's location. The maximum scope allowed is the script's location by default, but if the `Service-Worker-Allowed` header is given, the maximum scope allowed is set to its value.

Whenever these headers are present, the browser will install a service worker in the background (not blocking the original request), allowing future communication with the new service worker.

Concretely, this http response:

```
GET HTTPS://api.thirdparty.org/share/assets/pak.png
status:200 OK
content-length:3852
content-type:image/png
Service-Worker-Scope: /share/
Service-Worker-Script: /common/share/sw.js
[...]
```

will lead to fetching /common/share/sw.js for which we would expect the following response:

```
GET HTTPS://api.thirdparty.org/common/share/sw.js
status:200 OK
Content-Encoding:gzip
Content-Length:971
Content-Type:text/javascript; charset=utf-8
Service-Worker-Allowed: /share/
```

as a result will eventually behave as if some page on HTTPS://api.thirdparty.org executed the following javascript code in the background:

```js
// Note: Without "Service-Worker-Allowed: /share/" header, the installation fails.
navigator.serviceworker.register('/common/share/sw.js', {scope: '/share/'});
```
