# Telepod
[![Build Status](https://travis-ci.org/trgoofi/telepod.svg?branch=master)](https://travis-ci.org/trgoofi/telepod)
[![Build status](https://ci.appveyor.com/api/projects/status/tlge06sq31w1dmdq?svg=true)](https://ci.appveyor.com/project/trgoofi/telepod)

Telepod help securely teleport net traffics.
It consists of two pods `electron` and `positron`.
Net traffics between this two pods are encrypted with cryptography algorithm.

Please Note That Use Cryptography Is Illegal In Some Places.
Pay Attention To The Laws Which Apply To You Then Decide Whether To Use Telepod Or Not.
The Author(s) Of Telepod Is(Are) Not Responsible For Any Violations You Make. It Is Your Responsibility.


## Requirement

### electron:

  * [io.js][io.js] >= 1.0.3
  * [Node.js][Node.js] >= 0.12.0 might work.

### positron:

  * [Node.js][Node.js] >= 0.10.0
  * [io.js][io.js] >= 1.0.0


## Start Guide

  1. Download [Telepod][Telepod_releases].
  2. Install io.js or Node.js.
  3. Deploy `positron` pod.
    1. Change `port` and `host` in `positron/positron.js`.
    2. You might want to change the `password` too.
    3. Deploy `positron` pod. `positron` is self contained that means  deploy all the files under `positron` are enough.
    4. Start `positron` with `npm start` under `path/to/positron/` in the Terminal.
  4. Start `electron`.
    1. Change the `remote` option in `electron/package.json` to the `positron` url that you just deployed.
    2. Also change the `password` to match the one you set in `positron/positron.js`.
    3. Start `electron` with `npm start` under `path/to/telepod/electron/` in the Terminal.
    4. Route your net traffics to `electron`. Default would be `http://localhost:7010`.
  5. All set. Have Fun!




[Telepod_releases]: https://github.com/trgoofi/telepod/releases
[io.js]: https://iojs.org
[Node.js]: https://nodejs.org
