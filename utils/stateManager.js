'use strict';
const { setState, delState, getState } = require('./redis');
async function initPersistentStates() {}
module.exports = { setState, delState, getState, initPersistentStates };
