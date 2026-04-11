with open('handlers/browse.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """async function showFiles(ctx,spId,yrId,smId,sbId,catId,page=0) {
  const uid=ctx.uid;"""

new = """async function showFiles(ctx,spId,yrId,smId,sbId,catId,page=0) {
  const uid=ctx.uid;
  if(global.dedupRequest) return global.dedupRequest(uid,'sf_'+catId+'_'+page, ()=>_showFiles(ctx,spId,yrId,smId,sbId,catId,page));
  return _showFiles(ctx,spId,yrId,smId,sbId,catId,page);
}
async function _showFiles(ctx,spId,yrId,smId,sbId,catId,page=0) {
  const uid=ctx.uid;"""

old2 = """async function showPreview(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid = ctx.uid;"""

new2 = """async function showPreview(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid = ctx.uid;
  if(global.dedupRequest) return global.dedupRequest(uid,'sp_'+fid, ()=>_showPreview(ctx,fid,spId,yrId,smId,sbId,catId));
  return _showPreview(ctx,fid,spId,yrId,smId,sbId,catId);
}
async function _showPreview(ctx,fid,spId,yrId,smId,sbId,catId) {
  const uid = ctx.uid;"""

if old in content and old2 in content:
    content = content.replace(old, new, 1)
    content = content.replace(old2, new2, 1)
    with open('handlers/browse.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
    if old not in content: print("  - showFiles not matched")
    if old2 not in content: print("  - showPreview not matched")
