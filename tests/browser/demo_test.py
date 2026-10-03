"""Browser test for the demo build. Run `npm run build` first.

Opens dist/paycheck-ledger.html in Chromium with no Claude account features
(as a visitor sees it) and clicks every tab. Then the setup: hourly or salary
(sample swap, salary math, hidden hours/overtime), HSA, 401k type, ESPP, reload
memory. Then starting a ledger of your own: starting totals for a mid-year
start, logging a first paycheck, the backup reminder, and reload memory.
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

PAGE = (pathlib.Path(__file__).resolve().parents[2] / "dist" / "paycheck-ledger.html")
TABS = ["Log", "Forecast", "Trends", "Checks", "Past years", "Tax outlook", "Backup"]
results, errors = [], []

def check(cond, msg):
    results.append(("PASS " if cond else "FAIL ") + msg)

def stat(text, label):
    m = re.search(label + r"\s*\$([\d,\.]+)", text)
    return float(m.group(1).replace(",", "")) if m else None

with sync_playwright() as pw:
    exe = pathlib.Path("/opt/pw-browsers/chromium")
    browser = pw.chromium.launch(executable_path=str(exe)) if exe.exists() else pw.chromium.launch()
    pg = browser.new_page(viewport={"width": 1100, "height": 1000})
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(PAGE.as_uri()); pg.wait_for_timeout(1200)
    body = lambda: pg.inner_text("body")
    up = lambda: body().upper()
    def tab(name):
        pg.get_by_role("button", name=name, exact=False).first.click(); pg.wait_for_timeout(300)
    def pick(group, option):
        pg.get_by_role("group", name=group).get_by_role("button", name=option, exact=True).click()
        pg.wait_for_timeout(400)
    def pressed(group, option):
        return pg.get_by_role("group", name=group).get_by_role("button", name=option, exact=True).get_attribute("aria-pressed") == "true"
    def open_setup():
        b = pg.get_by_role("button", name="Change setup")
        if b.count(): b.click(); pg.wait_for_timeout(300)
    gross = lambda: stat(up(), "PAYROLL GROSS YTD")
    taxes = lambda: stat(up(), "TAXES YTD")

    check("every figure here is invented" in body(), "demo banner shows")
    check("Saved in this browser only" in body(), "says where entries are saved")
    for t in TABS: tab(t)
    hourly = gross()

    # Pay type
    open_setup()
    pick("Paid by", "Salary")
    check("salaried sample year" in body(), "salary switch loads the salaried sample")
    check(gross() != hourly, "YTD changes with the sample")
    for t in TABS: tab(t)
    tab("Forecast"); t = body()
    check("Yearly salary" in t and "2,230.77" in t, "forecast: 58,000 / 26 = 2,230.77")
    check("WEEK LOG" not in t.upper(), "forecast: week log hidden")
    tab("Tax outlook"); check("Overtime deduction" not in body(), "tax: no overtime deduction")
    tab("Past years"); check("PAY RATE HISTORY" not in up(), "past years: rate history hidden")
    pick("Paid by", "Hourly")
    check(gross() == hourly, "switching back restores the hourly sample")
    pick("Paid by", "Salary"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(1500)
    check("Salary" in body() and "a year" in body(), "salary choice survives a reload")
    open_setup(); pick("Paid by", "Hourly")

    # HSA (needs a CDHP/HDHP health plan)
    tab("Trends"); check("HSA PACING" in up(), "hsa on: pacing panel shows")
    pick("HSA", "None")
    check("sample year now follows this setup" in body(), "hsa off: sample redone for the setup")
    for t in TABS: tab(t)
    tab("Trends"); check("HSA PACING" not in up(), "hsa off: pacing panel hidden")
    tab("Forecast"); t = up()
    check("INTO HSA" not in t and "INTO DENTAL" in t, "hsa off: forecast has no HSA")
    tab("Tax outlook"); t = body()
    check("with no HSA" in t and "HSA stays under the cap" not in t, "hsa off: tax tab leaves HSA out")
    tab("Past years"); check("HSA (yours)" not in body(), "hsa off: past years hide HSA")
    pick("HSA", "Have one")
    tab("Trends"); check("HSA PACING" in up(), "hsa back on: pacing panel returns")

    # 401k: traditional comes off before income tax, so less is withheld
    roth_tax = taxes()
    pick("401k", "Traditional")
    check(taxes() < roth_tax, "traditional 401k: less tax withheld than Roth")
    tab("Trends"); check("TRADITIONAL 401K PACING" in up(), "traditional 401k: pacing panel renamed")
    tab("Forecast"); check("Traditional 401k" in body(), "traditional 401k: forecast line renamed")
    for t in TABS: tab(t)
    pick("401k", "None")
    tab("Trends"); check("401K PACING" not in up(), "no 401k: pacing panel hidden")
    tab("Tax outlook"); check("401k stays under" not in body(), "no 401k: checklist item hidden")
    pick("401k", "Roth")
    check(abs(taxes() - roth_tax) < 0.01, "back to Roth: taxes as before")

    # ESPP and savings
    pick("ESPP", "None")
    tab("Forecast"); check("ESPP stock" not in body(), "no ESPP: hidden from the forecast")
    pick("ESPP", "Have one")
    for t in TABS: tab(t)
    pg.get_by_role("button", name="Done").click(); pg.wait_for_timeout(300)

    # Starting a ledger of your own, partway through the year
    pg.get_by_role("button", name="Start my own ledger").click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Clear it and set up").click(); pg.wait_for_timeout(500)
    check("Sample cleared" in body() and "SET UP YOUR LEDGER" in up(), "start my own: sample cleared, setup open")
    check("every figure here is invented" not in body(), "start my own: demo banner gone")
    tab("Past years"); check("2024" not in body() and "2025" not in body(), "start my own: sample past years gone")
    pg.get_by_role("button", name="Starting partway through the year?").click(); pg.wait_for_timeout(200)
    for label, v in [("Paychecks already paid", "10"), ("Gross pay", "20000"), ("Federal tax", "1500"),
                     ("Social Security", "1200"), ("Medicare", "280"), ("State tax", "900")]:
        pg.get_by_label(label, exact=True).first.fill(v)
    pg.wait_for_timeout(400)
    check(gross() == 20000.0 and "10 PAYCHECKS" in up(), "starting totals count toward the year")
    pg.get_by_role("button", name="Done").click(); pg.wait_for_timeout(300)
    tab("Log")
    pg.get_by_role("button", name="Log a paycheck", exact=False).first.click(); pg.wait_for_timeout(300)
    pg.get_by_label("Pay date", exact=True).fill("2026-06-05")
    pg.get_by_label("Gross pay", exact=True).fill("2000")
    pg.get_by_label("Tax total", exact=True).fill("400")
    pg.get_by_role("button", name="Save paycheck").click(); pg.wait_for_timeout(500)
    check(gross() == 22000.0 and "11 PAYCHECKS" in up(), "first logged check adds to the starting totals")
    for t in TABS: tab(t)
    tab("Tax outlook"); check("10 from starting totals" in body(), "tax outlook counts the starting totals")
    check("Not backed up yet" in body(), "backup reminder shows for unsaved work")
    pg.get_by_role("button", name="Back up now").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Download backup", exact=False).click(); pg.wait_for_timeout(500)
    check("Not backed up yet" not in body() and "Changed since" not in body(), "backup reminder clears after a backup")
    pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(1500)
    check(gross() == 22000.0, "own ledger and starting totals survive a reload")
    browser.close()

print("\n".join(results))
print("page errors:", errors or "none")
sys.exit(1 if errors or any(r.startswith("FAIL") for r in results) else 0)
