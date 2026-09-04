function checkFormat(fieldData, formatType) {

    // Step 1: Validate input
    if (!fieldData || !fieldData.text) {
        return {
            passed: false,
            confidence: fieldData?.confidence || 0,
            reason: "Required field is missing or empty"
        };
    }

    // Step 2: Clean OCR text
    const text = fieldData.text.trim();

    // Step 3: Check MRP format
    if (formatType === "MRP") {

        const mrpPattern = /^(MRP\s*)?(Rs\.?|₹)\s*\d+(\.\d{1,2})?$/i;

        const passed = mrpPattern.test(text);

        if (passed) {
            return {
                passed: true,
                confidence: fieldData.confidence || 0,
                reason: "MRP format is valid"
            };
        }

        return {
            passed: false,
            confidence: fieldData.confidence || 0,
            reason: "MRP does not match the required format"
        };
    }

    // Step 4: Unsupported format
    return {
        passed: false,
        confidence: fieldData.confidence || 0,
        reason: "Unsupported format type",
        error: "Unsupported format type"
    };
}

export default checkFormat;