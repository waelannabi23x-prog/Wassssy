const { all, get, run } = require('./db');

// Templates
const getTemplates = () => all('SELECT * FROM message_templates ORDER BY created_at DESC');
const getTemplate = id => get('SELECT * FROM message_templates WHERE id=?',[id]);
const addTemplate = async (name,type,content,fileId='') => {
  if(await get('SELECT 1 FROM message_templates WHERE name=?',[name])) throw new Error('exists');
  await run('INSERT INTO message_templates(name,type,content,file_id) VALUES(?,?,?,?)',[name,type,content,fileId]);
};
const updateTemplate = (id,name,type,content,fileId) => run('UPDATE message_templates SET name=?,type=?,content=?,file_id=? WHERE id=?',[name,type,content,fileId,id]);
const deleteTemplate = id => run('DELETE FROM message_templates WHERE id=?',[id]);

// Scheduled
const getScheduled = () => all('SELECT sm.*,mt.name,mt.type,mt.content,mt.file_id FROM scheduled_messages sm LEFT JOIN message_templates mt ON sm.template_id=mt.id WHERE sm.sent=0 ORDER BY sm.send_at ASC');
const getPending = () => all("SELECT sm.*,mt.name,mt.type,mt.content,mt.file_id FROM scheduled_messages sm LEFT JOIN message_templates mt ON sm.template_id=mt.id WHERE sm.sent=0 AND sm.send_at <= NOW() + INTERVAL '1 hour'");
const normalizeDate = (input) => {
  input = input.trim();
  // H:MM DD-MM-YYYY or HH:MM DD-MM-YYYY
  const m1 = input.match(/^(\d{1,2}:\d{2})\s+(\d{2})-(\d{2})-(\d{4})$/);
  if(m1) return m1[4]+'-'+m1[3]+'-'+m1[2]+' '+m1[1].padStart(5,'0')+':00';
  // DD-MM-YYYY HH:MM
  const m2 = input.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}:\d{2})$/);
  if(m2) return m2[3]+'-'+m2[2]+'-'+m2[1]+' '+m2[4].padStart(5,'0')+':00';
  // YYYY-MM-DD HH:MM
  const m3 = input.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}:\d{2})$/);
  if(m3) return input.replace(m3[4], m3[4].padStart(5,'0'))+':00';
  return input;
};
const addScheduled = (templateId,target,specialtyId,sendAt) => run('INSERT INTO scheduled_messages(template_id,target,specialty_id,send_at) VALUES(?,?,?,?)',[templateId,target,specialtyId||0,normalizeDate(sendAt)]);
const markSent = id => run('UPDATE scheduled_messages SET sent=1 WHERE id=?',[id]);
const deleteScheduled = id => run('DELETE FROM scheduled_messages WHERE id=?',[id]);

module.exports = { getTemplates,getTemplate,addTemplate,updateTemplate,deleteTemplate,getScheduled,getPending,addScheduled,markSent,deleteScheduled };
