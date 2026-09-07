function checkFormat(fieldData, formatType) {

    // Check whether field exists
    if (!fieldData || !fieldData.text) {
        return {
            passed: false,
            confidence: fieldData?.confidence || 0,
            reason: "Required field is missing or empty"
        };
    }

    const text = fieldData.text.trim();

    if (formatType === "MRP") {

        /*
         * MRP format:
         *
         * Optional MRP label:
         * MRP
         * M.R.P
         * M.R.P.
         *
         * Optional separator:
         * :
         * .
         *
         * Currency:
         * Rs
         * Rs.
         * ₹
         *
         * Numeric value:
         * 120
         * 1,299
         * 12,500.50
         */
        const mrpPattern =
            /(?:MRP|M\.R\.P\.?)?\s*[:.]?\s*(?:Rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?\b/i;

        if (mrpPattern.test(text)) {
            return {
                passed: true,
                confidence: fieldData.confidence || 0,
                reason: "MRP format is valid"
            };
        }

        return {
            passed: false,
            confidence: fieldData.confidence || 0,
            reason: "MRP format is invalid"
        };
    }

    return {
        passed: false,
        confidence: fieldData.confidence || 0,
        reason: "Unsupported format type"
    };
}

module.exports = checkFormat;