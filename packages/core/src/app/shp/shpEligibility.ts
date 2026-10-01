import { type ShpInspectionShipmentConfig, type ShpPayInStoreConfig } from './shpStoreConfig';

// SHP: checks that unlock Inspection Shipment and Pay in Store. The decisions are pure functions;
// the loaders fetch what they need and resolve to undefined on any failure, which keeps the
// method hidden (the old script also hid them unless every check passed).

export interface ShpCartLine {
    productId: number;
    quantity: number;
}

export interface ShpProductCategories {
    id: number;
    categories: number[];
}

/**
 * Same rules as the old script: the customer's flag attribute must be '1'; any custom-make or
 * supply item rules the order out; hairpiece units must not exceed the customer's maximum.
 * Products in none of the lists don't matter.
 */
export const isInspectionShipmentEligible = (
    {
        eligibleFlag,
        maxHairpieces,
        lines,
        products,
    }: {
        eligibleFlag?: string;
        maxHairpieces?: string;
        lines: ShpCartLine[];
        products: ShpProductCategories[];
    },
    config: ShpInspectionShipmentConfig,
): boolean => {
    if (eligibleFlag !== '1' || !lines.length || !products.length) {
        return false;
    }

    const isIn = (product: ShpProductCategories, categoryIds: number[]) =>
        categoryIds.some((id) => product.categories.includes(id));

    let hairpieceUnits = 0;

    for (const product of products) {
        if (
            isIn(product, config.customMakeCategoryIds) ||
            isIn(product, config.restrictedCategoryIds)
        ) {
            return false;
        }

        if (isIn(product, config.hairpieceCategoryIds)) {
            hairpieceUnits += lines
                .filter((line) => line.productId === product.id)
                .reduce((sum, line) => sum + line.quantity, 0);
        }
    }

    const max = Number(maxHairpieces);

    return hairpieceUnits <= (Number.isFinite(max) ? max : 0);
};

/** Pickup at one of the listed stores, a trusted client per TeamDesk, and not a newcomer. */
export const isPayInStoreEligible = (
    {
        shippingOptionDescriptions,
        srGuidance,
        customerGroupName,
    }: {
        shippingOptionDescriptions: string[];
        srGuidance?: string;
        customerGroupName?: string;
    },
    config: ShpPayInStoreConfig,
): boolean =>
    config.pickupAddresses.some((address) =>
        shippingOptionDescriptions.some((description) => description.includes(address)),
    ) &&
    config.srGuidancePrefixes.some((prefix) => (srGuidance || '').startsWith(prefix)) &&
    !config.excludedGroups.includes(customerGroupName || '');

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T | undefined> => {
    try {
        const response = await fetch(url, init);

        return response.ok ? ((await response.json()) as T) : undefined;
    } catch {
        return undefined;
    }
};

/** Signed-in customer's attribute values by ID, via the Storefront GraphQL API. */
export const loadCustomerAttributes = async (
    storefrontToken: string,
    attributeIds: number[],
): Promise<Record<number, string | undefined> | undefined> => {
    if (!storefrontToken || !attributeIds.length) {
        return undefined;
    }

    const fields = attributeIds
        .map((id) => `a${id}: attribute(entityId: ${id}) { value }`)
        .join(' ');

    const json = await fetchJson<{
        data?: { customer?: { attributes?: Record<string, { value?: string } | null> } | null };
    }>('/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storefrontToken}`,
        },
        body: JSON.stringify({ query: `query { customer { attributes { ${fields} } } }` }),
    });

    const attributes = json?.data?.customer?.attributes;

    if (!attributes) {
        return undefined;
    }

    return Object.fromEntries(
        attributeIds.map((id) => [id, attributes[`a${id}`]?.value ?? undefined]),
    );
};

/** Category IDs of each product, from the SHP server (which sees hidden categories too). */
export const loadProductCategories = async (
    serverBaseUrl: string,
    storeId: string,
    productIds: number[],
): Promise<ShpProductCategories[] | undefined> => {
    if (!serverBaseUrl || !productIds.length) {
        return undefined;
    }

    const query = `store_id=${encodeURIComponent(storeId)}&id:in=${productIds.join(',')}&include_fields=categories`;
    const json = await fetchJson<{ data?: ShpProductCategories[] }>(
        `${serverBaseUrl}/bigcommerce/products?${query}`,
        { headers: { Accept: 'application/json' } },
    );

    return json?.data;
};

/** The client's "SR Guidance" (A, B, ...) from TeamDesk, by email. */
export const loadSrGuidance = async (
    serverBaseUrl: string,
    email: string,
): Promise<string | undefined> => {
    if (!serverBaseUrl || !email) {
        return undefined;
    }

    const filter = encodeURIComponent(`[Email]="${email.replace(/"/g, '')}"`);
    const json = await fetchJson<Array<Record<string, string | undefined>>>(
        `${serverBaseUrl}/teamdesk/clients?filter=${filter}&column=*&column=${encodeURIComponent('SR Guidance')}`,
    );

    return json?.[0]?.['SR Guidance'];
};
