"use strict";

const sandbox = require("..");
const assert = require("assert").strict;

assert.strictEqual(sandbox(), "Hello from sandbox");
console.info("sandbox tests passed");
