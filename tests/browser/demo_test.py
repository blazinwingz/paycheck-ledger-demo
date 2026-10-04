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
        pg.get_by_role("group", name=group, exact=True).get_by_role("button", name=option, exact=True).click()
        pg.wait_for_timeout(400)
    def pressed(group, option):
        return pg.get_by_role("group", name=group, exact=True).get_by_role("button", name=option, exact=True).get_attribute("aria-pressed") == "true"
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

    # What if (salary): try traditional without touching the setup, then apply it
    pick("Paid by", "Salary")
    tab("Forecast")
    check("WHAT IF" in up() and "Change anything above" in body(), "what-if panel shows on salary")
    before = taxes()
    pick("What-if 401k", "Traditional")
    t = body()
    check("less income tax" in t and "Make this my setup" in t, "what-if: traditional shows less income tax")
    check(abs(taxes() - before) < 0.01 and "Roth 401k 20%" in t, "what-if: setup unchanged until applied")
    pg.get_by_role("button", name="Make this my setup").click(); pg.wait_for_timeout(400)
    check("Traditional 401k 20%" in body() and taxes() < before, "what-if: applying changes the setup")
    check("Change anything above" in body(), "what-if: resets after applying")
    pick("401k", "Roth")
    pick("Paid by", "Hourly")

    # Pay frequency and W-4 filing status
    count = lambda: int(re.search(r"(\d+) PAYCHECKS? ·", up()).group(1))
    biweekly_count, biweekly_tax = count(), taxes()
    pick("Pay frequency", "Weekly")
    check(count() == 2 * biweekly_count, "weekly: the sample becomes twice as many checks")
    check("HSA $50.00" in body(), "weekly: HSA per check halves, same yearly amount")
    tab("Forecast"); t = body()
    check("Week 2 has no overtime" not in t and re.search(r"An overtime hour bills \$[1-9]", t), "weekly: one week per check, overtime hour still counts")
    tab("Checks"); check("these dates have nothing logged" not in body(), "weekly: no false missing-paycheck warnings")
    for t in TABS: tab(t)
    check(not pg.get_by_role("group", name="Pay frequency", exact=True).get_by_role("button", name="Twice a month").count(),
          "hourly: twice a month isn't offered")
    pick("Pay frequency", "Every 2 weeks")
    check(count() == biweekly_count and abs(taxes() - biweekly_tax) < 0.01, "back to every 2 weeks: sample as before")
    pick("Paid by", "Salary")
    for freq, per, want in [("Twice a month", 24, "2,416.67"), ("Monthly", 12, "4,833.33")]:
        pick("Pay frequency", freq)
        tab("Forecast"); t = body()
        check(f"÷ {per}" in t and want in t, f"salary {freq.lower()}: 58,000 ÷ {per} = {want}")
        tab("Checks"); check("these dates have nothing logged" not in body(), f"salary {freq.lower()}: no false missing-paycheck warnings")
        for t in TABS: tab(t)
    pick("Pay frequency", "Every 2 weeks")
    single_tax = taxes()
    pick("W-4 filing status", "Married filing jointly")
    check(taxes() < single_tax, "married filing jointly: less withheld than single")
    pick("W-4 filing status", "Single")
    pick("Paid by", "Hourly")

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

    # Odd ledgers (CSV imports, typos, last year's checks) must never break a tab.
    import json
    def load(entries):
        pg.evaluate("([k,v])=>localStorage.setItem(k,v)", ["paycheck_ledger_2026",
            json.dumps({"entries": entries, "years": [], "removedYears": ["y2024", "y2025"]})])
        pg.reload(); pg.wait_for_timeout(900)
    def all_tabs_ok():
        bad = []
        for t in TABS:
            tab(t); x = body()
            if "Something broke" in x or "NaN" in x or "Infinity" in x: bad.append(t)
        return bad
    P = lambda i, d, **k: {"id": i, "type": "paycheck", "date": d, "gross": 2000, "taxTotal": 400, **k}
    load([P("a", "2026-06-05", hsa="100.00", dental="1.00", label="Jun"), P("b", "2026-06-19", hsa="100.00", dental="1.00", label="Jun 2")])
    tab("Trends"); m = re.search(r"YOURS SO FAR THIS YEAR\s*\$([\d,\.]+)", up())
    check(m and m.group(1) == "200.00", "HSA typed as text still adds up ($200, not NaN)")
    load([P("a", "2026-06-05")])
    check(all_tabs_ok() == [], "a single paycheck: no tab breaks or shows NaN")
    load([P("a", "2026-06-05"), P("b", "2026-06-19")])
    ok = all_tabs_ok() == []; tab("Log")
    check(ok and "Jun check" in body(), "paychecks with no label: named from the date, nothing breaks")
    load([P("a", "06/05/2026x"), P("b", "2026-06-19", label="Ok")])
    ok = all_tabs_ok() == []; tab("Log")
    check(ok and "date can't be read" in body() and gross() == 2000.0, "a bad date: flagged, kept out of totals, nothing breaks")
    load([P("a", "2025-12-26", label="Dec"), P("b", "2026-01-09", label="Jan")])
    tab("Log"); t = body()
    check("2025 · not in 2026 totals" in t and gross() == 2000.0, "last year's check: shown but not counted")
    tab("Backup"); pg.get_by_role("button", name="Clear the ledger").click(); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Erase everything").click(); pg.wait_for_timeout(500)
    check("SET UP YOUR LEDGER" in up() and "Everything cleared" in body(), "erase everything: clears and opens the setup")
    browser.close()

print("\n".join(results))
print("page errors:", errors or "none")
sys.exit(1 if errors or any(r.startswith("FAIL") for r in results) else 0)
