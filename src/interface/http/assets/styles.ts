export const APP_CSS = `
:root{--bg:#000000;--card:#121216;--text:#ffffff;--muted:#a1a1aa;--teal:#22c39a;--blue:#3b82f6;--purple:#8b3fe4;--pink:#e0409a;--orange:#f5a524;--brand:var(--pink);--brand-ink:#fff;--gradient:linear-gradient(90deg,var(--teal),var(--blue),var(--purple),var(--pink),var(--orange));--button:linear-gradient(135deg,var(--purple),var(--pink));--ok:#22c39a;--err:#ef4444;--line:#26262d;--radius:14px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text)}
a{color:var(--teal)}
header.top{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;position:sticky;top:0;background:var(--bg);z-index:10}
header.top::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--gradient)}
header.top .brand{display:flex;align-items:center;gap:8px;font-weight:900;color:var(--text);text-decoration:none;letter-spacing:.5px}
header.top .brand img{width:40px;height:40px;border-radius:8px}
.hero{text-align:center;padding:8px 0 4px}.hero img{width:120px;height:120px}
.gradient-text{background:var(--gradient);-webkit-background-clip:text;background-clip:text;color:transparent}
header.top nav{display:flex;gap:12px;align-items:center;font-size:14px}
header.top nav a{white-space:nowrap}
@media (max-width:420px){header.top .brand-name{display:none}header.top nav{gap:10px;font-size:13px}}
main{max-width:640px;margin:0 auto;padding:16px}
h1{font-size:1.5rem;margin:.2em 0 .4em}h2{font-size:1.15rem;margin:1.2em 0 .5em}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px;margin:0 0 14px}
.card>:first-child{margin-top:0}.card>:last-child{margin-bottom:0}
.card img.banner{width:100%;border-radius:10px;display:block;margin-bottom:12px;aspect-ratio:16/9;object-fit:cover}
.muted{color:var(--muted);font-size:14px}
.price{font-size:1.4rem;font-weight:800;color:var(--orange)}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:var(--line)}
.badge.ok{background:var(--ok);color:#03251b}.badge.warn{background:var(--orange);color:#1a1000}.badge.err{background:var(--err)}
.btn{display:block;width:100%;text-align:center;padding:14px 16px;border-radius:12px;border:0;font-size:1rem;font-weight:700;background:var(--button);color:var(--brand-ink);text-decoration:none;cursor:pointer}
.btn.secondary{background:transparent;color:var(--text);border:1px solid var(--line)}
.btn.small{display:inline-block;width:auto;padding:8px 12px;font-size:14px}
.row{display:flex;gap:10px;align-items:center}.row>*{flex:1}
label{display:block;font-size:14px;color:var(--muted);margin:10px 0 4px}
input,textarea,select{width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:#0a0a0c;color:var(--text);font-size:16px}
textarea{min-height:90px}
.alert{padding:12px 14px;border-radius:10px;margin:0 0 14px;font-weight:600}
.alert.err{background:#3b1113;color:#fecaca}.alert.ok{background:#0f2e1a;color:#bbf7d0}.alert.test{background:#3a2a05;color:#fde68a}
.qr{background:#fff;padding:12px;border-radius:12px;max-width:280px;margin:0 auto}.qr svg,.qr img{width:100%;height:auto;display:block}
.copy{display:flex;gap:8px}.copy input{font-size:12px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)}
.stats{display:flex;gap:10px}.stats .card{flex:1;text-align:center}.stats strong{display:block;font-size:1.4rem}
video#scanner{width:100%;border-radius:12px;background:#000}
#checkin-result{font-size:1.2rem;text-align:center}

.guide-dots{display:flex;gap:8px;list-style:none;padding:0;margin:4px 0 8px}
.guide-dots li{width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:var(--line);color:var(--muted)}
.guide-dots li.active{background:var(--button);color:#fff}
.guide-preview{display:flex;justify-content:center;padding:12px;border:1px dashed var(--line);border-radius:12px;margin:8px 0}
.guide-preview .btn{pointer-events:none;max-width:320px}
.guide-list{margin:0;padding-left:20px}.guide-list li{margin:6px 0}
.guide-nav{display:flex;flex-direction:column;gap:10px;margin-top:6px}.guide-nav form{margin:0}
footer{color:var(--muted);font-size:12px;text-align:center;padding:24px 16px}
`;
