function checkFontSize(fieldData, minimumMm) {

    // Field or font size is missing
    if (!fieldData || fieldData.fontSizeMm == null) {
        return {
            passed: false,
            confidence: fieldData?.confidence || 0,
            reason: "Font size information is missing"
        };
    }

    const fontSizeMm = fieldData.fontSizeMm;

    // Font size meets the minimum requirement
    if (fontSizeMm >= minimumMm) {
        return {
            passed: true,
            confidence: fieldData.confidence || 0,
            reason: "Font size meets the minimum requirement"
        };
    }

    // Font size is below the minimum requirement
    return {
        passed: false,
        confidence: fieldData.confidence || 0,
        reason: `Font size is below the minimum required ${minimumMm} mm`
    };
}

export default checkFontSize;