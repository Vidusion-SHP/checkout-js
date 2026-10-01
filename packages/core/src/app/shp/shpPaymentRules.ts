import { type Address, type PaymentMethod } from '@bigcommerce/checkout-sdk';

import { getShpStoreConfig, type ShpEligibilityKey, type ShpMethodMatcher } from './shpStoreConfig';

// SHP: which payment methods a shopper may use, by customer group, email, address and the
// eligibility checks (useShpEligibility). Applied in Payment.tsx before upstream's own filters,
// so the default method also respects it.

export type ShpPaymentNotice = 'newcomer-card-needs-matching-addresses';

export interface ShpPaymentContext {
    storeId?: string;
    customerGroupName?: string;
    customerEmail?: string;
    billingAddress?: Address;
    shippingAddress?: Address;
    /** Gated methods this shopper passed the checks for; all others stay hidden. */
    eligible?: ShpEligibilityKey[];
}

export interface ShpPaymentRulesResult {
    methods: PaymentMethod[];
    notices: ShpPaymentNotice[];
}

const CARD_METHODS = ['credit-card', 'card'];

const uniqueId = (method: PaymentMethod): string =>
    method.gateway ? `${method.gateway}-${method.id}` : method.id;

const isCard = (method: PaymentMethod): boolean =>
    CARD_METHODS.includes(method.method) ||
    (method.config.displayName || '').toLowerCase().includes('credit card');

export const matchesMethod = (method: PaymentMethod, matcher?: ShpMethodMatcher): boolean => {
    if (!matcher) {
        return false;
    }

    const name = (method.config.displayName || '').toLowerCase();

    return (
        (!!matcher.card && isCard(method)) ||
        (matcher.ids || []).some((id) => id === method.id || id === uniqueId(method)) ||
        (matcher.nameIncludes || []).some((text) => name.includes(text))
    );
};

const normalise = (value?: string): string => (value || '').replace(/\s+/g, '').toLowerCase();

/** The fields the old script compared on the address summaries: country, street, city, postcode, region. */
export const isSameAddress = (a?: Address, b?: Address): boolean => {
    if (!a || !b) {
        return true; // nothing to compare yet (e.g. no shipping address): don't block
    }

    return (
        normalise(a.countryCode) === normalise(b.countryCode) &&
        normalise(a.address1) === normalise(b.address1) &&
        normalise(a.city) === normalise(b.city) &&
        normalise(a.postalCode) === normalise(b.postalCode) &&
        normalise(a.stateOrProvinceCode || a.stateOrProvince) ===
            normalise(b.stateOrProvinceCode || b.stateOrProvince)
    );
};

export const applyShpPaymentRules = (
    methods: PaymentMethod[],
    context: ShpPaymentContext,
): ShpPaymentRulesResult => {
    const store = getShpStoreConfig(context.storeId);

    if (!store) {
        return { methods, notices: [] };
    }

    const rules = store.payment;
    const group = context.customerGroupName || '';
    const email = (context.customerEmail || '').toLowerCase();
    const notices: ShpPaymentNotice[] = [];

    const eligible = context.eligible || [];
    const hides: ShpMethodMatcher[] = [];

    if (!eligible.includes('inspectionShipment')) {
        hides.push(rules.inspectionShipment.method);
    }

    if (rules.payInStore && !eligible.includes('payInStore')) {
        hides.push(rules.payInStore.method);
    }

    if (rules.alwaysHides) {
        hides.push(rules.alwaysHides);
    }

    if (rules.blocklistGroups.includes(group)) {
        hides.push(rules.blocklistHides);
    }

    rules.groupHides
        .filter((rule) => rule.groups.includes(group))
        .forEach((rule) => hides.push(rule.hides));

    rules.emailHides
        .filter((rule) => rule.emails.some((ruleEmail) => ruleEmail.toLowerCase() === email))
        .forEach((rule) => hides.push(rule.hides));

    if (
        rules.newcomerGroups.includes(group) &&
        !isSameAddress(context.billingAddress, context.shippingAddress)
    ) {
        hides.push(rules.newcomerHidesWhenAddressesDiffer);

        if (
            methods.some((method) => matchesMethod(method, rules.newcomerHidesWhenAddressesDiffer))
        ) {
            notices.push('newcomer-card-needs-matching-addresses');
        }
    }

    const allowed = methods.filter(
        (method) => !hides.some((matcher) => matchesMethod(method, matcher)),
    );

    // Keep the same array when nothing was removed, so memoised children don't re-render.
    return { methods: allowed.length === methods.length ? methods : allowed, notices };
};
