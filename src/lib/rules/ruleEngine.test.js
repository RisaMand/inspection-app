import { describe, test, expect } from "vitest";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { checkCompliance } from "./ruleInterpreter.js";
import evaluateVerdict from "./verdictEvaluator.js";
import  checkFormat from "./formatChecker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ruleConfig = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "Ruleconfig.json"),
        "utf8"
    )
);

const RULE_COUNT = ruleConfig.rules.length;
const TEST_RULE_COUNT = RULE_COUNT;

const EXPECTED_ACTIVE_RULES = 10;
const EXPECTED_SKIPPED_RULES = 3;


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
// HELPER
// =====================================================

function runCompliance(extractedData) {
    const ruleResults = checkCompliance(
        ruleConfig.rules,
        extractedData
    );

    return evaluateVerdict(ruleResults);
}


// =====================================================
// TEST 1
// EVERYTHING VALID
// =====================================================

describe("Rule Engine - Compliance", () => {

    test("returns COMPLIANT for fully compliant data", () => {

        const result = runCompliance({
            ...baseData
        });

        expect(result.verdict).toBe("COMPLIANT");

        expect(result.totalRules).toBe(TEST_RULE_COUNT);

        expect(result.passedRules).toBe(
            EXPECTED_ACTIVE_RULES
        );

        expect(result.failedRules).toBe(0);

        expect(result.skippedRules).toBe(
            EXPECTED_SKIPPED_RULES
        );

        expect(result.failures).toHaveLength(0);
    });


    // =====================================================
    // TEST 2
    // COSMETIC FAILURE
    // =====================================================

    test(
        "returns COMPLIANT_WITH_WARNINGS for cosmetic failure",
        () => {

            const result = runCompliance({
                ...baseData,

                DECLARATIONS: {
                    ...baseData.DECLARATIONS,
                    fontSizeMm: 0.5
                }
            });

            expect(result.verdict).toBe(
                "COMPLIANT_WITH_WARNINGS"
            );

            expect(result.totalRules).toBe(
                TEST_RULE_COUNT
            );

            expect(result.passedRules).toBe(9);

            expect(result.failedRules).toBe(1);

            expect(result.skippedRules).toBe(3);

            expect(result.failures).toHaveLength(1);

            expect(result.failures[0].rule_id).toBe(
                "DECLARATION_FONT_SIZE"
            );
        }
    );


    // =====================================================
    // TEST 3
    // SUBSTANTIVE FAILURE
    // =====================================================

    test(
        "returns NON_COMPLIANT when MRP is missing",
        () => {

            const result = runCompliance({
                ...baseData,

                MRP: {
                    text: "",
                    confidence: 0.90
                }
            });

            expect(result.verdict).toBe(
                "NON_COMPLIANT"
            );

            expect(result.totalRules).toBe(
                TEST_RULE_COUNT
            );

            expect(result.passedRules).toBe(8);

            expect(result.failedRules).toBe(2);

            expect(result.skippedRules).toBe(3);

            expect(result.failures).toHaveLength(2);

            const failedRuleIds =
                result.failures.map(
                    failure => failure.rule_id
                );

            expect(failedRuleIds).toContain(
                "MRP_PRESENCE"
            );

            expect(failedRuleIds).toContain(
                "MRP_FORMAT"
            );
        }
    );


    // =====================================================
    // TEST 4
    // CONDITIONAL RULE SKIPPED
    // =====================================================

    test(
        "skips country-of-origin rule for domestic products",
        () => {

            const result = runCompliance({
                ...baseData,

                isImported: false,

                COUNTRY_OF_ORIGIN: {
                    text: "",
                    confidence: 0
                }
            });

            expect(result.verdict).toBe(
                "COMPLIANT"
            );

            expect(result.totalRules).toBe(
                TEST_RULE_COUNT
            );

            expect(result.passedRules).toBe(9);

            expect(result.failedRules).toBe(0);

            expect(result.skippedRules).toBe(4);

            expect(result.failures).toHaveLength(0);
        }
    );

    // =====================================================
// TEST 5
// MRP FORMAT REGRESSION TESTS
// =====================================================

test("accepts real-world MRP declaration with inclusive tax wording", () => {
    const result = checkFormat(
        {
            text: "MRP Rs 120 incl. of all taxes",
            confidence: 0.95
        },
        "MRP"
    );

    expect(result.passed).toBe(true);
    expect(result.reason).toBe("MRP format is valid");
});

test("accepts dotted MRP abbreviation and comma-formatted amount", () => {
    const result = checkFormat(
        {
            text: "M.R.P. ₹1,200",
            confidence: 0.95
        },
        "MRP"
    );

    expect(result.passed).toBe(true);
    expect(result.reason).toBe("MRP format is valid");
});

test("accepts colon after MRP label", () => {
    const result = checkFormat(
        {
            text: "MRP: Rs 120",
            confidence: 0.95
        },
        "MRP"
    );

    expect(result.passed).toBe(true);
    expect(result.reason).toBe("MRP format is valid");
    }
);

    // =====================================================
// PHASE 5
// CONFIDENCE BANDING
// =====================================================

test("marks result for review when confidence is below 80%", () => {
    const result = runCompliance({
        ...baseData,

        MRP: {
            text: "MRP ₹120",
            confidence: 0.79
        }
    });

    expect(result.needsReview).toBe(true);
});


test("does not mark result for review at exactly 80% confidence", () => {
    const result = runCompliance({
        ...baseData,

        MRP: {
            text: "MRP ₹120",
            confidence: 0.80
        }
    });

    expect(result.needsReview).toBe(false);
});


test("does not mark result for review above 80% confidence", () => {
    const result = runCompliance({
        ...baseData,

        MRP: {
            text: "MRP ₹120",
            confidence: 0.95
        }
    });

    expect(result.needsReview).toBe(false);
    }
);

        // =====================================================
    // TEST 5
    // UNIT SALE PRICE CONDITIONAL RULE
    // =====================================================

    test(
        "checks unit sale price when applicable",
        () => {

            const result = runCompliance({
                ...baseData,

                unit_sale_price_applicable: true,

                UNIT_SALE_PRICE: {
                    text: "₹120 per kg",
                    confidence: 0.90
                }
            });

            expect(result.verdict).toBe("COMPLIANT");

            expect(result.failedRules).toBe(0);

            const unitSalePriceRule =
                result.failures.find(
                    failure =>
                        failure.rule_id ===
                        "UNIT_SALE_PRICE_PRESENCE"
                );

            expect(unitSalePriceRule).toBeUndefined();
        }
    );


    // =====================================================
    // TEST 6
    // STANDARD QUANTITY CONDITIONAL RULE
    // =====================================================

    test(
        "checks standard quantity when applicable",
        () => {

            const result = runCompliance({
                ...baseData,

                standard_pack_applicable: true,

                STANDARD_QUANTITY: {
                    text: "1 kg",
                    confidence: 0.90
                }
            });

            expect(result.verdict).toBe("COMPLIANT");

            expect(result.failedRules).toBe(0);

            const standardQuantityRule =
                result.failures.find(
                    failure =>
                        failure.rule_id ===
                        "STANDARD_QUANTITY_SPECIFICATION"
                );

            expect(standardQuantityRule).toBeUndefined();
        }
    );


    // =====================================================
    // TEST 7
    // BATCH NUMBER CONDITIONAL RULE
    // =====================================================

    test(
        "checks batch number when applicable",
        () => {

            const result = runCompliance({
                ...baseData,

                batch_applicable: true,

                BATCH_NUMBER: {
                    text: "BATCH-12345",
                    confidence: 0.90
                }
            });

            expect(result.verdict).toBe("COMPLIANT");

            expect(result.failedRules).toBe(0);

            const batchRule =
                result.failures.find(
                    failure =>
                        failure.rule_id ===
                        "BATCH_NUMBER_PRESENCE"
                );

            expect(batchRule).toBeUndefined();
        }
    );

        // =====================================================
    // TEST 8
    // UNIT SALE PRICE CONDITIONAL FAILURE
    // =====================================================

    test(
        "fails unit sale price when applicable but missing",
        () => {

            const result = runCompliance({
                ...baseData,

                unit_sale_price_applicable: true,

                UNIT_SALE_PRICE: {
                    text: "",
                    confidence: 0.90
                }
            });

            expect(result.verdict).toBe("NON_COMPLIANT");

            expect(result.failedRules).toBe(1);

            expect(result.failures).toHaveLength(1);

            expect(result.failures[0].rule_id).toBe(
                "UNIT_SALE_PRICE_PRESENCE"
            );
        }
    );


    // =====================================================
    // TEST 9
    // STANDARD QUANTITY CONDITIONAL FAILURE
    // =====================================================

    test(
        "fails standard quantity when applicable but missing",
        () => {

            const result = runCompliance({
                ...baseData,

                standard_pack_applicable: true,

                STANDARD_QUANTITY: {
                    text: "",
                    confidence: 0.90
                }
            });

            expect(result.verdict).toBe("NON_COMPLIANT");

            expect(result.failedRules).toBe(1);

            expect(result.failures).toHaveLength(1);

            expect(result.failures[0].rule_id).toBe(
                "STANDARD_QUANTITY_SPECIFICATION"
            );
        }
    );


    // =====================================================
    // TEST 10
    // BATCH NUMBER CONDITIONAL FAILURE
    // =====================================================

    test(
        "fails batch number when applicable but missing",
        () => {

            const result = runCompliance({
                ...baseData,

                batch_applicable: true,

                BATCH_NUMBER: {
                    text: "",
                    confidence: 0.90
                }
            });

            expect(result.verdict).toBe("NON_COMPLIANT");

            expect(result.failedRules).toBe(1);

            expect(result.failures).toHaveLength(1);

            expect(result.failures[0].rule_id).toBe(
                "BATCH_NUMBER_PRESENCE"
            );
        }
    );

    test("ignores a rule that is not effective yet", () => {
    const futureRule = {
        ...ruleConfig.rules[0],
        rule_id: "FUTURE_TEST_RULE",
        effective_from: "2099-01-01"
    };

    const results = checkCompliance(
        [...ruleConfig.rules, futureRule],
        baseData
    );

    expect(
        results.some(result => result.rule_id === "FUTURE_TEST_RULE")
    ).toBe(false);
});

    test("ignores a rule that has already expired", () => {
    const expiredRule = {
        ...ruleConfig.rules[0],
        rule_id: "EXPIRED_TEST_RULE",
        effective_to: "2000-01-01"
    };

    const results = checkCompliance(
        [...ruleConfig.rules, expiredRule],
        baseData
    );

    expect(
        results.some(result => result.rule_id === "EXPIRED_TEST_RULE")
    ).toBe(false);
});

    test("fails when manufacturer address is missing", () => {
    const result = runCompliance({
        ...baseData,

        MANUFACTURER_ADDRESS: {
            text: "",
            confidence: 0.90
        }
    });

    expect(result.verdict).toBe("NON_COMPLIANT");
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].rule_id).toBe(
        "MANUFACTURER_ADDRESS_PRESENCE"
    );
});

});