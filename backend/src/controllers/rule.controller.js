const { pool } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

exports.getActiveRules = async (req, res) => {
  const result = await pool.query(`
    SELECT version, rules, effective_from, status, updated_at
    FROM rule_configs
    WHERE status = 'ACTIVE'
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    return res.status(404).json(error('NOT_FOUND', 'No active rule configuration found', [], req.id));
  }

  res.json(success(result.rows[0]));
};

exports.getRuleVersions = async (req, res) => {
  const result = await pool.query(`
    SELECT version, effective_from, effective_to, status, created_at
    FROM rule_configs
    ORDER BY created_at DESC
  `);
  
  res.json(success(result.rows));
};

exports.getRuleByVersion = async (req, res) => {
  const { version } = req.params;
  
  const result = await pool.query(`
    SELECT version, rules, effective_from, effective_to, status, created_at, updated_at
    FROM rule_configs
    WHERE version = $1
  `, [version]);
  
  if (result.rows.length === 0) {
    return res.status(404).json(error('NOT_FOUND', 'Rule configuration not found', [], req.id));
  }

  res.json(success(result.rows[0]));
};

// Simplified create/activate for hackathon
exports.createRuleConfig = async (req, res) => {
  const { version, rules } = req.body;
  const createdBy = req.user.sub;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if version exists
    const check = await client.query('SELECT 1 FROM rule_configs WHERE version = $1', [version]);
    if (check.rows.length > 0) {
      throw { statusCode: 409, code: 'CONFLICT', message: 'Rule version already exists' };
    }

    const result = await client.query(`
      INSERT INTO rule_configs (version, rules, effective_from, status, created_by)
      VALUES ($1, $2, NOW(), 'DRAFT', $3)
      RETURNING version, status, created_at
    `, [version, JSON.stringify(rules), createdBy]);

    await client.query('COMMIT');
    res.status(201).json(success(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.statusCode) {
      return res.status(err.statusCode).json(error(err.code, err.message, [], req.id));
    }
    throw err;
  } finally {
    client.release();
  }
};

exports.activateRuleConfig = async (req, res) => {
  const { version } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT * FROM rule_configs WHERE version = $1', [version]);
    if (check.rows.length === 0) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Rule configuration not found' };
    }

    // Retire current active
    await client.query(`
      UPDATE rule_configs 
      SET status = 'RETIRED', effective_to = NOW(), updated_at = NOW() 
      WHERE status = 'ACTIVE'
    `);

    // Activate new
    const result = await client.query(`
      UPDATE rule_configs
      SET status = 'ACTIVE', effective_from = NOW(), effective_to = NULL, updated_at = NOW()
      WHERE version = $1
      RETURNING version, status
    `, [version]);

    await client.query('COMMIT');
    res.json(success(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.statusCode) {
      return res.status(err.statusCode).json(error(err.code, err.message, [], req.id));
    }
    throw err;
  } finally {
    client.release();
  }
};