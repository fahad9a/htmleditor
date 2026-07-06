// A built-in sample presentation so new users can try the editor instantly
// without needing a Claude-generated file at hand.
export const DEMO_TITLE = "Sample: Q2 Business Review";

export const DEMO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Q2 Business Review</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#f4f6fb; color:#1e293b; }
  section.slide { min-height:92vh; padding:64px 72px; display:flex; flex-direction:column; justify-content:center; background:#fff; margin:24px auto; max-width:1100px; border-radius:20px; box-shadow:0 4px 24px rgba(30,41,59,.08); }
  h1 { font-size:52px; letter-spacing:-1px; color:#0f172a; }
  h2 { font-size:34px; color:#0f172a; margin-bottom:20px; }
  p.lead { font-size:20px; color:#64748b; margin-top:16px; max-width:640px; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-top:28px; }
  .kpi { background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:24px; }
  .kpi .num { font-size:36px; font-weight:800; color:#4f46e5; }
  .kpi .lbl { font-size:13px; color:#64748b; margin-top:6px; text-transform:uppercase; letter-spacing:.5px; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:15px; }
  th { text-align:left; padding:12px 16px; background:#f1f5f9; color:#475569; font-weight:600; }
  td { padding:12px 16px; border-bottom:1px solid #e2e8f0; }
  .pos { color:#059669; font-weight:600; }
  .neg { color:#dc2626; font-weight:600; }
  .tag { display:inline-block; background:#eef2ff; color:#4f46e5; border-radius:999px; padding:6px 16px; font-size:13px; font-weight:600; margin-bottom:20px; }
  ul.points { margin-top:18px; padding-left:22px; line-height:2; font-size:17px; color:#334155; }
</style>
</head>
<body>

<section class="slide">
  <span class="tag">Quarterly review</span>
  <h1>Q2 Business Review</h1>
  <p class="lead">Revenue, growth and operations highlights for the second quarter. Click any element to edit it — this is a live sample document.</p>
</section>

<section class="slide">
  <h2>Key metrics</h2>
  <div class="kpis">
    <div class="kpi"><div class="num">$4.2M</div><div class="lbl">Revenue</div></div>
    <div class="kpi"><div class="num">+18%</div><div class="lbl">Growth YoY</div></div>
    <div class="kpi"><div class="num">1,284</div><div class="lbl">New customers</div></div>
    <div class="kpi"><div class="num">96.5%</div><div class="lbl">Retention</div></div>
  </div>
</section>

<section class="slide">
  <h2>Regional performance</h2>
  <table>
    <thead><tr><th>Region</th><th>Revenue</th><th>vs Q1</th><th>Pipeline</th></tr></thead>
    <tbody>
      <tr><td>North America</td><td>$1.9M</td><td class="pos">+22%</td><td>$2.4M</td></tr>
      <tr><td>Europe</td><td>$1.3M</td><td class="pos">+14%</td><td>$1.8M</td></tr>
      <tr><td>Middle East</td><td>$0.7M</td><td class="pos">+31%</td><td>$1.1M</td></tr>
      <tr><td>APAC</td><td>$0.3M</td><td class="neg">-4%</td><td>$0.6M</td></tr>
    </tbody>
  </table>
</section>

<section class="slide">
  <h2>Priorities for Q3</h2>
  <ul class="points">
    <li>Launch the self-serve onboarding flow</li>
    <li>Expand the Middle East sales team</li>
    <li>Ship the analytics dashboard redesign</li>
    <li>Reduce infrastructure cost by 15%</li>
  </ul>
</section>

</body>
</html>`;
