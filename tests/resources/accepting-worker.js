importScripts('../../polyfill/service-polyfill.js');

self.addEventListener('foreignconnect', function(event) {
  event.acceptConnection(true);
});
