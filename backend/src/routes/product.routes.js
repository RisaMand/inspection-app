const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { productIdParamsSchema } = require('../validators/product.validator');

router.use(authenticate);

router.get('/lookup', asyncHandler(productController.lookupProduct));
router.get('/:id/history', validate(productIdParamsSchema), asyncHandler(productController.getProductHistory));

module.exports = router;