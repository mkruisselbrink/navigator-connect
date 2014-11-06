// Polyfill for the service worker side of navigator.connect. This is not quite
// a perfect polyfill since it doesn't perfectly mimic what the actual API will
// look like.
//
// To use this polyfill, add eventhandlers by calling addEventListener.
// Assigning to onforeignconnnect/onforeignmessage isn't supported.
//
// Furthermore this polyfill might interfere with normal use of fetch and
// message events, although it tries to only handle fetch and message events
// that are specifically related to navigator.connect usage.
//
// The objects passed to foreignmessage and foreignconnect event handlers aren't
// true events, or even objects of the right type. Additionally these 'event'
// objects don't include all the fields the real events should have.
(function(self){

if ('onforeignconnect' in self) return;

var kForeignConnectMessageTag = 'foreignConnect';
var kForeignMessageMessageTag = 'foreignMessage';
var kUrlSuffix = '?navigator-connect-service';

var customListeners = {'foreignconnect': [], 'foreignmessage': []};

var addEventListener = self.addEventListener;
self.addEventListener = function(type, listener, useCapture) {
  if (type in customListeners) {
    customListeners[type].push(listener);
  } else {
    return addEventListener(type, listener, useCapture);
  }
};

function dispatchCustomEvent(type, event) {
  for (var i = 0; i < customListeners[type].length; ++i) {
    customListeners[type][i](event);
  }
}

self.addEventListener('fetch', function(event) {
  var targetUrl = event.request.url;
  if (targetUrl.indexOf(kUrlSuffix, targetUrl.length - kUrlSuffix.length) === -1) {
    // Not a navigator-connect attempt
    return;
  }
  // In the real world this should not reply to all fetches.
  event.respondWith(
    new Response("<!DOCTYPE html><script>" +
      "window.onmessage = function(e) {\n" +
//      "console.log(e);\n" +
        "if ('connect' in e.data) {\n" +
          "var service_channel = new MessageChannel();\n" +
          "service_channel.port1.onmessage = function(ep) {\n" +
//          "console.log(ep);\n" +
            "if (!ep.data.connectResult) {\n" +
              "e.data.connect.postMessage({connected: false});\n" +
              "return;\n" +
            "}\n" +
            "var client_channel = new MessageChannel();\n" +
            "client_channel.port1.onmessage = function(ec) {\n" +
              "var msg_channel = new MessageChannel();\n" +
              "msg_channel.port1.onmessage = function(em) {\n" +
                "client_channel.port1.postMessage(em.data, em.ports);\n" +
              "};\n" +
              "navigator.serviceWorker.controller.postMessage({" + kForeignMessageMessageTag + ": ec.data, port: msg_channel.port2}, [msg_channel.port2]);\n" +
            "};\n" +
            "e.data.connect.postMessage({connected: client_channel.port2}, [client_channel.port2]);\n" +
          "};\n" +
          "navigator.serviceWorker.controller.postMessage({" + kForeignConnectMessageTag + ": document.location.href, port: service_channel.port2}, [service_channel.port2]);\n" +
        "}\n" +
      "};</script>",
                 {headers: {'content-type': 'text/html'}})
  );
  event.stopImmediatePropagation();
});

function handleForeignConnect(data) {
  var replied = false;
  var targetUrl = data[kForeignConnectMessageTag];
  if (targetUrl.indexOf(kUrlSuffix, targetUrl.length - kUrlSuffix.length) !== -1) {
    targetUrl = targetUrl.substr(0, targetUrl.length - kUrlSuffix.length);
  }
  dispatchCustomEvent('foreignconnect', {
    acceptConnection: function(accept) {
      replied = true;
      data.port.postMessage({connectResult: accept});
    },
    targetUrl: targetUrl
  });
  if (!replied)
    data.port.postMessage({connectResult: false});
}

function handleForeignMessage(event) {
  var ports = [];
  for (var i = 0; i < event.ports; ++i) {
    if (event.ports[i] != event.data.port) ports.push(even.ports[i]);
  }
  var foreignMessageEvent = {
    data: event.data[kForeignMessageMessageTag],
    ports: ports,
    source: {
      postMessage: function(msg, transfer) {
        event.data.port.postMessage(msg, transfer);
      }
    }
  };
  dispatchCustomEvent('foreignmessage', foreignMessageEvent);
}

self.addEventListener('message', function(event) {
  // In the real world this should be more careful about what messages to listen to.
  if (kForeignConnectMessageTag in event.data) {
    handleForeignConnect(event.data);
    event.stopImmediatePropagation();
    return;
  }
  if (kForeignMessageMessageTag in event.data) {
    handleForeignMessage(event);
    event.stopImmediatePropagation();
    return;
  }
});

})(self);