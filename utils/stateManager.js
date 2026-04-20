'use strict';
const { loadAllStates } = require('./redis');
async function initPersistentStates() { return loadAllStates(); }
module.exports = { initPersistentStates };
