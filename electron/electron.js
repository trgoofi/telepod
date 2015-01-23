var http = require('http');
var net = require('net');
var fs = require('fs');
var util = require('util');
var https = require('https');
var crypto = require('crypto');
var sni = require('./sni');

var packageJson = fs.readFileSync('package.json', {encoding: 'utf8'});
packageJson = JSON.parse(packageJson);
var TELEPOD = packageJson.telepod || {};
TELEPOD.version = packageJson.version;

var remote = {
  hostname: TELEPOD.remote,
  port: 3000,
  path: '/_portal',
  method: 'POST'
};

var requestHandler = function(req, res, scheme) {
  var url = util.format('%s://%s%s', scheme, req.headers.host, req.url);
  console.log('request url:', url);

  var request = http.request(remote, function(response) {
    res.statusCode = response.statusCode;
    var headers = response.headers;
    for (var name in headers) {
      res.setHeader(name, headers[name]);
    }
    response.pipe(res);
  });
  request.on('error', function(err) {
    console.error('request: %s with error: ', url, err);
    req.socket.destroy();
  });

  var metadata = {
    url: req.url,
    scheme: scheme,
    method: req.method,
    headers: req.headers
  };

  metadata = JSON.stringify(metadata);
  var length = Buffer.byteLength(metadata);
  var buf = new Buffer(length + 4);
  buf.writeUInt32BE(length);
  buf.write(metadata, 4);

  var cipher = crypto.createCipher('aes128', TELEPOD.password);
  request.write(cipher.update(buf));
  req.on('data', function(chunk) {
    request.write(cipher.update(chunk));
  });
  req.on('end', function() {
    request.end(cipher.final());
  });
};

var secureServer = https.createServer({SNICallback: sni.SNICallbackFunc}, function(req, res) {
  requestHandler(req, res, 'https');
});

secureServer.on('clientError', function(exception, socket) {
  socket.destroy();
  console.error(exception);
});

secureServer.listen(0, function() {
  var address = secureServer.address();

  var server = http.createServer(function(req, res) {
    requestHandler(req, res, 'http');
  });

  server.on('connect', function(req, socket, head) {
    console.log('tunnel: ', req.url);

    var tunnel = net.connect(address.port, function() {
      socket.write('HTTP/1.1 200 OK\r\n\r\n');
      tunnel.write(head);
      tunnel.pipe(socket);
      socket.pipe(tunnel);
    });
  });

  server.on('error', function(error) {
    console.error(error);
  });

  server.on('clientError', function(exception, socket) {
    socket.destroy();
    console.log(exception);
  });

  server.listen(TELEPOD.port, function() {
    var slogan = '';
    slogan += '=============================================================\n';
    slogan += '  Telepod Version : %s\n';
    slogan += '  Listen          : %d\n';
    slogan += '  Remote          : %s\n';
    slogan += '=============================================================\n';
    console.log(slogan, TELEPOD.version, TELEPOD.port, TELEPOD.remote);
  });

});