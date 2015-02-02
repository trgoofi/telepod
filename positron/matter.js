var stream = require('stream');
var crypto = require('crypto');
var util = require("util");


function Antimatter(options) {
  if (!(this instanceof Antimatter)) {
    return new Antimatter(options);
  }

  stream.Transform.call(this, options);
  this._decipher = crypto.createDecipher(options.algorithm, options.password);
  this._bytesMetaNeeded = undefined;
  this._metadata = [];
}

util.inherits(Antimatter, stream.Transform);

Antimatter.prototype._transform = function(chunk, encoding, callback) {
  var buf = this._decipher.update(chunk);

  if (this._bytesMetaNeeded === undefined) {
    this._bytesMetaNeeded = buf.readUInt32BE(0);
    buf = buf.slice(4)
  }

  if (this._bytesMetaNeeded > 0) {
    var meta = buf.slice(0, this._bytesMetaNeeded);
    this._metadata.push(meta.toString());

    this._bytesMetaNeeded -= meta.length;
    if (this._bytesMetaNeeded == 0) {
      this._emitMetadata();

      if (buf.length - meta.length > 0) {
        this.push(buf.slice(meta.length));
      }
    }
  } else {
    this.push(buf);
  }

  callback();
};

Antimatter.prototype._flush = function(callback) {
  var data = this._decipher.final();
  if (this._bytesMetaNeeded > 0) {
    this._metadata.push(data);
    this._emitMetadata();
  } else {
    this.push(data);
  }

  callback();
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
  this._cipher = crypto.createCipher(options.algorithm, options.password);
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
  buff.writeUInt32BE(length);
  buff.write(metadata, 4);
  var cbuff = this._cipher.update(buff);
  this.push(cbuff);
};

Darkmatter.prototype._transform = function(chunk, encoding, callback) {
  this.push(this._cipher.update(chunk));
  callback();
};

Darkmatter.prototype._flush = function(callback) {
  this.push(this._cipher.final());
  callback();
};


exports.createAntimatter = function(options) {
  return new Antimatter(options);
};
exports.createDarkmatter = function(options) {
  return new Darkmatter(options);
};