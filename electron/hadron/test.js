var hadron = require('./build/Release/hadron');
var assert = require('assert');
var fs = require('fs');

var ca  = fs.readFileSync('../telepod.ca.pem');
var key = fs.readFileSync('../telepod.key.pem');


var cache = hadron.createLRUCache(100);

assert.equal(cache.get('none'), undefined, 'expected undefined while no value for the specified key');

cache.set('key1', 'value1');
var actual = cache.get('key1');
assert.equal(actual, 'value1', 'expected value1 for key1 actual is: ' + actual);


var forger = hadron.createForger({ca: ca, key: key});
forger.forgeCert('telepod.hadron', function(error, cert) {
  assert.ok(cert.toString().indexOf('BEGIN CERTIFICATE') != -1, 'expected a certificate');
});

console.log('Test success.');
