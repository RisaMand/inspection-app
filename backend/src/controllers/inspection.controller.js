const { pool } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

exports.getInspections = async (req, res) => {
  const { status, inspectorId, ruleConfigVersion, page = 1, limit = 10 } = req.query;
  const parsedPage = parseInt(page, 10) || 1;
  const parsedLimit = parseInt(limit, 10) || 10;
  const offset = (parsedPage - 1) * parsedLimit;
  const user = req.user;

  let query = 'SELECT * FROM inspections WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) FROM inspections WHERE 1=1';
  const queryParams = [];
  
  if (user.role === 'INSPECTOR') {
    queryParams.push(user.sub);
    query += ` AND inspector_id = $${queryParams.length}`;
    countQuery += ` AND inspector_id = $${queryParams.length}`;
  } else if (inspectorId && (user.role === 'OFFICIAL' || user.role === 'ADMIN')) {
    queryParams.push(inspectorId);
    query += ` AND inspector_id = $${queryParams.length}`;
    countQuery += ` AND inspector_id = $${queryParams.length}`;
  }

  if (status) {
    queryParams.push(status);
    query += ` AND status = $${queryParams.length}`;
    countQuery += ` AND status = $${queryParams.length}`;
  }
  
  if (ruleConfigVersion) {
    queryParams.push(ruleConfigVersion);
    query += ` AND rule_config_version = $${queryParams.length}`;
    countQuery += ` AND rule_config_version = $${queryParams.length}`;
  }

  query += ` ORDER BY updated_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  
  const finalParams = [...queryParams, parsedLimit, offset];
  
  const [dataRes, countRes] = await Promise.all([
    pool.query(query, finalParams),
    pool.query(countQuery, queryParams)
  ]);

  const total = parseInt(countRes.rows[0].count, 10);
  
  res.json(success(dataRes.rows, {
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit)
  }));
};

exports.getInspectionById = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const result = await pool.query('SELECT * FROM inspections WHERE id = $1', [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json(error('NOT_FOUND', 'Inspection not found', [], req.id));
  }
  
  const inspection = result.rows[0];

  if (user.role === 'INSPECTOR' && inspection.inspector_id !== user.sub) {
    return res.status(403).json(error('FORBIDDEN', 'Access denied', [], req.id));
  }

  res.json(success(inspection));
};

exports.updateInspection = async (req, res) => {
  const { id } = req.params;
  const { server_version, ...updates } = req.body;
  const user = req.user;

  if (server_version === undefined) {
    return res.status(400).json(error('BAD_REQUEST', 'server_version is required for optimistic concurrency', [], req.id));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const existing = await client.query('SELECT inspector_id, server_version, status FROM inspections WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Inspection not found' };
    }

    if (user.role === 'INSPECTOR' && existing.rows[0].inspector_id !== user.sub) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Access denied' };
    }

    if (existing.rows[0].server_version !== server_version) {
      throw { statusCode: 409, code: 'CONFLICT', message: 'Stale update. Server version mismatch.', details: { currentVersion: existing.rows[0].server_version } };
    }

    if (user.role === 'INSPECTOR' && existing.rows[0].status !== 'DRAFT' && existing.rows[0].status !== 'CONFLICTED') {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: 'Only DRAFT or CONFLICTED inspections can be updated' };
    }

    // Perform partial update
    const allowedFields = ['product_name', 'brand_name', 'manufacturer_name', 'manufacturer_address', 'packer_name', 'packer_address', 'importer_name', 'importer_address', 'declared_quantity', 'mrp', 'packed_date', 'expiry_date', 'customer_care_details', 'barcode_value', 'image_references', 'ocr_payload', 'extracted_fields', 'status'];
    
    let updateQuery = 'UPDATE inspections SET ';
    const queryValues = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateQuery += `${key} = $${paramIndex}, `;
        queryValues.push(key === 'image_references' || key === 'ocr_payload' || key === 'extracted_fields' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    updateQuery += `server_version = server_version + 1, updated_at = NOW() WHERE id = $${paramIndex} AND server_version = $${paramIndex + 1} RETURNING *`;
    queryValues.push(id, server_version);

    const result = await client.query(updateQuery, queryValues);

    await client.query(`
      INSERT INTO inspection_events (inspection_id, actor_id, event_type, payload)
      VALUES ($1, $2, 'UPDATED', $3)
    `, [id, user.sub, JSON.stringify(updates)]);

    await client.query('COMMIT');
    res.json(success(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.statusCode) {
      return res.status(err.statusCode).json(error(err.code, err.message, err.details, req.id));
    }
    throw err;
  } finally {
    client.release();
  }
};

exports.submitInspection = async (req, res) => {
  const { id } = req.params;
  const { server_version } = req.body;
  const user = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT status, inspector_id, server_version FROM inspections WHERE id = $1', [id]);
    
    if (existing.rows.length === 0) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Inspection not found' };
    }

    if (user.role === 'INSPECTOR' && existing.rows[0].inspector_id !== user.sub) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Access denied' };
    }

    if (existing.rows[0].server_version !== server_version) {
      throw { statusCode: 409, code: 'CONFLICT', message: 'Stale update. Server version mismatch.', details: { currentVersion: existing.rows[0].server_version } };
    }

    if (existing.rows[0].status !== 'DRAFT') {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: 'Only DRAFT inspections can be submitted' };
    }

    const result = await client.query(`
      UPDATE inspections SET status = 'PENDING_REVIEW', server_version = server_version + 1, updated_at = NOW()
      WHERE id = $1 AND server_version = $2 RETURNING *
    `, [id, server_version]);

    await client.query(`
      INSERT INTO inspection_events (inspection_id, actor_id, event_type, payload)
      VALUES ($1, $2, 'STATUS_CHANGED', '{"oldStatus":"DRAFT", "newStatus":"PENDING_REVIEW"}')
    `, [id, user.sub]);

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

exports.getInspectionEvents = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const inspection = await pool.query('SELECT inspector_id FROM inspections WHERE id = $1', [id]);
  if (inspection.rows.length === 0) {
    return res.status(404).json(error('NOT_FOUND', 'Inspection not found', [], req.id));
  }

  if (user.role === 'INSPECTOR' && inspection.rows[0].inspector_id !== user.sub) {
    return res.status(403).json(error('FORBIDDEN', 'Access denied', [], req.id));
  }

  const result = await pool.query('SELECT * FROM inspection_events WHERE inspection_id = $1 ORDER BY created_at DESC', [id]);
  res.json(success(result.rows));
};

exports.attachComplianceResult = async (req, res) => {
  const { id } = req.params;
  const { ruleConfigVersion, status, result } = req.body;
  const user = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT rule_config_version FROM inspections WHERE id = $1', [id]);
    
    if (existing.rows.length === 0) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Inspection not found' };
    }

    if (existing.rows[0].rule_config_version !== ruleConfigVersion) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: 'ruleConfigVersion mismatch' };
    }

    const updateRes = await client.query(`
      UPDATE inspections SET 
        compliance_result = $1, 
        rule_engine_status = $2,
        server_version = server_version + 1,
        updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [JSON.stringify(result), status, id]);

    await client.query(`
      INSERT INTO inspection_events (inspection_id, actor_id, event_type, payload)
      VALUES ($1, $2, 'RULE_RESULT_ATTACHED', $3)
    `, [id, user.sub, JSON.stringify({ status, ruleConfigVersion })]);

    await client.query('COMMIT');
    res.json(success(updateRes.rows[0]));
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

exports.getReportData = async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(`
    SELECT i.*, u.full_name as inspector_name, u.email as inspector_email
    FROM inspections i
    JOIN users u ON i.inspector_id = u.id
    WHERE i.id = $1
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json(error('NOT_FOUND', 'Inspection not found', [], req.id));
  }

  // Filter and shape data for report contract
  const data = result.rows[0];
  res.json(success({
    inspectionId: data.id,
    clientInspectionId: data.client_inspection_id,
    status: data.status,
    inspector: {
      id: data.inspector_id,
      name: data.inspector_name,
      email: data.inspector_email
    },
    capturedData: {
      productName: data.product_name,
      brandName: data.brand_name,
      manufacturerName: data.manufacturer_name,
      manufacturerAddress: data.manufacturer_address,
      packerName: data.packer_name,
      packerAddress: data.packer_address,
      importerName: data.importer_name,
      importerAddress: data.importer_address,
      declaredQuantity: data.declared_quantity,
      mrp: data.mrp,
      packedDate: data.packed_date,
      expiryDate: data.expiry_date,
      customerCareDetails: data.customer_care_details,
      barcodeValue: data.barcode_value,
      mrpRawText: data.mrp_raw_text
    },
    extractedFields: data.extracted_fields,
    imageReferences: data.image_references,
    ruleConfigVersion: data.rule_config_version,
    complianceResult: data.compliance_result,
    ruleEngineStatus: data.rule_engine_status,
    timestamps: {
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  }));
};
