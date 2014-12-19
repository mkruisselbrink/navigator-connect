# Design Alternatives

This document outlines the various designs that have been proposed for cross-origin communication between ServiceWorkers. It also includes ideas for features/optimizations of the implementation that are of interest, but perhaps not core to the fundamental design.

This document is meant to be a work in progress that should be updated as new designs and ideas are brought to the table.

## Designs for Cross-Origin Communication Between Service Workers

### MessagePorts

   - `navigator.connect("https://example.com/services/v1")` can be accepted/rejected by a Service Worker that has registered to handle this URL
   - A `MessagePort` is opened between the origins on accept
   - Explicit connection attempt to a Service Worker allows potential for browser to pull down the Service Worker if it is not installed
  - We _need_ to make `Request`s and `Response`s StructuredCloneable or Transferable for this to be convenient.

#### Code to forward and intercept an existing API might look like:

The user SW would write something like:
```javascript
quxxyApi = navigator.connect('https://api.quxxy.com/v1/');
quxxyReplies = new Map();
quxxyNextRequestId = 0;
quxxyApi.then(port => {
  port.onmessage = e => {
    quxxyReplies.get(e.data.requestId).resolve(e.data.response);
    quxxyReplies.delete(e.data.requestId);
  };
});
onfetch = e => {
  if (e.request.url.startsWith('https://api.quxxy.com/v1/')) {
    e.respondWith(quxxyApi.then(port => {
      return new Promise((resolve, reject) => {
        var requestId = quxxyNextRequestId++;
        port.postMessage({requestId: requestId, request: e.request});
        quxxyReplies.set(requestId, {resolve: resolve});
      });
    });
    return;
  }
  // ...
};
```

and `quxxy`'s SW would write:
```javascript
oncrossoriginconnect = e => {
  e.acceptConnection(Promise.resolve(true));
};
oncrossoriginmessage = e => {
  handleApiRequest(e.origin, parse(e.data.request)).then((result1, result2) => {
    e.source.postMessage({
      requestId: e.data.requestId,
      response: serialize(result1, result2),
    });
  });
};
```

#### Code to forward and intercept a new API might look like:

The user's foreground page _or_ SW could write:
```javascript
quxxyApi = navigator.connect('https://api.quxxy.com/v2/');
quxxyReplies = new Map();
quxxyNextRequestId = 0;
quxxyApi.then(port => {
  port.onmessage = e => {
    quxxyReplies.get(e.data.requestId).resolve(e.data);
    quxxyReplies.delete(e.data.requestId);
  };
});
quxxyApi.then(port => {
  return new Promise((resolve, reject) => {
    var requestId = quxxyNextRequestId++;
    port.postMessage({
      requestId: requestId,
      param1: "Hello",
      param2: "World",
    });
    quxxyReplies.set(requestId, {resolve: resolve});
  }).then(result => {
    use(result.response1, result.response2);
  });
```

and `quxxy`'s SW would write:
```javascript
oncrossoriginconnect = e => {
  e.acceptConnection(Promise.resolve(true));
};
oncrossoriginmessage = e => {
  handleApiRequest(e.origin, e.data.param1, e.data.param2).then((result1, result2) => {
    e.source.postMessage({
      requestId: e.data.requestId,
      result1: result1,
      result2: result2,
    });
  });
};
```

### Local look-aside `fetch()`

   - A `local_fetch()` request to `https://example.com/services/v1` is routed to a local Service Worker if one is installed
   - The `local_fetch()` does not then go to the network if no Service Worker is installed for the relevant scope
   - This is also a somewhat explicit connection attempt to a Service Worker, so the browser could potentially pull down the Service Worker if it is not installed

### Universal look-aside `fetch()`

   - Same as the local look-aside `fetch()`, except if no Service Worker is installed for the relevant scope, then the `fetch()`` goes to the network just as it would in today's world
   - This new mode for `fetch()` would need to be enabled explicitly, either as an option in the `Request` or as a new kind of scope the cross-origin Service Worker could opt into.

#### Code to intercept an existing API might look like:

The user SW would write something like:
```javascript
onfetch = e => {
  if (e.request.url.startsWith('https://api.quxxy.com/v1/')) {
    e.respondWith(e.default());
    return;
  }
```
If the user doesn't have a SW, they wouldn't need to write one.

`quxxy`'s SW would write:
```javascript
oninstall = e => {
  ...
  self.subresourceOverrideScopes.add('https://api.quxxy.com/v1/');
}
onfetch = e => {
  e.respondWith(handleApiRequest(parse(e.request)));
};
```

## Features & Optimizations

### `MessagePort` lifetime management

[Stashed MessagePorts](https://gist.github.com/mkruisselbrink/536632fcd99d45005064) would allow a Service Worker to transfer a `MessagePort` to or from "external" ownership, in order to allow any `MessagePort` to outlive the JavaScript context of a Service Worker.

A variant of this idea might allow a Service Worker to keep using the `MessagePort` as an object, but record that it should be stashed when the Service Worker is destroyed.
Then the top-level script could reconstitute its object graph, including `MessagePort`s when it receives a message.
