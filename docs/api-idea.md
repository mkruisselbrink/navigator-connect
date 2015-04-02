## Client side API
```webidl
[NoInterfaceObject, Exposed=(Window,Worker)]
interface NavigatorConnect {
  Promise<MessagePort> connect(USVString url);
};

Navigator implements NavigatorConnect;
WorkerNavigator implements NavigatorConnect;
```

## Service side API
```webidl
partial interface ServiceWorkerGlobalScope {
  attribute EventHandle onconnect;
};

[Exposed=ServiceWorker]
interface ConnectEvent {
  readonly attribute USVString targetURL;
  readonly attribute USVString origin;
  Promise<MessagePort> acceptConnection(Promise<boolean> shouldAccept, optional ConnectOptions options);
};

dictionary ConnectOptions {
  DOMString? persistAs;
};
```

 * `ConnectEvent` is not a `MessageEvent`, since the event wouldn't have any data/message anyway, and additionally having a `.source` attribute as well as an `acceptConnection` method requires hard to understand/explain behavior.
 * `targetURL` is the url the connection was made to, always within the scope of the service worker.
 * `origin` is the origin of the client that setup the connection.
 * `acceptConnection` accepts or rejects the connection, if optional `options.persistAs` is passed the source `MessagePort` will be persisted with `name`=`options.persistAs`.
 * If `persistAs` is passed, the promise returned by `acceptConnection` will resolve to a `PersistentMessagePort` instance, otherwise a regular `MessagePort`.

## Persisted MessagePorts

```webidl
partial interface ServiceWorkerGlobalScope {
  readonly attribute PersistedPortCollection ports;
};

[Exposed=ServiceWorker]
interface PersistedPortCollection : EventTarget {
  // Persists a port, returns the persistent port. The original |port|
  // will be neutered by this.
  PersistentMessagePort add(DOMString name, MessagePort port);

  // Returns all entangled persisted ports for this service worker
  // registration matching the name.
  Promise<sequence<PersistentMessagePort>> match(DOMString name);

  // Event that is triggered whenever a persisted port receives a message.
  // Could just as well be the global onmessage event instead.
  // The .source of the MessageEvent is the PersistentMessagePort instance.
  attribute EventHandler onmessage;
};

// Extends MessagePort with a |name| attribute. Besides that ports that are
// an instance of PersistentMessagePort won't fire their own omessage event.
// Neutering a PersistentMessagePort (for example when transferred) will also
// remove it from PersistedPortCollection.
[Exposed=ServiceWorker]
interface PersistentMessagePort : MessagePort {
  readonly attribute DOMString name;
};
```

 * It's weird to have things that are scoped to a Service Worker Registration exposed via `ServiceWorkerGlobalScope` (generally attributes on the global scope give access to things that are per origin).
 * Persisted ports do have to be scoped to a Registration though. A persisted port needs to know what registration to spin up to deliver a message.
 * Exposing this on `ServiceWorkerRegistration` has its own sets of problems though. Ordering and other semantics become very complicated if multiple clients and service workers can access/send messages through the same ports at the same time (even if messages are still only delivered to the service worker, and not every context that has access to the port).
 * Similarly while persisting a port for a service worker from a client might be nice, that can be done just as easily by just postMessageing he port to the service worker and having the service worker persist the port. That way it's always clear what context "owns" a port.
 * On the other hand, even if a per-registration set of persisted ports is only exposed via `ServiceWorkerGlobalScope`, multiple service workers for the same registration would still have access to the same collection of ports. So some of the issues with multiple owners for the same port would still have to be worked out.
 * In particular it might become important to figure out which version of a particular service worker registration should get messages; one option would be the active worker, but that could cause problems if a SW wants to persist a connection during install (or activate?).

# Examples
```js
// http://acme.com/webapp.js
navigator.connect('https://example.com/services/echo').then(
  function(port) {
    port.postMessage('hello');
    port.onmessage = function(event) {
      // Handle reply from the service.
    };
  }
);
```

```js
// https://example.com/serviceworker.js
self.addEventListener('connect', function(event) {
  // Optionally check event.origin to determine if that origin should be
  // allowed access to this service.
  event.acceptConnection(event.targetUrl === 'https://example.com/services/echo')
    .then(function(port) {
      port.addEventListener('message', function(event) {
        // Set up a listener
      });
      port.postMessage('You are connected!');
      // Port isn't persisted, so when the service worker is killed the
      // connection will be closed.
    });
});
```

```js
// https://example.com/serviceworker.js
self.addEventListener('connect', function(event) {
  // Optionally check event.origin to determine if that origin should be
  // allowed access to this service.
  event.acceptConnection(event.targetUrl === 'https://example.com/services/echo',
                         {persistAs: 'echoClient'})
    .then(function(port) {
      port.postMessage('You are connected!');
    });
});

self.ports.addEventListener('message', function(event) {
  if (event.source.name === 'echoClient') {
    event.source.postMessage(event.data);
  }
});

self.addEventListener('push', function(event) {
  event.waitUntil(self.ports.match('pushClient').then(
    (ports) => ports.forEach((port) => port.postMessage('received push'))));
});
```

```js
// https://acme.com/sw.js
self.addEventListener('install', function(event) {
  event.waitUntil(navigator.connect('https://example.com/services/analytics')
    .then((port) => self.ports.add('analytics', port)));
});

self.addEventListener('fetch', function(event) {
  self.ports.match('analytics').then((ports) => ports[0].postMessage('log fetch'));
});
```
