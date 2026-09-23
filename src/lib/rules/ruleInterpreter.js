import checkPresence from "./presencechecker.js";
import checkConditionalPresence from "./conditionalpresencechecker.js";
import checkFormat from "./formatChecker.js";
import checkFontSize from "./fontSizeChecker.js";
import checkPlacement from "./placementchecker.js";
import { buildDeclarations } from "../declarationsAggregator.js";

// Section 2.3 follow-on: MANUFACTURER_ADDRESS_PRESENCE (Rule 6(1)(a)) is
// written as "name and address of manufacturer/packer/importer" -- any ONE
// of those roles being declared satisfies it, per the rule's own
// description text ("Manufacturer/required responsible party name and
// address"). Now that fieldExtractor.js writes packer/importer/marketed-by
// declarations to their own fields instead of collapsing everything into
// MANUFACTURER_ADDRESS, this rule's presence check must look across all
// four role fields and pass if ANY is populated -- otherwise a label that
// legitimately only declares a packer would be wrongly flagged as missing
// a manufacturer, the same class of false-NON_COMPLIANT bug
// COMMODITY_NAME_PRESENCE had before it.
const RESPONSIBLE_PARTY_FIELDS = [
    "MANUFACTURER_ADDRESS",
    "PACKER_ADDRESS",
    "IMPORTER_ADDRESS",
    "MARKETED_BY_ADDRESS",
];

function resolveResponsiblePartyField(extractedData, field) {
    if (field !== "MANUFACTURER_ADDRESS") {
        return extractedData[field];
    }
    for (const candidate of RESPONSIBLE_PARTY_FIELDS) {
        const data = extractedData[candidate];
        if (data && data.text && data.text.trim() !== "") {
            return data;
        }
    }
    // None populated -- return the primary field so checkPresence's
    // existing "missing"/"empty" reasons still apply unchanged.
    return extractedData["MANUFACTURER_ADDRESS"];
}


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
                resolveResponsiblePartyField(extractedData, rule.field)
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