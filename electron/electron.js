var http = require('http');
var net = require('net');
var fs = require('fs');
var util = require('util');
var https = require('https');
var zlib = require('zlib');
var url = require('url');
var sni = require('./sni');
var logger = require('../positron/logger');
var matter = require('../positron/matter');


var algorithm = 'aes128';

var packageJson = fs.readFileSync('package.json', {encoding: 'utf8'});
packageJson = JSON.parse(packageJson);
var TELEPOD = packageJson.telepod || {};
TELEPOD.version = packageJson.version;
var remoteOptions = url.parse(TELEPOD.remote);

var remote = {
  hostname: remoteOptions.hostname,
  port: remoteOptions.port,
  path: '/_portal',
  method: 'POST'
};

var requestHandler = function(req, res, scheme) {
  var requireInfo = util.format('%s %s://%s%s', req.method, scheme, req.headers.host, req.url);
  logger.info(requireInfo);

  var onError = function(err) {
    req.socket.destroy();
    logger.error('%s with error: ', requireInfo, err);
  };

  var onResponse = function(response) {
    res.statusCode = response.statusCode;
    var onMetadata = function (metadata) {
      var headers = metadata.headers;
      for (var name in headers) {
        res.setHeader(name, headers[name]);
      }
      logger.debug(headers);
    };

    var antimatter = matter.createAntimatter({algorithm: algorithm, password: TELEPOD.password});
    antimatter.on('metadata', onMetadata);
    response.pipe(zlib.createGunzip()).pipe(antimatter).pipe(res);
  };

  var request = http.request(remote, onResponse).on('error', onError);

  var metadata = {
    url: req.url,
    scheme: scheme,
    method: req.method,
    headers: req.headers
  };

  var darkmatter = matter.createDarkmatter({algorithm: algorithm, password: TELEPOD.password, metadata: metadata});
  req.pipe(darkmatter).pipe(zlib.createGzip()).pipe(request);
};

var secureServer = https.createServer({SNICallback: sni.SNICallbackFunc}, function(req, res) {
  requestHandler(req, res, 'https');
});

secureServer.on('clientError', function(exception, socket) {
  socket.destroy();
  logger.error('clientError:', exception);
});

secureServer.listen(0, function() {
  var address = secureServer.address();

  var server = http.createServer(function(req, res) {
    requestHandler(req, res, 'http');
  });

  server.on('connect', function(req, socket, head) {
    logger.debug('tunnel: ', req.url);

    var tunnel = net.connect(address.port, function() {
      socket.write('HTTP/1.1 200 OK\r\n\r\n');
      tunnel.write(head);
      tunnel.pipe(socket);
      socket.pipe(tunnel);
    });
  });

  server.on('error', function(error) {
    logger.error(error);
  });

  server.on('clientError', function(exception, socket) {
    socket.destroy();
    logger.error('clientError:', exception);
  });

  server.listen(TELEPOD.port, function() {
    var slogan = '';
    slogan += '=============================================================\n';
    slogan += '  Telepod Version : %s\n';
    slogan += '  Listen          : %d\n';
    slogan += '  Remote          : %s\n';
    slogan += '=============================================================\n';
    logger.log(slogan, TELEPOD.version, TELEPOD.port, TELEPOD.remote);
  });

});