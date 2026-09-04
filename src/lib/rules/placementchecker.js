function checkPlacement(fieldData, expectedRegion) {

    // Validate input
    if (!fieldData || !fieldData.region) {

        return {
            passed: false,
            confidence: fieldData?.confidence || 0,
            reason: "Placement information is missing"
        };
    }

    const actualRegion = fieldData.region;

    // Check whether actual region matches required region
    if (actualRegion === expectedRegion) {

        return {
            passed: true,
            confidence: fieldData.confidence || 0,
            reason: "Declaration is placed in the required region"
        };
    }

    // Region does not match
    return {
        passed: false,
        confidence: fieldData.confidence || 0,
        reason: `Declaration is placed in '${actualRegion}' instead of '${expectedRegion}'`
    };
}

export default checkPlacement;