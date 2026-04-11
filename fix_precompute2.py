with open('utils/precompute.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """            } catch(e) {}
          }
        }));"""

new = """            } catch(e) {}
          }));
        }));"""

if old in content:
    content = content.replace(old, new, 1)
    with open('utils/precompute.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
