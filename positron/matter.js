var stream = require('stream');
var crypto = require('crypto');
var util = require("util");


function Antimatter(options) {
  if (!(this instanceof Antimatter)) {
    return new Antimatter(options);
  }

  stream.Transform.call(this, options);

  var self = this;
  this._bytesMetaNeeded = undefined;
  this._metadata = [];

  this._decipher = crypto.createDecipher(options.algorithm, options.password);
  this._decipher.on('data', function(chunk) {
    var buff = chunk;

    if (self._bytesMetaNeeded === undefined) {
      self._bytesMetaNeeded = buff.readUInt32BE(0);
      buff = buff.slice(4)
    }

    if (self._bytesMetaNeeded > 0) {
      var meta = buff.slice(0, self._bytesMetaNeeded);
      self._metadata.push(meta.toString());

      self._bytesMetaNeeded -= meta.length;
      if (self._bytesMetaNeeded == 0) {
        self._emitMetadata();

        if (buff.length - meta.length > 0) {
          self.push(buff.slice(meta.length));
        }
      }
    } else {
      self.push(buff);
    }
  });
}

util.inherits(Antimatter, stream.Transform);

Antimatter.prototype._transform = function(chunk, encoding, callback) {
  this._decipher.write(chunk, function() {
    callback();
  });
};

Antimatter.prototype._flush = function(callback) {
  this._decipher.end(function() {
    callback();
  });
};

Antimatter.prototype._emitMetadata = function() {
  try {
    var metadata = JSON.parse(this._metadata.join(''));
    this.emit('metadata', metadata);
  } catch (err) {
    this.emit('error', new Error('invalid metadata'));
  }
};


function Darkmatter(options) {
  if (!(this instanceof  Darkmatter)) {
    return new Darkmatter(options);
  }

  stream.Transform.call(this, options);

  var self = this;
  this._cipher = crypto.createCipher(options.algorithm, options.password);
  this._cipher.on('data', function(chunk) {
    self.push(chunk);
  });

  if (!options.metadata) {
    throw new TypeError('metadata must be provided');
  }
  this._pushMetadata(options.metadata);
}

util.inherits(Darkmatter, stream.Transform);

Darkmatter.prototype._pushMetadata = function(metadata) {
  metadata = JSON.stringify(metadata);
  var length = Buffer.byteLength(metadata);
  var buff = new Buffer(length + 4);
  buff.writeUInt32BE(length, 0);
  buff.write(metadata, 4);
  this._cipher.write(buff);
};

Darkmatter.prototype._transform = function(chunk, encoding, callback) {
  this._cipher.write(chunk, function() {
    callback();
  });
};

Darkmatter.prototype._flush = function(callback) {
  this._cipher.end(function() {
    callback();
  });
};


exports.createAntimatter = function(options) {
  return new Antimatter(options);
};
exports.createDarkmatter = function(options) {
  return new Darkmatter(options);
};