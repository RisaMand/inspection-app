const { pool } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

exports.createSession = async (req, res) => {
  const inspectorId = req.user.sub;
  const { visit_number, shop_number, gps_lat, gps_lng } = req.body;

  const result = await pool.query(`
    INSERT INTO sessions (inspector_id, status, visit_number, shop_number, gps_lat, gps_lng)
    VALUES ($1, 'OPEN', $2, $3, $4, $5)
    RETURNING id, start_time, status, visit_number, shop_number, gps_lat, gps_lng
  `, [
    inspectorId, 
    visit_number !== undefined ? visit_number : null, 
    shop_number !== undefined ? shop_number : null, 
    gps_lat !== undefined ? gps_lat : null, 
    gps_lng !== undefined ? gps_lng : null
  ]);

  res.status(201).json(success(result.rows[0]));
};

exports.getSession = async (req, res) => {
  const { id } = req.params;
  const inspectorId = req.user.sub;

  const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json(error('NOT_FOUND', 'Session not found', [], req.id));
  }

  if (result.rows[0].inspector_id !== inspectorId) {
    return res.status(403).json(error('FORBIDDEN', 'Access denied', [], req.id));
  }

  // Closeout Step 4: a session is a visit -- "get one session" is expected
  // to mean "with its items" (Team Build Bible), not just the bare visit
  // metadata. inspections.session_id is a nullable FK, so this is a
  // follow-up query rather than a join, matching how product_id is
  // already resolved separately in the sync flow.
  const itemsRes = await pool.query(
    'SELECT id, status, product_name, brand_name, updated_at FROM inspections WHERE session_id = $1 ORDER BY updated_at DESC',
    [id]
  );

  res.json(success({ ...result.rows[0], items: itemsRes.rows }));
};

exports.closeSession = async (req, res) => {
  const { id } = req.params;
  const inspectorId = req.user.sub;

  const check = await pool.query('SELECT inspector_id, status FROM sessions WHERE id = $1', [id]);
  
  if (check.rows.length === 0) {
    return res.status(404).json(error('NOT_FOUND', 'Session not found', [], req.id));
  }

  if (check.rows[0].inspector_id !== inspectorId) {
    return res.status(403).json(error('FORBIDDEN', 'Access denied', [], req.id));
  }

  if (check.rows[0].status === 'CLOSED') {
    return res.status(400).json(error('BAD_REQUEST', 'Session is already closed', [], req.id));
  }

  const result = await pool.query(`
    UPDATE sessions
    SET status = 'CLOSED', end_time = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING id, start_time, end_time, status
  `, [id]);

  res.json(success(result.rows[0]));
};
