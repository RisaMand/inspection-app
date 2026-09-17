const { pool } = require('../config/db');
const { success } = require('../utils/apiResponse');

exports.getSummary = async (req, res) => {
  const [totalRes, statusRes, ruleConfigRes, recentRes, complianceRes] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM inspections'),
    pool.query('SELECT status, COUNT(*) FROM inspections GROUP BY status'),
    pool.query('SELECT rule_config_version, COUNT(*) FROM inspections GROUP BY rule_config_version'),
    pool.query('SELECT id, client_inspection_id, status, updated_at FROM inspections ORDER BY updated_at DESC LIMIT 5'),
    pool.query(`
      SELECT compliance_result->>'verdict' as verdict, COUNT(*) 
      FROM inspections 
      WHERE compliance_result IS NOT NULL 
      GROUP BY compliance_result->>'verdict'
    `)
  ]);

  const summary = {
    totalInspections: parseInt(totalRes.rows[0].count, 10),
    pendingReview: 0,
    completed: 0,
    nonCompliant: 0,
    compliant: 0,
    conflicted: 0,
    byRuleConfigVersion: ruleConfigRes.rows.map(r => ({ version: r.rule_config_version, count: parseInt(r.count, 10) })),
    recentInspections: recentRes.rows
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
      SELECT id, client_inspection_id, product_name, brand_name, status, updated_at 
      FROM inspections 
      WHERE product_name ILIKE $1 OR brand_name ILIKE $1 OR barcode_value ILIKE $1
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
