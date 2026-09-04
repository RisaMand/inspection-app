function evaluateVerdict(results) {

    let passedRules = 0;
    let failedRules = 0;
    let skippedRules = 0;

    const failures = [];

    for (const result of results) {

        // Rule was not applicable
        if (result.skipped) {

            skippedRules++;

            continue;
        }

        // Rule was actually checked and passed
        if (result.passed) {

            passedRules++;

        } else {

            // Rule was actually checked and failed
            failedRules++;

            failures.push({
                rule_id: result.rule_id,
                reason: result.reason,
                severity: result.severity,
                clause_citation: result.clause_citation,
                confidence: result.confidence
            });
        }
    }

    const hasSubstantiveFailure = failures.some(
        failure => failure.severity === "substantive"
    );

    const hasCosmeticFailure = failures.some(
        failure => failure.severity === "cosmetic"
    );

    let verdict;

    if (hasSubstantiveFailure) {

        verdict = "NON_COMPLIANT";

    } else if (hasCosmeticFailure) {

        verdict = "COMPLIANT_WITH_WARNINGS";

    } else {

        verdict = "COMPLIANT";
    }

    return {
        verdict: verdict,
        totalRules: results.length,
        passedRules: passedRules,
        failedRules: failedRules,
        skippedRules: skippedRules,
        failures: failures
    };
}

export default evaluateVerdict;