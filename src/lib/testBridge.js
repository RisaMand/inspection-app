import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapFieldsToRules } from './mapFieldsToRules.js';
import { checkCompliance } from './rules/ruleInterpreter.js';
import evaluateVerdict from './rules/verdictEvaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load rules configuration
const ruleConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'rules/Ruleconfig.json'), 'utf8')
);

// Filter out font_size & placement for R1 scope
const r1ActiveRules = ruleConfig.rules.filter(
  (r) => r.check_type !== 'font_size' && r.check_type !== 'placement'
);

// Realistic OCR output matching synonym patterns and LM format rules
const sampleOcrText = `
Besan, Edible Oil, Sugar
Net Weight: 250 g
Date of Manufacture: 24/05/2026
MRP Rs 120 incl. of all taxes
Manufactured by: MG Road Foods Pvt Ltd
Customer Care: 9727955514
Made in India
`;

console.log('--- Testing Field Mapping ---');
const extractedData = mapFieldsToRules(sampleOcrText, 86, true);

// COMMODITY_NAME synonyms array is empty [] for R1 best-effort scope;
// supply a mock hit here to simulate the commodity extraction
extractedData.COMMODITY_NAME = { text: 'Besan', confidence: 0.86 };

console.log('Extracted Data:\n', extractedData);

console.log('\n--- Testing Compliance Evaluation ---');
const ruleResults = checkCompliance(r1ActiveRules, extractedData);
const complianceResult = evaluateVerdict(ruleResults);

console.log('\nVerdict:', complianceResult.verdict);
console.log('Passed Rules:', complianceResult.passedRules);
console.log('Failed Rules:', complianceResult.failedRules);
console.log('Skipped Rules:', complianceResult.skippedRules);

if (complianceResult.failures.length > 0) {
  console.log('\nFailures:', complianceResult.failures);
} else {
  console.log('\nNo failures.');
}