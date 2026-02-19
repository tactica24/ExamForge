const target = process.argv[2] || process.env.TARGET_URL || "http://localhost:3000/api/health";
const total = Number(process.env.LOAD_TOTAL || process.argv[3] || 200);
const concurrency = Number(process.env.LOAD_CONCURRENCY || process.argv[4] || 20);

if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(concurrency) || concurrency <= 0) {
  console.error("Invalid LOAD_TOTAL/LOAD_CONCURRENCY values.");
  process.exit(1);
}

let sent = 0;
let ok = 0;
let failed = 0;
const latencies = [];

async function hitOnce() {
  const start = Date.now();
  try {
    const res = await fetch(target, { cache: "no-store" });
    if (res.ok) ok += 1;
    else failed += 1;
  } catch {
    failed += 1;
  } finally {
    latencies.push(Date.now() - start);
  }
}

async function worker() {
  while (true) {
    const index = sent;
    if (index >= total) return;
    sent += 1;
    await hitOnce();
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

(async () => {
  const started = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const durationMs = Date.now() - started;
  const rps = (total / Math.max(1, durationMs)) * 1000;

  console.log(JSON.stringify({
    target,
    total,
    concurrency,
    ok,
    failed,
    duration_ms: durationMs,
    rps: Number(rps.toFixed(2)),
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    p99_ms: percentile(latencies, 99)
  }, null, 2));
})();
