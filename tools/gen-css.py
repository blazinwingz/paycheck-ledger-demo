"""Writes src/utils.css: the utility classes the app actually uses.

The app styles with Tailwind-style class names but ships no framework, so this
generates only the rules those class names need. Run it after adding new ones.
"""
import re, sys
src = open("src/app.jsx").read()
cls = set()
for m in re.finditer(r'className=\{?[`"]([^`"]+)[`"]', src):
    cls.update(re.sub(r'\$\{[^}]*\}', ' ', m.group(1)).split())
for m in re.finditer(r'"((?:text|py|px|mt|mb|w|h)-[a-z0-9.\-]+)"', src):
    cls.add(m.group(1))
cls = {c for c in cls if re.match(r'^-?[a-z]', c)}
sp = lambda v: f"{float(v) * 0.25:g}rem"
esc = lambda c: re.sub(r'([:.])', r'\\\1', c)
FIXED = {
 'block':'display:block','table-cell':'display:table-cell','flex':'display:flex','grid':'display:grid','hidden':'display:none',
 'flex-1':'flex:1 1 0%','flex-wrap':'flex-wrap:wrap','items-baseline':'align-items:baseline',
 'items-center':'align-items:center','items-end':'align-items:flex-end','items-start':'align-items:flex-start',
 'justify-between':'justify-content:space-between','self-center':'align-self:center','shrink-0':'flex-shrink:0',
 'mx-auto':'margin-left:auto;margin-right:auto','ml-auto':'margin-left:auto','overflow-hidden':'overflow:hidden',
 'overflow-x-auto':'overflow-x:auto','rounded':'border-radius:.25rem',
 'rounded-t':'border-top-left-radius:.25rem;border-top-right-radius:.25rem',
 'text-center':'text-align:center','text-left':'text-align:left','text-right':'text-align:right',
 'text-xs':'font-size:.75rem;line-height:1rem','text-sm':'font-size:.875rem;line-height:1.25rem',
 'text-lg':'font-size:1.125rem;line-height:1.75rem','text-2xl':'font-size:1.5rem;line-height:2rem',
 'text-3xl':'font-size:1.875rem;line-height:2.25rem','tracking-wider':'letter-spacing:.05em',
 'uppercase':'text-transform:uppercase','underline':'text-decoration:underline','whitespace-nowrap':'white-space:nowrap',
 'align-middle':'vertical-align:middle','w-full':'width:100%','max-w-6xl':'max-width:72rem','max-w-xl':'max-width:36rem'}
def rule(c):
    base = c.split(':')[-1]; neg = base.startswith('-'); b = base.lstrip('-')
    if b in FIXED: d = FIXED[b]
    elif (m := re.match(r'grid-cols-(\d+)$', b)): d = f"grid-template-columns:repeat({m[1]},minmax(0,1fr))"
    elif (m := re.match(r'gap-x-([\d.]+)$', b)): d = f"column-gap:{sp(m[1])}"
    elif (m := re.match(r'gap-y-([\d.]+)$', b)): d = f"row-gap:{sp(m[1])}"
    elif (m := re.match(r'gap-([\d.]+)$', b)): d = f"gap:{sp(m[1])}"
    elif (m := re.match(r'space-y-([\d.]+)$', b)):
        return f".{esc(c)}>:not([hidden])~:not([hidden]){{margin-top:{sp(m[1])}}}"
    elif (m := re.match(r'([mp])([trblxy]?)-([\d.]+)$', b)):
        prop = {'m':'margin','p':'padding'}[m[1]]; v = ('-' if neg else '') + sp(m[3])
        sides = {'':[''],'t':['-top'],'r':['-right'],'b':['-bottom'],'l':['-left'],
                 'x':['-left','-right'],'y':['-top','-bottom']}[m[2]]
        d = ";".join(f"{prop}{s}:{v}" for s in sides)
    elif (m := re.match(r'([wh])-([\d.]+)$', b)): d = f"{'width' if m[1]=='w' else 'height'}:{sp(m[2])}"
    else: return None
    r = f".{esc(c)}{{{d}}}"
    if ':' in c:
        bp = {'sm':'640px','md':'768px'}[c.split(':')[0]]
        r = f"@media (min-width:{bp}){{{r}}}"
    return r
out, missing = [], []
for c in sorted(cls, key=lambda c: (c.count(':'), c)):
    (out.append(rule(c)) if rule(c) else missing.append(c))
if missing:
    print("no rule for:", missing, file=sys.stderr); sys.exit(1)
reset = ("*,::before,::after{box-sizing:border-box;border:0 solid}"
         "button,input,select,textarea{font:inherit;color:inherit;margin:0}"
         "button{background:transparent;cursor:pointer}table{border-collapse:collapse}"
         "h1,p{margin:0}ul{margin:0;padding:0;list-style:none}\n")
open("src/utils.css", "w").write(reset + "\n".join(out))
print(f"wrote src/utils.css ({len(out)} rules)")
