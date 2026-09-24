const { pool } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

exports.getSummary = async (req, res) => {
  const { from, to } = req.query;

  // Closeout Step 6: optional time-window scoping, plus real trending.
  // Scoped to `created_at` (this row's real server-insert time), not
  // `client_created_at` -- the CREATE branch in sync.controller.js writes
  // client_created_at == client_updated_at for every row today (both
  // sourced from the same item.clientUpdatedAt), so that column can't
  // yet distinguish "captured" from "last touched" either. created_at is
  // the one timestamp guaranteed to reflect this row's real position in
  // time, so it's the honest choice until client_created_at means
  // something different from client_updated_at.
  let fromDate = null;
  let toDate = null;
  if (from !== undefined) {
    fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Invalid `from` date', [{ path: 'from', message: 'Must be a valid ISO date string' }], req.id));
    }
  }
  if (to !== undefined) {
    toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Invalid `to` date', [{ path: 'to', message: 'Must be a valid ISO date string' }], req.id));
    }
  }

  const windowParams = [];
  const windowConditions = [];
  if (fromDate) {
    windowParams.push(fromDate.toISOString());
    windowConditions.push(`created_at >= $${windowParams.length}`);
  }
  if (toDate) {
    windowParams.push(toDate.toISOString());
    windowConditions.push(`created_at <= $${windowParams.length}`);
  }

  // Builds a WHERE clause combining the shared time-window conditions
  // (already bound to windowParams above) with any extra static
  // conditions a given query needs -- keeps every aggregate below
  // scoped to the same window without repeating the from/to logic.
  const whereWith = (...extra) => {
    const all = [...windowConditions, ...extra];
    return all.length > 0 ? `WHERE ${all.join(' AND ')}` : '';
  };

  const [totalRes, statusRes, ruleConfigRes, recentRes, complianceRes, trendingRes, dailyRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM inspections ${whereWith()}`, windowParams),
    pool.query(`SELECT status, COUNT(*) FROM inspections ${whereWith()} GROUP BY status`, windowParams),
    pool.query(`SELECT rule_config_version, COUNT(*) FROM inspections ${whereWith()} GROUP BY rule_config_version`, windowParams),
    pool.query(`SELECT id, client_inspection_id, status, updated_at FROM inspections ${whereWith()} ORDER BY updated_at DESC LIMIT 5`, windowParams),
    pool.query(`
      SELECT compliance_result->>'verdict' as verdict, COUNT(*)
      FROM inspections
      ${whereWith(`compliance_result IS NOT NULL`)}
      GROUP BY compliance_result->>'verdict'
    `, windowParams),
    // Trending non-compliance types over the window -- same JS-side
    // unnesting as getViolations below, for the same reason (pg-mem
    // can't resolve an outer-table column inside a LATERAL join).
    pool.query(`
      SELECT compliance_result
      FROM inspections
      ${whereWith(`rule_engine_status = 'EVALUATED'`, `compliance_result IS NOT NULL`)}
    `, windowParams),
    // Section 2.8: DashboardHome's trend LINE chart (7/30/90-day selector)
    // needs a real day-by-day series -- nothing above gives one (trending
    // is one aggregate count per rule for the whole window, not per day).
    // Bucketed in JS on created_at's UTC calendar date, same reasoning as
    // trending's JS-side unnesting: keeps this verifiable by a real test
    // instead of trusted on a raw SQL date_trunc that pg-mem may not support.
    pool.query(`
      SELECT created_at, compliance_result->>'verdict' as verdict
      FROM inspections
      ${whereWith()}
    `, windowParams),
  ]);

  const summary = {
    totalInspections: parseInt(totalRes.rows[0].count, 10),
    pendingReview: 0,
    completed: 0,
    nonCompliant: 0,
    compliant: 0,
    conflicted: 0,
    byRuleConfigVersion: ruleConfigRes.rows.map(r => ({ version: r.rule_config_version, count: parseInt(r.count, 10) })),
    recentInspections: recentRes.rows,
    window: { from: fromDate ? fromDate.toISOString() : null, to: toDate ? toDate.toISOString() : null },
  };

  statusRes.rows.forEach(r => {
    if (r.status === 'PENDING_REVIEW') summary.pendingReview = parseInt(r.count, 10);
    if (r.status === 'COMPLETED') summary.completed = parseInt(r.count, 10);
    if (r.status === 'CONFLICTED') summary.conflicted = parseInt(r.count, 10);
  });

  complianceRes.rows.forEach(r => {
    if (r.verdict === 'NON_COMPLIANT' || r.verdict === 'ERROR') summary.nonCompliant += parseInt(r.count, 10);
    if (r.verdict === 'COMPLIANT' || r.verdict === 'COMPLIANT_WITH_WARNINGS') summary.compliant += parseInt(r.count, 10);
  });

  const trendingMap = new Map();
  for (const row of trendingRes.rows) {
    const failures = row.compliance_result?.failures || [];
    for (const f of failures) {
      if (!trendingMap.has(f.rule_id)) {
        trendingMap.set(f.rule_id, {
          ruleId: f.rule_id,
          severity: f.severity,
          clauseCitation: f.clause_citation,
          reason: f.reason,
          count: 0,
        });
      }
      trendingMap.get(f.rule_id).count += 1;
    }
  }
  summary.trending = [...trendingMap.values()].sort((a, b) => b.count - a.count);

  // byDay: {date: 'YYYY-MM-DD', total, compliant, nonCompliant}, sorted
  // ascending, only for days with at least one real row (no zero-filled
  // padding -- the chart component decides how to render gaps).
  const dayMap = new Map();
  for (const row of dailyRes.rows) {
    const day = row.created_at.toISOString().slice(0, 10);
    if (!dayMap.has(day)) {
      dayMap.set(day, { date: day, total: 0, compliant: 0, nonCompliant: 0 });
    }
    const bucket = dayMap.get(day);
    bucket.total += 1;
    if (row.verdict === 'NON_COMPLIANT' || row.verdict === 'ERROR') bucket.nonCompliant += 1;
    if (row.verdict === 'COMPLIANT' || row.verdict === 'COMPLIANT_WITH_WARNINGS') bucket.compliant += 1;
  }
  summary.byDay = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  res.json(success(summary));
};

exports.searchDashboard = async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.json(success({ inspections: [], products: [], users: [] }));
  }

  const queryParam = `%${q}%`;

  const [inspections, products, users] = await Promise.all([
    pool.query(`
      SELECT
        i.id, i.client_inspection_id, i.product_name, i.brand_name, i.status, i.updated_at,
        u.full_name AS inspector_name,
        s.visit_number, s.shop_number
      FROM inspections i
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN sessions s ON i.session_id = s.id
      WHERE i.product_name ILIKE $1 OR i.brand_name ILIKE $1 OR i.barcode_value ILIKE $1
      LIMIT 20
    `, [queryParam]),
    pool.query(`
      SELECT id, barcode_value, product_name, brand_name 
      FROM products 
      WHERE product_name ILIKE $1 OR brand_name ILIKE $1 OR barcode_value ILIKE $1
      LIMIT 20
    `, [queryParam]),
    pool.query(`
      SELECT id, full_name, email, role 
      FROM users 
      WHERE full_name ILIKE $1 OR email ILIKE $1
      LIMIT 20
    `, [queryParam])
  ]);

  res.json(success({
    inspections: inspections.rows,
    products: products.rows,
    users: users.rows
  }));
};

exports.getViolations = async (req, res) => {
  // Real aggregation over the full dataset -- no row cap, no raw list.
  // pg-mem (the in-memory Postgres used by the test suite) can't resolve
  // an outer-table column reference inside a LATERAL join (confirmed live:
  // 'column "compliance_result" does not exist' even with explicit
  // CROSS JOIN LATERAL), so the failures[] array is unnested and grouped
  // here in JS instead of via jsonb_array_elements in SQL -- same result,
  // works identically against real Postgres, and is actually verifiable
  // by the test suite rather than trusted on faith.
  const result = await pool.query(`
    SELECT compliance_result
    FROM inspections
    WHERE rule_engine_status = 'EVALUATED' AND compliance_result IS NOT NULL
  `);

  const byRuleMap = new Map();
  for (const row of result.rows) {
    const failures = row.compliance_result?.failures || [];
    for (const f of failures) {
      if (!byRuleMap.has(f.rule_id)) {
        byRuleMap.set(f.rule_id, {
          ruleId: f.rule_id,
          severity: f.severity,
          clauseCitation: f.clause_citation,
          reason: f.reason,
          count: 0,
        });
      }
      byRuleMap.get(f.rule_id).count += 1;
    }
  }

  const byRule = [...byRuleMap.values()].sort((a, b) => b.count - a.count);

  const byTier = ['substantive', 'cosmetic'].map((tier) => ({
    tier,
    count: byRule.filter((r) => r.severity === tier).reduce((sum, r) => sum + r.count, 0),
  }));

  res.json(success({
    totalViolations: byRule.reduce((sum, r) => sum + r.count, 0),
    byTier,
    byRule,
  }));
};

exports.getInspectors = async (req, res) => {
  const result = await pool.query(`
    SELECT id, full_name, email, is_active, last_login_at
    FROM users
    WHERE role = 'INSPECTOR'
    ORDER BY full_name ASC
  `);
  
  res.json(success(result.rows));
};

// Section 2.8: getInspectors above is just a user directory -- no session
// counts, items inspected, or violation counts at all. This is the real
// per-officer activity report (visits conducted / violations found / tier
// breakdown per officer, per the original PS's own enforcement-monitoring
// requirement), built from 3 real sources instead of invented:
//   - users: the inspector roster itself (so an inspector with zero
//     activity still appears, with real zeros, not silently omitted)
//   - sessions: session count per inspector
//   - inspections: item count + severity-tier breakdown per inspector,
//     unnested in JS (same pattern as getViolations above -- pg-mem, the
//     test suite's in-memory Postgres, has no jsonb_array_elements)
exports.getOfficerActivity = async (req, res) => {
  const [inspectorsRes, sessionCountsRes, inspectionsRes] = await Promise.all([
    pool.query(`
      SELECT id, full_name, email
      FROM users
      WHERE role = 'INSPECTOR'
      ORDER BY full_name ASC
    `),
    pool.query(`
      SELECT inspector_id, COUNT(*) as sessions_count
      FROM sessions
      GROUP BY inspector_id
    `),
    pool.query(`
      SELECT inspector_id, status, compliance_result
      FROM inspections
    `),
  ]);

  const sessionCountByInspector = new Map(
    sessionCountsRes.rows.map((r) => [r.inspector_id, parseInt(r.sessions_count, 10)])
  );

  const activityByInspector = new Map();
  for (const row of inspectionsRes.rows) {
    if (!activityByInspector.has(row.inspector_id)) {
      activityByInspector.set(row.inspector_id, {
        itemsInspected: 0,
        substantiveCount: 0,
        cosmeticCount: 0,
        erroredCount: 0,
      });
    }
    const bucket = activityByInspector.get(row.inspector_id);
    bucket.itemsInspected += 1;

    const verdict = row.compliance_result?.verdict;
    if (verdict === 'ERROR') bucket.erroredCount += 1;

    const failures = row.compliance_result?.failures || [];
    for (const f of failures) {
      if (f.severity === 'substantive') bucket.substantiveCount += 1;
      else if (f.severity === 'cosmetic') bucket.cosmeticCount += 1;
    }
  }

  const officerActivity = inspectorsRes.rows.map((insp) => {
    const activity = activityByInspector.get(insp.id) || {
      itemsInspected: 0,
      substantiveCount: 0,
      cosmeticCount: 0,
      erroredCount: 0,
    };
    return {
      inspectorId: insp.id,
      inspectorName: insp.full_name,
      sessionsCount: sessionCountByInspector.get(insp.id) || 0,
      itemsInspected: activity.itemsInspected,
      violationsFound: activity.substantiveCount + activity.cosmeticCount,
      substantiveCount: activity.substantiveCount,
      cosmeticCount: activity.cosmeticCount,
      erroredCount: activity.erroredCount,
    };
  });

  res.json(success(officerActivity));
};
