// SHP: per-store settings for the Super Hairpieces custom checkout. One build serves both stores;
// everything that differs between superhairpieces.ca and superhairpieces.com lives here, keyed by
// BigCommerce store ID (config.storeProfile.storeId). Values come from each theme's old
// assets/js/checkout.js, which this checkout replaces.

import {
    CA_INSPECTION_CATEGORIES,
    COM_INSPECTION_CATEGORIES,
    type ShpInspectionCategories,
} from './shpCategoryLists';

/** Which payment methods a rule applies to. A method matches if any listed condition matches. */
export interface ShpMethodMatcher {
    /** Card payments (Authorize.net, Stripe card and other credit-card methods). */
    card?: boolean;
    /** Method IDs as checkout-js renders them (the old `#radio-<id>` selectors), e.g. 'applepay'. */
    ids?: string[];
    /** Lower-case text the method's display name contains, e.g. 'payplan'. */
    nameIncludes?: string[];
}

/** Methods that stay hidden until the shopper passes a check that needs data loaded at runtime. */
export type ShpEligibilityKey = 'inspectionShipment' | 'payInStore';

export interface ShpInspectionShipmentConfig extends ShpInspectionCategories {
    method: ShpMethodMatcher;
    /** Customer attribute whose value '1' allows the method. */
    eligibleAttributeId: number;
    /** Customer attribute holding the most hairpiece units allowed in one order. */
    maxHairpiecesAttributeId: number;
}

export interface ShpPayInStoreConfig {
    method: ShpMethodMatcher;
    /** The selected shipping option's description must mention one of these stores. */
    pickupAddresses: string[];
    /** The customer's TeamDesk "SR Guidance" must start with one of these. */
    srGuidancePrefixes: string[];
    excludedGroups: string[];
}

export interface ShpPaymentRulesConfig {
    /** Customer groups that may not pay by card or wallet. */
    blocklistGroups: string[];
    blocklistHides: ShpMethodMatcher;
    /** Customer groups that may only pay by card when billing and shipping addresses match. */
    newcomerGroups: string[];
    newcomerHidesWhenAddressesDiffer: ShpMethodMatcher;
    /** Other per-group rules, e.g. no money order for wholesale tiers. */
    groupHides: Array<{ groups: string[]; hides: ShpMethodMatcher }>;
    /** Per-customer rules, by email (compared case-insensitively). */
    emailHides: Array<{ emails: string[]; hides: ShpMethodMatcher }>;
    /** Methods this store never offers in checkout. */
    alwaysHides?: ShpMethodMatcher;
    /** Offered only to eligible customers; hidden until the check passes, as before. */
    inspectionShipment: ShpInspectionShipmentConfig;
    /** Offered only for an in-store pickup by a trusted customer; hidden until the check passes. */
    payInStore?: ShpPayInStoreConfig;
}

export interface ShpStoreConfig {
    key: 'ca' | 'com';
    payment: ShpPaymentRulesConfig;
}

const WALLETS_AND_PAYPAL = [
    'applepay',
    'googlepayauthorizenet',
    'paypalcommercecredit',
    'paypalcommerce',
];

const INSPECTION_SHIPMENT = {
    method: { nameIncludes: ['inspection shipment'] },
    eligibleAttributeId: 4,
    maxHairpiecesAttributeId: 5,
};

const CA: ShpStoreConfig = {
    key: 'ca',
    payment: {
        blocklistGroups: ['Blocklist'],
        blocklistHides: {
            card: true,
            ids: [...WALLETS_AND_PAYPAL, 'moneyorder'],
            nameIncludes: ['payplan'],
        },
        newcomerGroups: ['Newcomer'],
        newcomerHidesWhenAddressesDiffer: { card: true },
        groupHides: [
            {
                groups: [
                    'Tier 1',
                    'Extensions Wholesale',
                    'Tier 1 No Signature',
                    'Megan',
                    'Tier 2',
                ],
                hides: { ids: ['moneyorder'] },
            },
        ],
        emailHides: [
            {
                emails: ['kkrahime@hotmail.com'],
                hides: { card: true, ids: WALLETS_AND_PAYPAL, nameIncludes: ['payplan'] },
            },
        ],
        inspectionShipment: { ...INSPECTION_SHIPMENT, ...CA_INSPECTION_CATEGORIES },
        payInStore: {
            method: { nameIncludes: ['pay in store'] },
            pickupAddresses: ['7295 Rapistan', '3075 Ridgeway', '3220 Dufferin', '1282 Eglinton'],
            srGuidancePrefixes: ['A', 'B'],
            excludedGroups: ['Newcomer'],
        },
    },
};

const COM: ShpStoreConfig = {
    key: 'com',
    payment: {
        blocklistGroups: ['Blocklist'],
        blocklistHides: {
            card: true,
            ids: [...WALLETS_AND_PAYPAL, 'paypalcommercevenmo', 'amazonpay'],
        },
        newcomerGroups: ['Newcomer', 'OutsideUS-Newcomer'],
        newcomerHidesWhenAddressesDiffer: { card: true, ids: ['applepay'] },
        groupHides: [],
        emailHides: [],
        // "Pay in Store" (Square) is not offered on .com
        alwaysHides: { nameIncludes: ['square'] },
        inspectionShipment: { ...INSPECTION_SHIPMENT, ...COM_INSPECTION_CATEGORIES },
    },
};

const STORES: Record<string, ShpStoreConfig> = {
    '900954': CA, // superhairpieces.ca
    '742053': COM, // superhairpieces.com
    '999745060': COM, // sandbox: a copy of .com (runs the .com theme), so the .com rules
};

/** Settings for this store, or undefined for any other store (then the checkout behaves as upstream). */
export const getShpStoreConfig = (storeId?: string): ShpStoreConfig | undefined =>
    storeId ? STORES[storeId] : undefined;
