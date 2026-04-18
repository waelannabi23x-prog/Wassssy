'use strict';
var _states = new Map();
var _bot = null;
var _maintenance = false;
var _maintMsg = 'البوت تحت الصيانة. يرجى الانتظار!';
var _maxAge = 3600000;

module.exports = {
  getState: function(uid) { return _states.get(uid) || null; },
  setState: function(uid, state) {
    state._ts = Date.now();
    _states.set(uid, state);
  },
  delState: function(uid) { _states.delete(uid); },
  gc: function() {
    var now = Date.now(), c = 0;
    for (var entry of _states) {
      if (entry[1]._ts && now - entry[1]._ts > _maxAge) { _states.delete(entry[0]); c++; }
    }
    return c;
  },
  get stateSize() { return _states.size; },
  get userStates() { return _states; },
  get bot() { return _bot; },
  set bot(v) { _bot = v; },
  get maintenance() { return _maintenance; },
  set maintenance(v) { _maintenance = v; },
  get maintenanceMsg() { return _maintMsg; },
  set maintenanceMsg(v) { _maintMsg = v; },
};
