"""Render the repository's Arabic POS review as a self-contained reading document."""

from html import escape
from html.parser import HTMLParser
from pathlib import Path
import re

root = Path(__file__).resolve().parent
source = root / "POS_SHIFTS_A_TO_Z_AR.md"
target = source.with_suffix(".html")
markdown = source.read_text(encoding="utf-8")


def inline(value):
    tokens = []

    def save(match, kind):
        if kind == "code":
            rendered = "<code>" + escape(match.group(1)) + "</code>"
        else:
            rendered = '<a href="' + escape(match.group(2), quote=True) + '">' + escape(match.group(1)) + "</a>"
        tokens.append(rendered)
        return "\x00" + str(len(tokens) - 1) + "\x00"

    value = re.sub(r"`([^`]+)`", lambda m: save(m, "code"), value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", lambda m: save(m, "link"), value)
    value = escape(value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", value)
    return re.sub(r"\x00(\d+)\x00", lambda m: tokens[int(m.group(1))], value)


lines = markdown.splitlines()
body = []
toc = []
index = 0
section = 0
while index < len(lines):
    line = lines[index]
    if not line.strip():
        index += 1
        continue
    if line.startswith("# "):
        index += 1
        continue
    if line.startswith("## "):
        section += 1
        title = line[3:]
        toc.append((f"chapter-{section}", title))
        if section > 1:
            body.append("</section>")
        body.append(f'<section class="chapter" id="chapter-{section}"><h2>{inline(title)}</h2>')
        index += 1
        continue
    if line.startswith("### "):
        body.append("<h3>" + inline(line[4:]) + "</h3>")
        index += 1
        continue
    if line.startswith("```"):
        index += 1
        content = []
        while index < len(lines) and not lines[index].startswith("```"):
            content.append(lines[index])
            index += 1
        body.append('<pre dir="ltr"><code>' + escape("\n".join(content)) + "</code></pre>")
        index += 1
        continue
    if line.startswith("| "):
        rows = []
        while index < len(lines) and lines[index].startswith("| "):
            row = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
            if not all(re.fullmatch(r":?-+:?", cell) for cell in row):
                rows.append(row)
            index += 1
        head = "<thead><tr>" + "".join('<th scope="col">' + inline(cell) + "</th>" for cell in rows[0]) + "</tr></thead>"
        rest = "<tbody>" + "".join("<tr>" + "".join("<td>" + inline(cell) + "</td>" for cell in row) + "</tr>" for row in rows[1:]) + "</tbody>"
        body.append('<div class="table-wrap" tabindex="0" role="region" aria-label="جدول توضيحي">' + "<table>" + head + rest + "</table></div>")
        continue
    if line.startswith("- "):
        items = []
        while index < len(lines) and lines[index].startswith("- "):
            items.append("<li>" + inline(lines[index][2:]) + "</li>")
            index += 1
        body.append("<ul>" + "".join(items) + "</ul>")
        continue
    paragraph = [line]
    index += 1
    while index < len(lines) and lines[index].strip() and not re.match(r"^(#|\| |```|- )", lines[index]):
        paragraph.append(lines[index])
        index += 1
    body.append("<p>" + inline(" ".join(paragraph)) + "</p>")
body.append("</section>")

navigation = "".join(f'<a href="#{anchor}">{escape(title)}</a>' for anchor, title in toc)
html = """<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="مراجعة شاملة لورديات الكاشير ونقاط البيع وتقارير النقد والتشغيل في Waffarly، مع القرارات والتحسينات المقترحة.">
<title>Waffarly | الشيفت والكاشير وتقارير POS</title>
<style>
:root{color-scheme:light;--ink:#182a33;--muted:#52636a;--paper:#fff;--line:#dce4e7;--accent:#aa440f;--tint:#fff3e8;--nav:#142b35}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:22px}body{margin:0;background:#f1f3f2;color:var(--ink);font-family:"Segoe UI",Tahoma,Arial,sans-serif;font-size:17px;line-height:1.95}
a{color:var(--accent);text-underline-offset:4px}a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:3px solid #d37830;outline-offset:4px}button{font:inherit;cursor:pointer}code{direction:ltr;unicode-bidi:isolate;overflow-wrap:anywhere;background:#edf1f3;padding:1px 6px;border-radius:5px;font-family:Consolas,monospace;font-size:.83em}
.layout{display:grid;grid-template-columns:290px minmax(0,1fr);max-width:1600px;margin:auto;min-height:100vh}.sidebar{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;background:var(--nav);padding:27px 22px;color:#eef4f5}.brand{font-size:24px;letter-spacing:1px;font-weight:800;direction:ltr;text-align:right}.sidebar .subtitle{font-size:13px;color:#b9d0d8;margin:1px 0 18px}.sidebar nav{display:grid;gap:3px}.sidebar nav a{color:#e2ebee;font-size:13.5px;text-decoration:none;line-height:1.7;padding:7px 8px;border-radius:6px;border-right:2px solid transparent}.sidebar nav a:hover{background:#ffffff12;border-color:#f4a569;color:#fff}.tools{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.tools button,.tools a{border:1px solid #4b626d;background:transparent;color:white;border-radius:7px;padding:5px 10px;text-decoration:none;font-size:13px}
main{min-width:0;padding:32px 38px 60px}.cover{padding:40px 42px;background:#173540;color:white;border-radius:17px;border-bottom:6px solid #dc8c52;margin-bottom:26px}.eyebrow{font:600 12px/1.5 "Segoe UI",sans-serif;letter-spacing:2px;color:#eabf9e}.cover h1{font-size:clamp(28px,3vw,42px);line-height:1.6;margin:16px 0}.cover p{color:#d4e3e7;margin:8px 0}.pills{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.pills span{border:1px solid #ffffff35;padding:3px 11px;border-radius:20px;font-size:12px}.intro{background:var(--tint);padding:20px 26px;border-radius:12px;border-right:4px solid #ce7840;margin-bottom:24px}.intro p{margin:7px 0;font-size:15px}.chapter{background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:28px 30px;margin:0 0 23px;box-shadow:0 3px 18px #1f3d4810}.chapter h2{font-size:25px;line-height:1.65;margin:0 0 21px;padding-bottom:14px;border-bottom:2px solid #e8a878;color:#173540}.chapter h3{font-size:20px;color:#80502b;margin:28px 0 10px}p{margin:12px 0}ul{padding-right:25px;margin:14px 0}li{padding:3px 0}strong{font-weight:700}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#152e39;color:#eef5f7;padding:18px;border-radius:8px;line-height:1.7;font-size:13px}pre code{background:none;color:inherit;padding:0}
.table-wrap{overflow-x:auto;margin:20px 0;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.85}th,td{text-align:right;vertical-align:top;padding:11px 13px;border-bottom:1px solid var(--line);min-width:100px}th{background:#eef3f4;color:#16313b;font-weight:700}tbody tr:nth-child(even){background:#f8fafb}tbody tr:last-child td{border-bottom:0}td:first-child{font-weight:600}td a{overflow-wrap:anywhere}footer{color:var(--muted);font-size:13px;padding:4px 12px}.mobile-nav{display:none}
@media(min-width:1400px){main{padding-left:55px;padding-right:55px}}
@media(max-width:1050px){.layout{grid-template-columns:235px minmax(0,1fr)}main{padding:22px 20px}.sidebar{padding:22px 14px}.cover{padding:28px}.chapter{padding:23px}.chapter h2{font-size:23px}}
@media(max-width:760px){.layout{display:block}.sidebar{position:relative;height:auto;padding:17px 20px}.sidebar nav{display:none}.sidebar .subtitle{margin-bottom:0}.sidebar .tools{margin:12px 0 0}.mobile-nav{display:block;background:white;padding:15px 20px;border:1px solid var(--line);border-radius:10px;margin-bottom:20px}.mobile-nav nav{display:grid;gap:9px;margin-top:13px}.mobile-nav a{font-size:14px}main{padding:18px 12px}.cover{padding:25px 22px}.cover h1{font-size:28px}.chapter{padding:21px 18px}.chapter h2{font-size:22px}.intro{padding:17px}body{font-size:16px}th,td{min-width:125px}}
@media print{@page{size:A4;margin:17mm 13mm}body{background:#fff;font-size:11pt;line-height:1.7;color:#111}.layout{display:block;max-width:none}.sidebar,.tools,.mobile-nav{display:none}main{padding:0}.cover{color:#14303b;background:#eef3f4;border:1px solid #bacbd1;border-bottom:4px solid #bd6b35;padding:22px 26px;break-after:page}.cover p,.eyebrow{color:#334b55}.cover h1{font-size:30pt}.pills span{border-color:#c0cdd1}.intro{background:#fff;border:1px solid #ccd4d7;margin:0 0 18px}.chapter{border:0;border-radius:0;box-shadow:none;padding:0;margin:24px 0;break-inside:auto}.chapter h2{font-size:18pt;break-after:avoid}.chapter h3{font-size:13pt;break-after:avoid}.table-wrap{overflow:visible;border-radius:0;break-inside:auto}table{font-size:9pt;line-height:1.6}th,td{min-width:0;padding:7px;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}p,li{orphans:3;widows:3}code{font-size:9pt}pre{color:#111;background:#f0f3f4}a{color:inherit}footer{border-top:1px solid #ddd}}
</style>
</head>
<body>
<div class="layout">
<aside class="sidebar" aria-label="فهرس المستند">
<div class="brand">waffarly.</div><p class="subtitle">دليل مراجعة الشيفت والتقارير</p>
<div class="tools"><button type="button" onclick="window.print()">طباعة / حفظ PDF</button><a href="POS_SHIFTS_A_TO_Z_AR.md">نسخة النص</a></div>
<nav>__NAV__</nav>
</aside>
<main>
<header class="cover">
<div class="eyebrow">POS · OPERATIONS REVIEW · 24 OCT 2026</div>
<h1>الشيفت والكاشير<br>وتقارير الـPOS</h1>
<p>من أول الفتح لحد الجرد والإقفال والمراجعة — شرح بالمصري للموجود، والناقص، والقرارات المطلوبة.</p>
<div class="pills"><span>٢٥ قسم</span><span>مراجعة كود فعلية</span><span>٢٠ اختبار ناجح</span><span>قرارات وأولويات</span></div>
</header>
<details class="mobile-nav"><summary>فهرس المستند — اختار الجزء اللي محتاجه</summary><nav>__NAV__</nav></details>
<div class="intro"><strong>قبل ما تبدأ</strong><p>ده وصف لنسخة المشروع المحلية يوم ٢٤ أكتوبر ٢٠٢٦. التوصيات مش قرارات مطبّقة، ونجاح الاختبارات المركزة مش اعتماد تشغيل فرع أوأجهزة فعلية.</p><p>تقدر تقرأه هنا أوتستخدم «طباعة / حفظ PDF» من المتصفح. روابط المراجع بتفتح ملفات المشروع، فخلي نسخة HTML في نفس مكانها جنب نسخة Markdown لو هتستخدم الروابط.</p></div>
__BODY__
<footer>إعداد للمراجعة واتخاذ القرار داخل مشروع Waffarly • نسخة ٢٤ أكتوبر ٢٠٢٦ • مصدر المحتوى: المستند النصي المرفق.</footer>
</main>
</div>
</body>
</html>
""".replace("__NAV__", navigation).replace("__BODY__", "\n".join(body))


class CheckDocument(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.anchors = set()
        self.links = []
        self.tables = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.anchors, attrs["id"]
            self.anchors.add(attrs["id"])
        if tag == "a":
            self.links.append(attrs["href"])
        if tag == "table":
            self.tables += 1


assert section == 25, section
assert "\x00" not in html
parser = CheckDocument()
parser.feed(html)
for link in parser.links:
    if link.startswith("#"):
        assert link[1:] in parser.anchors, link
    else:
        assert (root / link).exists(), link
assert parser.tables == 13, parser.tables
target.write_text(html, encoding="utf-8")
print(f"Rendered {target.name}: {section} sections, {parser.tables} tables, {len(parser.links)} validated links.")
