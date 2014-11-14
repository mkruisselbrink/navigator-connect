importScripts('../../polyfill/service-polyfill.js');

self.addEventListener('crossoriginconnect', function(event) {
  event.acceptConnection(true);
});
