'use strict';
const { setState, delState, getState } = require('./redis');
const { initPersistentStates } = (function() {
  return { initPersistentStates: async () => {} };
})();
module.exports = { setState, delState, getState, initPersistentStates };
