// Polyfill that allows navigator.connect connections to service workers that
// include service-polyfill.js.
// navigator.connect returns a promise that resolves to a MessagePort on
// succesfull connection to a service.
if (!navigator.connect) {
  navigator.connect = function(url) {
    var slashIdx = url.indexOf('/', 10);
    var origin = url.substr(0, slashIdx);
    var iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    var p = new Promise(function(resolve, reject) {
      iframe.onload = function(event) {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
          if (event.data.connected)
            resolve(event.data.connected);
          else
            reject({code: 20});
        };
        iframe.contentWindow.postMessage({connect: channel.port2}, '*', [channel.port2]);
      };
    });
    iframe.setAttribute('src', url + '?navigator-connect-service');
    document.body.appendChild(iframe);
    return p;
  };
}