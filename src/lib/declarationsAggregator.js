/**
 * Builds one aggregate DECLARATIONS object
 * from the resolved rule-engine fields.
 *
 * Aggregation policy:
 * - fontSizeMm  -> minimum across available declaration fields
 * - confidence  -> minimum across available declaration fields
 * - region      -> only reported when ALL applicable fields
 *                  have the same region
 * - text        -> combined text of the applicable declarations
 *
 * IMPORTANT:
 * This does NOT convert header/body/footer into
 * principal_display_panel.
 */

const DECLARATION_FIELDS = [
    "MANUFACTURER_ADDRESS",
    "COMMODITY_NAME",
    "NET_QUANTITY",
    "MANUFACTURE_DATE",
    "MRP",
    "CONSUMER_CARE",
    "COUNTRY_OF_ORIGIN",
    "UNIT_SALE_PRICE",
    "STANDARD_QUANTITY",
    "BATCH_NUMBER"
];

function buildDeclarations(extractedData) {
    if (!extractedData || typeof extractedData !== "object") {
        return null;
    }

    const fields = DECLARATION_FIELDS
        .map((fieldName) => extractedData[fieldName])
        .filter(Boolean);

    if (fields.length === 0) {
        return null;
    }

    // -----------------------------------------
    // TEXT
    // -----------------------------------------

    const text = fields
        .map((field) => field.text)
        .filter(
            (value) =>
                typeof value === "string" &&
                value.trim().length > 0
        )
        .join(" | ");

    // -----------------------------------------
    // FONT SIZE
    // Minimum = strictest value
    // -----------------------------------------

    const fontSizes = fields
        .map((field) => field.fontSizeMm)
        .filter(
            (value) =>
                typeof value === "number" &&
                Number.isFinite(value)
        );

    const fontSizeMm =
        fontSizes.length > 0
            ? Math.min(...fontSizes)
            : null;

    // -----------------------------------------
    // CONFIDENCE
    // Minimum = weakest field confidence
    // -----------------------------------------

    const confidences = fields
        .map((field) => field.confidence)
        .filter(
            (value) =>
                typeof value === "number" &&
                Number.isFinite(value)
        );

    const confidence =
        confidences.length > 0
            ? Math.min(...confidences)
            : null;

    // -----------------------------------------
    // REGION
    //
    // Only return a region when every applicable
    // field has a region AND all regions are same.
    //
    // We do NOT claim that body/header/footer
    // means principal_display_panel.
    // -----------------------------------------

    const regions = fields
        .map((field) => field.region)
        .filter(
            (value) =>
                typeof value === "string" &&
                value.trim().length > 0
        );

    let region = null;

    if (regions.length === fields.length) {
        const firstRegion = regions[0];

        const allSameRegion = regions.every(
            (currentRegion) => currentRegion === firstRegion
        );

        if (allSameRegion) {
            region = firstRegion;
        }
    }

    return {
        text: text || null,
        fontSizeMm,
        region,
        confidence
    };
}

export { buildDeclarations };