'use strict';
const { setState, delState, getState, getStateAsync } = require('./redis');
async function initPersistentStates() {}
module.exports = { setState, delState, getState, getStateAsync, initPersistentStates };
