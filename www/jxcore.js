// See the LICENSE file

var channel = require('cordova/channel'),
  utils = require('cordova/utils'),
  exec = require('cordova/exec'),
  cordova = require('cordova');

channel.createSticky('onJXcoreReady');
channel.waitForInitialization('onJXcoreReady');
var jxcore_device = {
  ios: (navigator.userAgent.match(/iPad/i)) == 'iPad' || (navigator.userAgent.match(/iPhone/i)) == 'iPhone',
  android: (navigator.userAgent.match(/Android/i)) == 'Android'
};

if (!jxcore_device.ios && !jxcore_device.android) {
  var counter = 0, errmsg = 'JXcore plugin: Device type is unkown. Defaulting to Android';
  var inter = setInterval(function () {
    if (typeof log != 'undefined') {
      log(errmsg, 'red');
    } else if (++counter > 400) {
      if (typeof console != 'undefined') {
        console.log(errmsg);
      }
    } else {
      return;
    }
    clearInterval(inter);
  }, 5);
  jxcore_device.android = true;
}

function callNative(name, args, callback) {
  exec(
    function cb(data) {
      if (data === null) return;
      if (callback) {
        if (!Array.isArray(data)) {
          data = [data];
        } else {
          if (!jxcore_device.android) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              log('Error:', e.message);
              return;
            }
            if (!Array.isArray(data)) {
              data = [data];
            }
          }
        }

        callback.apply(null, data);
      }
    },
    function errorHandler(err) {
      if (callback) callback(null, err);
    },
    'JXcore',
    name,
    args || []
  );
}

channel.onCordovaReady.subscribe(function () {
  callNative('onResume', null, function () {
    channel.onJXcoreReady.fire();
  });
});

var initialized = false;
(function checkReady() {
  if (initialized) return;
  callNative('isReady', [], function (ret, err) {
    if (err) {
      alert(err);
    } else if (ret) {
      initialized = true;
      document.onjxready();
    } else {
      setTimeout(function () {
        checkReady();
      }, 5);
    }
  });
})();

var jxcore = module.exports = {};

jxcore.Call =
jxcore.call = function (methodName) {
  var ln = arguments.length;
  var callback = null;
  var args;

  if (!methodName || typeof methodName !== 'string') {
    throw 'Method name must be string';
  }

  if (isFunction(arguments[ln - 1])) {
    callback = arguments[ln - 1];
    args = Array.prototype.slice.call(arguments, 1, ln - 1);
  } else {
    args = Array.prototype.slice.call(arguments, 1, ln);
  }

  callFunction(methodName, args, callback);
  return this;
};

var localMethods = {};
jxcore.register = function (methodName, callback) {
  if (!isFunction(callback)) {
    throw new TypeError('Callback needs to be a function');
  }

  localMethods[methodName] = callback;
  return this;
};

jxcore.Start =
jxcore.start = function () {
  var len = arguments.length;
  var fileName;
  var callback;

  if (typeof arguments[0] === 'string') {
    fileName = arguments[0];
    if (isFunction(arguments[1])) {
      callback = arguments[1];
    }
  } else {
    fileName = 'app.js';
    if (isFunction(arguments[0])) {
      callback = arguments[0];
    }
  }

  callFunction('registerUIMethod', ['callLocalMethods'], callLocalMethods);
  callFunction('loadMainFile', [fileName], callback);
  return this;
};

function callLocalMethods() {
  if (!localMethods.hasOwnProperty(arguments[0]))
    return;

  var hasParams = arguments.length > 1 && Array.isArray(arguments[1]);
  var args;
  var call_id;
  if (!hasParams) {
    args = Array.prototype.slice.call(arguments, 1);
  } else {
    args = arguments[1];
    if (args.length && args[args.length - 1].hasOwnProperty('JXCORE_RETURN_CALLBACK')) {
      call_id = args[args.length - 1].JXCORE_RETURN_CALLBACK;
      args[args.length - 1] = function () {
        var target = jxcore(call_id);
        target.call.apply(target, arguments);
      };
    }
  }
  
  localMethods[arguments[0]].apply(null, args);
};

function isFunction(__$) {
  var _$ = {};
  return __$ && _$.toString.call(__$) === '[object Function]';
};

function callFunction(name, params, callback) {
  var args = {};
  args.methodName = name;
  args.params = params;

  callNative('Evaluate', ['Mobile.executeJSON(' + JSON.stringify(args)], callback);
};

function onPause() {
  callNative('onPause');
}

document.addEventListener('pause', onPause, false);

function onResume() {
  callNative('onResume');
}

document.addEventListener('resume', onResume, false);
