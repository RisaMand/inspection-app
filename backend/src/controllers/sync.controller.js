const crypto = require('crypto');
const { pool } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { resolveProduct } = require('../services/productMatcher');

exports.syncInspections = async (req, res) => {
  const { idempotencyKey, items } = req.body;
  const inspectorId = req.user.sub;

  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check idempotency
    const idempotencyCheck = await client.query(
      'SELECT request_hash, response_status, response_body FROM sync_requests WHERE inspector_id = $1 AND idempotency_key = $2',
      [inspectorId, idempotencyKey]
    );

    if (idempotencyCheck.rows.length > 0) {
      const prev = idempotencyCheck.rows[0];
      if (prev.request_hash === requestHash) {
        await client.query('ROLLBACK');
        return res.status(prev.response_status).json(prev.response_body);
      } else {
        await client.query('ROLLBACK');
        return res.status(409).json(error('CONFLICT', 'Idempotency key reused with different payload', [], req.id));
      }
    }

    const results = [];

    for (const item of items) {
      // Validate ruleConfigVersion exists and is active (or was active)
      const ruleCheck = await client.query('SELECT 1 FROM rule_configs WHERE version = $1', [item.ruleConfigVersion]);
      if (ruleCheck.rows.length === 0) {
        results.push({
          clientInspectionId: item.clientInspectionId,
          status: 'ERROR',
          message: 'Unknown ruleConfigVersion'
        });
        continue;
      }

      if (item.operation === 'CREATE') {
        // Resolve (or create) the products row this capture belongs to.
        // Every CREATE gets a product_id now, even with zero identifying
        // data -- see productMatcher.js for the match/create strategy.
        const product = await resolveProduct(client, {
          barcodeValue: item.payload.barcodeValue,
          productName: item.payload.productName,
          brandName: item.payload.brandName,
          manufacturerName: item.payload.manufacturerName,
          declaredQuantity: item.payload.declaredQuantity
        });

        const insertRes = await client.query(`
          INSERT INTO inspections (
            client_inspection_id, inspector_id, status, product_name, brand_name,
            manufacturer_name, manufacturer_address, packer_name, packer_address,
            importer_name, importer_address, declared_quantity, mrp, mrp_raw_text, packed_date, expiry_date,
            customer_care_details, barcode_value, image_references, ocr_payload, extracted_fields,
            rule_config_version, client_created_at, client_updated_at, product_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
          )
          ON CONFLICT (client_inspection_id) DO NOTHING
          RETURNING id, server_version, updated_at
        `, [
          item.clientInspectionId, inspectorId, item.payload.status || 'DRAFT',
          item.payload.productName, item.payload.brandName, item.payload.manufacturerName,
          item.payload.manufacturerAddress, item.payload.packerName, item.payload.packerAddress,
          item.payload.importerName, item.payload.importerAddress, item.payload.declaredQuantity,
          item.payload.mrp, item.payload.mrpRawText, item.payload.packedDate, item.payload.expiryDate,
          item.payload.customerCareDetails, item.payload.barcodeValue,
          JSON.stringify(item.payload.imageReferences), JSON.stringify(item.payload.ocrPayload),
          JSON.stringify(item.payload.extractedFields), item.ruleConfigVersion,
          item.clientUpdatedAt, item.clientUpdatedAt, product.id
        ]);

        if (insertRes.rows.length > 0) {
          const row = insertRes.rows[0];
          await client.query(`
            INSERT INTO inspection_events (inspection_id, actor_id, event_type, payload)
            VALUES ($1, $2, 'SYNCED_CREATE', $3)
          `, [row.id, inspectorId, JSON.stringify(item)]);

          results.push({
            clientInspectionId: item.clientInspectionId,
            status: 'SYNCED',
            serverId: row.id,
            serverVersion: row.server_version,
            updatedAt: row.updated_at
          });
        } else {
          // It already exists, handle as conflict or fetch it
          const existing = await client.query('SELECT id, server_version, updated_at FROM inspections WHERE client_inspection_id = $1', [item.clientInspectionId]);
          results.push({
            clientInspectionId: item.clientInspectionId,
            status: 'CONFLICT',
            serverId: existing.rows[0].id,
            serverVersion: existing.rows[0].server_version,
            message: 'Inspection already exists.'
          });
        }
      } else if (item.operation === 'UPDATE' || item.operation === 'SUBMIT') {
        const existing = await client.query('SELECT * FROM inspections WHERE client_inspection_id = $1', [item.clientInspectionId]);
        
        if (existing.rows.length === 0) {
          results.push({
            clientInspectionId: item.clientInspectionId,
            status: 'ERROR',
            message: 'Inspection not found on server.'
          });
          continue;
        }

        const serverRecord = existing.rows[0];

        // Authorization check: Only the owning inspector or an ADMIN can update
        if (req.user.role === 'INSPECTOR' && serverRecord.inspector_id !== inspectorId) {
          results.push({
            clientInspectionId: item.clientInspectionId,
            status: 'ERROR',
            message: 'Access denied: You do not own this inspection.'
          });
          continue;
        }

        if (serverRecord.server_version !== item.baseServerVersion) {
          // Conflict detected
          await client.query(`
            INSERT INTO inspection_events (inspection_id, actor_id, event_type, payload)
            VALUES ($1, $2, 'CONFLICT_DETECTED', $3)
          `, [serverRecord.id, inspectorId, JSON.stringify({ clientItem: item, serverVersion: serverRecord.server_version })]);

          results.push({
            clientInspectionId: item.clientInspectionId,
            status: 'CONFLICT',
            serverId: serverRecord.id,
            serverVersion: serverRecord.server_version,
            serverRecord: serverRecord,
            message: 'The inspection was updated elsewhere.'
          });
        } else {
          // Accept update
          if (item.operation === 'SUBMIT' && serverRecord.status !== 'DRAFT') {
            results.push({
              clientInspectionId: item.clientInspectionId,
              status: 'ERROR',
              message: 'Only DRAFT inspections can be submitted.'
            });
            continue;
          }
          if (item.operation === 'UPDATE' && req.user.role === 'INSPECTOR' && serverRecord.status !== 'DRAFT' && serverRecord.status !== 'CONFLICTED') {
            results.push({
              clientInspectionId: item.clientInspectionId,
              status: 'ERROR',
              message: 'Only DRAFT or CONFLICTED inspections can be updated.'
            });
            continue;
          }
          const newStatus = item.operation === 'SUBMIT' ? 'PENDING_REVIEW' : (item.payload.status || serverRecord.status);

          // Only re-resolve the product link if this update actually touches
          // a product-identifying field -- otherwise keep the inspection
          // pointed at whatever product it was already linked to.
          const touchesProductFields = [
            item.payload.barcodeValue, item.payload.productName, item.payload.brandName,
            item.payload.manufacturerName, item.payload.declaredQuantity
          ].some((v) => v !== undefined);

          let productId = serverRecord.product_id;
          if (touchesProductFields) {
            const product = await resolveProduct(client, {
              barcodeValue: item.payload.barcodeValue !== undefined ? item.payload.barcodeValue : serverRecord.barcode_value,
              productName: item.payload.productName !== undefined ? item.payload.productName : serverRecord.product_name,
              brandName: item.payload.brandName !== undefined ? item.payload.brandName : serverRecord.brand_name,
              manufacturerName: item.payload.manufacturerName !== undefined ? item.payload.manufacturerName : serverRecord.manufacturer_name,
              declaredQuantity: item.payload.declaredQuantity !== undefined ? item.payload.declaredQuantity : serverRecord.declared_quantity
            });
            productId = product.id;
          }

          const updateRes = await client.query(`
            UPDATE inspections SET
              status = $1, product_name = $2, brand_name = $3, manufacturer_name = $4,
              manufacturer_address = $5, packer_name = $6, packer_address = $7,
              importer_name = $8, importer_address = $9, declared_quantity = $10,
              mrp = $11, mrp_raw_text = $12, packed_date = $13, expiry_date = $14, customer_care_details = $15,
              barcode_value = $16, image_references = $17, ocr_payload = $18,
              extracted_fields = $19, product_id = $20, client_updated_at = $21, server_version = server_version + 1,
              synced_at = NOW(), updated_at = NOW()
            WHERE id = $22 AND server_version = $23
            RETURNING server_version, updated_at
          `, [
            newStatus,
            item.payload.productName !== undefined ? item.payload.productName : serverRecord.product_name,
            item.payload.brandName !== undefined ? item.payload.brandName : serverRecord.brand_name,
            item.payload.manufacturerName !== undefined ? item.payload.manufacturerName : serverRecord.manufacturer_name,
            item.payload.manufacturerAddress !== undefined ? item.payload.manufacturerAddress : serverRecord.manufacturer_address,
            item.payload.packerName !== undefined ? item.payload.packerName : serverRecord.packer_name,
            item.payload.packerAddress !== undefined ? item.payload.packerAddress : serverRecord.packer_address,
            item.payload.importerName !== undefined ? item.payload.importerName : serverRecord.importer_name,
            item.payload.importerAddress !== undefined ? item.payload.importerAddress : serverRecord.importer_address,
            item.payload.declaredQuantity !== undefined ? item.payload.declaredQuantity : serverRecord.declared_quantity,
            item.payload.mrp !== undefined ? item.payload.mrp : serverRecord.mrp,
            item.payload.mrpRawText !== undefined ? item.payload.mrpRawText : serverRecord.mrp_raw_text,
            item.payload.packedDate !== undefined ? item.payload.packedDate : serverRecord.packed_date,
            item.payload.expiryDate !== undefined ? item.payload.expiryDate : serverRecord.expiry_date,
            item.payload.customerCareDetails !== undefined ? item.payload.customerCareDetails : serverRecord.customer_care_details,
            item.payload.barcodeValue !== undefined ? item.payload.barcodeValue : serverRecord.barcode_value,
            item.payload.imageReferences !== undefined ? JSON.stringify(item.payload.imageReferences) : serverRecord.image_references,
            item.payload.ocrPayload !== undefined ? JSON.stringify(item.payload.ocrPayload) : serverRecord.ocr_payload,
            item.payload.extractedFields !== undefined ? JSON.stringify(item.payload.extractedFields) : serverRecord.extracted_fields,
            productId,
            item.clientUpdatedAt,
            serverRecord.id,
            item.baseServerVersion
          ]);

          if (updateRes.rows.length > 0) {
            const row = updateRes.rows[0];
            await client.query(`
              INSERT INTO inspection_events (inspection_id, actor_id, event_type, payload)
              VALUES ($1, $2, $3, $4)
            `, [serverRecord.id, inspectorId, item.operation === 'SUBMIT' ? 'SYNCED_SUBMIT' : 'SYNCED_UPDATE', JSON.stringify(item)]);

            results.push({
              clientInspectionId: item.clientInspectionId,
              status: 'SYNCED',
              serverId: serverRecord.id,
              serverVersion: row.server_version,
              updatedAt: row.updated_at
            });
          }
        }
      }
    }

    const responseBody = success({ results });

    await client.query(`
      INSERT INTO sync_requests (inspector_id, idempotency_key, request_hash, response_status, response_body)
      VALUES ($1, $2, $3, $4, $5)
    `, [inspectorId, idempotencyKey, requestHash, 200, JSON.stringify(responseBody)]);

    await client.query('COMMIT');
    res.json(responseBody);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};