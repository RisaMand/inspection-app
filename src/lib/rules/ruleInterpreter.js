import checkPresence from "./presencechecker.js";
import checkConditionalPresence from "./conditionalpresencechecker.js";
import checkFormat from "./formatChecker.js";
import checkFontSize from "./fontSizeChecker.js";
import checkPlacement from "./placementchecker.js";
import { buildDeclarations } from "../declarationsAggregator.js";


function checkCompliance(rules, extractedData) {

    const results = [];

    // DECLARATIONS is an aggregate, not an OCR field: build it from the
    // resolved fields when the caller did not supply one, so the font-size
    // and placement rules read the minimum-confidence / unanimous-region
    // aggregate instead of undefined. A caller-supplied entry always wins.
    const source = extractedData || {};

    const data = source.DECLARATIONS === undefined
        ? { ...source, DECLARATIONS: buildDeclarations(source) }
        : source;


    const now = new Date();

    // Phase 6: Effective-dating
    const activeRules = rules.filter(rule => {

        if (
            rule.effective_from &&
            new Date(rule.effective_from) > now
        ) {
            return false;
        }

        if (
            rule.effective_to &&
            new Date(rule.effective_to) < now
        ) {
            return false;
        }

        return true;
    });


    for (const rule of activeRules) {

        const result = runCheck(rule, data);

        // Phase 5: Confidence Banding (Threshold 80%)
        const needsReview =
            result.confidence !== null &&
            result.confidence < 0.80;


        results.push({
            rule_id: rule.rule_id,

            description: rule.description,

            passed: result.passed,

            confidence: result.confidence,

            needsReview: needsReview,

            reason: result.reason,

            skipped: result.skipped || false,

            severity: rule.severity,

            clause_citation: rule.clause_citation
        });
    }


    return results;
}


function runCheck(rule, extractedData) {

    switch (rule.check_type) {

        case "presence":

            return checkPresence(
                extractedData[rule.field]
            );


        case "conditional_presence": {

            let conditionApplies = false;


            if (rule.condition === "imported_product") {

                conditionApplies = Boolean(
                    extractedData.isImported
                );

            }


            else if (rule.condition === "unit_sale_price_applicable") {

                conditionApplies = Boolean(
                    extractedData.unit_sale_price_applicable ??
                    extractedData.requiresUnitSalePrice ??
                    extractedData.isUnitSalePriceApplicable
                );

            }


            else if (rule.condition === "standard_pack_applicable") {

                conditionApplies = Boolean(
                    extractedData.standard_pack_applicable ??
                    extractedData.isStandardSizeApplicable ??
                    extractedData.requiresStandardSize
                );

            }


            else if (rule.condition === "batch_applicable") {

                conditionApplies = Boolean(
                    extractedData.batch_applicable ??
                    extractedData.isBatchApplicable ??
                    extractedData.requiresBatchNumber
                );

            }


            else if (
                rule.condition &&
                extractedData[rule.condition] !== undefined
            ) {

                conditionApplies = Boolean(
                    extractedData[rule.condition]
                );

            }


            return checkConditionalPresence(
                extractedData[rule.field],
                conditionApplies
            );
        }


        case "format":

            return checkFormat(
                extractedData[rule.field],
                rule.format_type
            );


        case "font_size":

            return checkFontSize(
                extractedData[rule.field],
                rule.minimum_mm
            );


        case "placement":

            return checkPlacement(
                extractedData[rule.field],
                rule.expected_region
            );


        default:

            return {
                passed: false,
                confidence: 0,
                reason: "Unsupported check type",
                skipped: false,
                error: "Unsupported check type"
            };
    }
}


export { checkCompliance };