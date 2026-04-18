'use strict';
const { all, get, run } = require('./db');
const addTemplate = async (name, type, content, fileId) => {
  const r = await get('SELECT 1 FROM message_templates WHERE name=$1', [name]);
  if (r) throw new Error('exists');
  return run('INSERT INTO message_templates(name,type,content,file_id) VALUES($1,$2,$3,$4)', [name, type, content || '', fileId || '']);
};
const getTemplates = () => all('SELECT * FROM message_templates ORDER BY id DESC');
const getTemplate = id => get('SELECT * FROM message_templates WHERE id=$1', [id]);
const deleteTemplate = id => run('DELETE FROM message_templates WHERE id=$1', [id]);
const addScheduled = (tplId, target, spId, sendAt) => run('INSERT INTO scheduled_messages(template_id,target,specialty_id,send_at) VALUES($1,$2,$3,$4)', [tplId, target, spId || 0, sendAt]);
const getScheduled = () => all("SELECT sm.*,mt.name FROM scheduled_messages sm JOIN message_templates mt ON sm.template_id=mt.id WHERE sm.sent=0 ORDER BY sm.send_at");
const deleteScheduled = id => run('DELETE FROM scheduled_messages WHERE id=$1', [id]);
module.exports = { addTemplate, getTemplates, getTemplate, deleteTemplate, addScheduled, getScheduled, deleteScheduled };
