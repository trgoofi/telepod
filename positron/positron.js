var http = require('http');
var https = require('https');
var util = require("util");
var logger = require('./logger');
var matter = require('./matter');


var algorithm = 'aes128';
var password = 'telepod';

var port = process.env.PORT || 3000;
var host = process.env.IP || '127.0.0.1';


var app = http.createServer(function(req, res) {
  var url = req.url;
  if (/^\/$/.test(url)) {
    res.statusCode = 200;
    res.end('Hello Telepod!');
  } else if (req.method === 'POST') {
    var onMetadata = function(metadata) {
      logger.debug(metadata);

      var options = {
        hostname: metadata.headers.host,
        path: metadata.url,
        method: metadata.method,
        headers: metadata.headers
      };

      var onError = function(err) {
        req.socket.destroy();
        var requestInfo = util.format('%s: %s://%s%s', metadata.method, metadata.scheme, metadata.headers.host, metadata.url);
        logger.error('%s with error: ', requestInfo, err);
      };

      var onResponse = function(response) {
        var metadata = {
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          headers: response.headers
        };
        logger.debug('response', metadata);

        var darkmatter = matter.createDarkmatter({algorithm: algorithm, password: password, metadata: metadata});
        darkmatter.wire(response).to(res);
      };

      var client = metadata.scheme === 'https' ? https : http;
      var request = client.request(options, onResponse).on('error', onError);
      this.to(request);
    };

    var antimatter = matter.createAntimatter({algorithm: algorithm, password: password});
    antimatter.on('metadata', onMetadata);
    antimatter.wire(req);

  } else {
    res.statusCode = 200;
    res.end('Hello Telepod!');
  }
});

app.on('clientError', function(exception, socket) {
  socket.destroy();
  logger.error('clientError:', exception);
});

app.listen(port, host, function() {
  var slogan = '';
  slogan += '=============================================================\n';
  slogan += '  App Listening on: %s:%d\n';
  slogan += '=============================================================\n';
  logger.log(slogan, host, port);
});

process.on('uncaughtException', function(err) {
  logger.error('Exception: ' + err.stack);
});
