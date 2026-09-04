function checkPresence(fieldData) {

    // Field does not exist
    if (!fieldData) {
        return {
            passed: false,
            confidence: 0,
            reason: "Required field is missing"
        };
    }

    // Field exists but text is empty
    if (!fieldData.text || fieldData.text.trim() === "") {
        return {
            passed: false,
            confidence: fieldData.confidence || 0,
            reason: "Required field is empty"
        };
    }

    // Field exists and contains text
    return {
        passed: true,
        confidence: fieldData.confidence,
        reason: "Required field is present"
    };
}

export default checkPresence;