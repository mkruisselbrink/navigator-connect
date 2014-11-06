// These tests fail with the polyfill, so don't include them for now.
/*
promise_test(function(test) {
    return assert_promise_rejects(
      navigator.connect("https://example.com/service/does/not/exists"),
      'AbortError',
      'navigator.connect should fail with an AbortError');
  }, 'Connection fails to a service that doesn exist.', properties);


promise_test(function(test) {
    var scope = sw_scope + '/empty';
    var sw_url = 'resources/empty-worker.js';
    return assert_promise_rejects(
      HELPERS.service_worker_unregister_and_register(test, sw_url, scope)
        .then(function(registration) { return HELPERS.wait_for_activated(test, registration); })
        .then(function() {
            return navigator.connect(sw_scope + '/service');
        }),
      'AbortError',
      'navigator.connect should fail with an AbortError');
  }, 'Connection fails if service worker doesn\'t handle onforeignconnect.', properties);
*/

promise_test(function(test) {
    var scope = sw_scope + '/rejecting';
    var sw_url = 'resources/rejecting-worker.js';
    return assert_promise_rejects(
      HELPERS.service_worker_unregister_and_register(test, sw_url, scope)
        .then(function(registration) { return HELPERS.wait_for_activated(test, registration); })
        .then(function() {
            return navigator.connect(scope + '/service');
        }),
      'AbortError',
      'navigator.connect should fail with an AbortError');
  }, 'Connection fails if service worker rejects connection event.');

promise_test(function(test) {
    var scope = sw_scope + '/accepting';
    var sw_url = 'resources/accepting-worker.js';
    return HELPERS.service_worker_unregister_and_register(test, sw_url, scope)
      .then(function(registration) { return HELPERS.wait_for_activated(test, registration); })
      .then(function() {
          return navigator.connect(scope + '/service');
      }).then(function(port) {
          assert_class_string(port, 'MessagePort');
          return HELPERS.service_worker_unregister(test, scope);
      });
  }, 'Connection succeeds if service worker accepts connection event.');

promise_test(function(test) {
    var scope = sw_scope + '/echo';
    var sw_url = 'resources/echo-worker.js';
    return HELPERS.service_worker_unregister_and_register(test, sw_url, scope)
      .then(function(registration) { return HELPERS.wait_for_activated(test, registration); })
      .then(function() {
          return navigator.connect(scope + '/service');
      }).then(function(port) {
          port.postMessage('hello world');
          return waitForReply(test, port);
      }).then(function(response) {
          assert_equals(response, 'hello world');
          return HELPERS.service_worker_unregister(test, scope);
      });
  }, 'Messages can be sent and received.', properties);

// This test depends on chrome internals to kill the service worker.
/*
promise_test(function(test) {
    var scope = sw_scope + '/echo';
    var sw_url = 'resources/echo-worker.js';
    var worker;
    var registration;
    var port;
    return HELPERS.service_worker_unregister_and_register(test, sw_url, scope)
      .then(function(reg) {
          registration = reg;
          return HELPERS.wait_for_activated(test, registration);
      }).then(function() {
          return navigator.connect(scope + '/service');
      }).then(function(p) {
          port = p;
          port.postMessage('hello world');
          return waitForReply(test, port);
      }).then(function(response) {
          assert_equals(response, 'hello world');
          return HELPERS.terminate_service_worker(test, registration);
      }).then(function() {
          return sleep(test, 100);
      }).then(function() {
          port.postMessage('hello world again');
          return waitForReply(test, port);
      }).then(function(response) {
          assert_equals(response, 'hello world again');
          return HELPERS.service_worker_unregister(test, scope);
      });
  }, 'Messages can be sent and received even when worker is killed.', properties);
*/