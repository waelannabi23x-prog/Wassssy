with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """    const _isHeavy = ['preview_','fl_','ct_','bundle_','bdl_','sp_','yr_','sm_','sb_','sms_','sbs_','yrs_','latest','new_in_sp','recommended','favorites','history','profile','stats','progress','cmt_','rate_','mg_analytics','mg_content','mg_users','mg_admins','mg_logs','browse','main_menu'].some(p=>data.startsWith(p)||data===p);
    if (!data.startsWith('grp_')) {
      ctx.answerCbQuery(_isHeavy ? '⏳' : '', { show_alert: false }).catch(() => {});
    }"""

new = """    if (!data.startsWith('grp_')) {
      ctx.answerCbQuery('', { show_alert: false }).catch(() => {});
    }"""

if old in content:
    content = content.replace(old, new)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
