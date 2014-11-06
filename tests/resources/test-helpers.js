
function waitForReply(t, port) {
  return new Promise(function(resolve) {
    var resolved = false;
    port.onmessage = t.step_func(function(event) {
      assert_false(resolved);
      resolved = true;
      resolve(event.data);
    });
  });
}

function sleep(t, ms) {
  return new Promise(function(resolve) {
    window.setTimeout(resolve, ms);
  });
}

// Calls |method| in |frame|, storing its output in |output| as well
// as resolving in the output.
function call_method_on_frame(t, frame, method, params, output) {
  var channel = new MessageChannel();
  var result = new Promise(function(resolve, reject) {
    var got_reply = false;
    channel.port1.onmessage = t.step_func(function(event) {
      assert_false(got_reply);
      got_reply = true;
      if (event.data.success)
        resolve(event.data.result);
      else
        reject(event.data.result);
    });
  });
  frame.contentWindow.postMessage(
      {method: method, params: params, output: output, port: channel.port2},
      '*', [channel.port2]);
  return result;
}

function terminate_service_worker(test, registration) {
  return get_newest_worker(registration)
    .then(test.step_func(function(worker) {
        return internals.terminateServiceWorker(worker);
    }));
}

var HELPERS = window;

function CrossOriginSWHelper(origin) {
  this.origin = origin;
  this.frame;
}

CrossOriginSWHelper.prototype.service_worker_unregister_and_register = function(test, url, scope) {
  var self = this;
  return with_iframe(self.origin + base_path() + 'resources/service-worker-loader.html')
    .then(test.step_func(function(f) {
        self.frame = f;
        f.style.display = 'none';
        return call_method_on_frame(test, self.frame, 'service_worker_unregister_and_register', [self.origin + base_path() + url, scope], 'registration');
    })).then(test.step_func(function() {
        // Use frame as proxy for registration.
        return self.frame;
    }));
};

CrossOriginSWHelper.prototype.wait_for_activated = function(test, registration) {
  assert_equals(registration, this.frame);
  return call_method_on_frame(test, this.frame, 'wait_for_activated', ['%registration%']);
};

CrossOriginSWHelper.prototype.service_worker_unregister = function(test, scope) {
  return call_method_on_frame(test, this.frame, 'service_worker_unregister', [scope]);
};

CrossOriginSWHelper.prototype.wait_for_update = function(test, registration) {
  assert_equals(registration, this.frame);
  return call_method_on_frame(test, this.frame, 'wait_for_update', ['%registration%'], 'worker');
};

CrossOriginSWHelper.prototype.terminate_service_worker = function(test, registration) {
  return call_method_on_frame(test, this.frame, 'terminate_service_worker', ['%registration%']);
};

