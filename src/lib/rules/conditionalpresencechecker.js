function checkConditionalPresence(fieldData, conditionApplies) {

    // Rule does not apply
    if (!conditionApplies) {

        return {
            passed: true,
            confidence: 1,
            skipped: true,
            reason: "Condition does not apply"
        };
    }

    // Rule applies, but field does not exist
    if (!fieldData) {

        return {
            passed: false,
            confidence: 0,
            reason: "Required field is missing for the applicable condition"
        };
    }

    // Rule applies, but field is empty
    if (!fieldData.text || fieldData.text.trim() === "") {

        return {
            passed: false,
            confidence: fieldData.confidence || 0,
            reason: "Required field is empty for the applicable condition"
        };
    }

    // Rule applies and field contains text
    return {
        passed: true,
        confidence: fieldData.confidence,
        reason: "Required field is present and condition applies"
    };
}

export default checkConditionalPresence;