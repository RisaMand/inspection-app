import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { checkCompliance } from "./ruleInterpreter.js";
import evaluateVerdict from "./verdictEvaluator.js";

// Load JSON safely in ESM across Node versions
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ruleConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "Ruleconfig.json"), "utf8")
);


// =====================================================
// HELPER FUNCTION
// =====================================================

function runTest(testName, extractedData) {

    console.log("\n\n========================================");
    console.log(testName);
    console.log("========================================");

    // Step 1: Run all rules
    const ruleResults = checkCompliance(
        ruleConfig.rules,
        extractedData
    );

    // Step 2: Evaluate overall verdict
    const complianceResult = evaluateVerdict(
        ruleResults
    );

    // Step 3: Overall result
    console.log("\nVERDICT:", complianceResult.verdict);
    console.log("Total Rules:", complianceResult.totalRules);
    console.log("Passed Rules:", complianceResult.passedRules);
    console.log("Failed Rules:", complianceResult.failedRules);
    console.log("Skipped Rules:", complianceResult.skippedRules);

    // Step 4: Individual rule results
    console.log("\nRULE RESULTS:");

    ruleResults.forEach(result => {

        console.log(
            `${result.rule_id} → ` +
            `${result.passed ? "PASS" : "FAIL"} ` +
            `| Skipped: ${result.skipped} ` +
            `| Confidence: ${result.confidence}`
        );

        console.log(`Reason: ${result.reason}`);
    });

    // Step 5: Failures
    console.log("\nFAILURES:");

    if (complianceResult.failures.length === 0) {

        console.log("No failures");

    } else {

        complianceResult.failures.forEach(failure => {

            console.log(
                `${failure.rule_id} → ${failure.reason}`
            );
        });
    }
}


// =====================================================
// BASE VALID DATA
// =====================================================

const baseData = {

    MANUFACTURER_ADDRESS: {
        text: "ABC Pvt Ltd, Kolkata, India",
        confidence: 0.95
    },

    COMMODITY_NAME: {
        text: "Wheat Flour",
        confidence: 0.98
    },

    NET_QUANTITY: {
        text: "1 kg",
        confidence: 0.96
    },

    MANUFACTURE_DATE: {
        text: "08/2026",
        confidence: 0.91
    },

    MRP: {
        text: "MRP ₹120",
        confidence: 0.94
    },

    CONSUMER_CARE: {
        text: "1800-123-456",
        confidence: 0.89
    },

    COUNTRY_OF_ORIGIN: {
        text: "India",
        confidence: 0.93
    },

    isImported: true,

    DECLARATIONS: {
        text: "Manufactured by ABC Pvt Ltd.",
        fontSizeMm: 1.5,
        region: "principal_display_panel",
        confidence: 0.92
    }
};


// =====================================================
// TEST 1
// EVERYTHING VALID
// Expected: COMPLIANT
// =====================================================

const test1 = {
    ...baseData
};

runTest(
    "===== TEST 1: FULLY COMPLIANT =====",
    test1
);


// =====================================================
// TEST 2
// COSMETIC FAILURE
// Expected: COMPLIANT_WITH_WARNINGS
// =====================================================

const test2 = {

    ...baseData,

    DECLARATIONS: {
        ...baseData.DECLARATIONS,
        fontSizeMm: 0.5
    }
};

runTest(
    "===== TEST 2: COSMETIC FAILURE =====",
    test2
);


// =====================================================
// TEST 3
// SUBSTANTIVE FAILURE
// Expected: NON_COMPLIANT
// =====================================================

const test3 = {

    ...baseData,

    MRP: {
        text: "",
        confidence: 0.90
    }
};

runTest(
    "===== TEST 3: SUBSTANTIVE FAILURE =====",
    test3
);


// =====================================================
// TEST 4
// CONDITIONAL RULE SKIPPED
// Expected: COMPLIANT
// Expected skippedRules: 1
// =====================================================

const test4 = {

    ...baseData,

    isImported: false,

    COUNTRY_OF_ORIGIN: {
        text: "",
        confidence: 0
    }
};

runTest(
    "===== TEST 4: CONDITIONAL RULE SKIPPED =====",
    test4
);