import { type Address, type PaymentMethod } from '@bigcommerce/checkout-sdk';

import { applyShpPaymentRules, isSameAddress } from './shpPaymentRules';

const CA = '900954';
const COM = '742053';
const SANDBOX = '999745060';

const method = (
    id: string,
    displayName: string,
    extra: Partial<PaymentMethod> = {},
): PaymentMethod =>
    ({
        id,
        method: id,
        type: 'PAYMENT_TYPE_API',
        supportedCards: [],
        config: { displayName },
        ...extra,
    }) as PaymentMethod;

const card = method('authorizenet', 'Credit Card', { method: 'credit-card' });
const stripeCard = method('card', 'Card', { gateway: 'stripeupe', method: 'card' });
const applePay = method('applepay', 'Apple Pay');
const googlePay = method('googlepayauthorizenet', 'Google Pay');
const paypal = method('paypalcommerce', 'PayPal');
const payLater = method('paypalcommercecredit', 'Pay Later');
const venmo = method('paypalcommercevenmo', 'Venmo');
const amazonPay = method('amazonpay', 'Amazon Pay');
const moneyOrder = method('moneyorder', 'Money Order', { method: 'offline' });
const payPlan = method('cod', 'PayPlan', { method: 'offline' });
const inspection = method('bankdeposit', 'Inspection Shipment', { method: 'offline' });
const payInStore = method('instore', 'Pay in Store', { method: 'offline' });
const square = method('squarev2', 'Square', { method: 'offline' });

const ids = (methods: PaymentMethod[]): string[] => methods.map(({ id }) => id);

const address = (overrides: Partial<Address> = {}): Address =>
    ({
        countryCode: 'CA',
        address1: '7295 Rapistan Ct',
        city: 'Mississauga',
        postalCode: 'L5N 5Z4',
        stateOrProvinceCode: 'ON',
        ...overrides,
    }) as Address;

describe('applyShpPaymentRules', () => {
    const caMethods = [
        card,
        applePay,
        googlePay,
        paypal,
        payLater,
        moneyOrder,
        payPlan,
        inspection,
        payInStore,
    ];
    const comMethods = [
        card,
        stripeCard,
        applePay,
        googlePay,
        paypal,
        payLater,
        venmo,
        amazonPay,
        moneyOrder,
        payPlan,
        inspection,
        square,
    ];

    it('leaves other stores untouched, returning the same array', () => {
        const result = applyShpPaymentRules(caMethods, {
            storeId: '1',
            customerGroupName: 'Blocklist',
        });

        expect(result.methods).toBe(caMethods);
        expect(result.notices).toEqual([]);
    });

    it('returns the same array when no rule removes anything', () => {
        const methods = [card, paypal];

        expect(applyShpPaymentRules(methods, { storeId: CA }).methods).toBe(methods);
    });

    describe('superhairpieces.ca', () => {
        it('offers everything except methods still waiting for an eligibility check', () => {
            expect(ids(applyShpPaymentRules(caMethods, { storeId: CA }).methods)).toEqual(
                ids([card, applePay, googlePay, paypal, payLater, moneyOrder, payPlan]),
            );
        });

        it('hides card, wallets, PayPal, money order and PayPlan for the Blocklist group', () => {
            const { methods } = applyShpPaymentRules(caMethods, {
                storeId: CA,
                customerGroupName: 'Blocklist',
            });

            expect(ids(methods)).toEqual([]);
        });

        it('hides money order for wholesale tiers', () => {
            const { methods } = applyShpPaymentRules(caMethods, {
                storeId: CA,
                customerGroupName: 'Tier 1 No Signature',
            });

            expect(ids(methods)).not.toContain('moneyorder');
            expect(ids(methods)).toContain('authorizenet');
        });

        it('hides card, wallets, PayPal and PayPlan for the listed email, whatever its case', () => {
            const { methods } = applyShpPaymentRules(caMethods, {
                storeId: CA,
                customerEmail: 'KKrahime@Hotmail.com',
            });

            expect(ids(methods)).toEqual(['moneyorder']);
        });

        it('hides card for a Newcomer whose addresses differ, with a notice', () => {
            const result = applyShpPaymentRules(caMethods, {
                storeId: CA,
                customerGroupName: 'Newcomer',
                billingAddress: address(),
                shippingAddress: address({ address1: '3220 Dufferin St' }),
            });

            expect(ids(result.methods)).not.toContain('authorizenet');
            expect(ids(result.methods)).toContain('applepay'); // .ca only blocks the card
            expect(result.notices).toEqual(['newcomer-card-needs-matching-addresses']);
        });

        it('keeps card for a Newcomer whose addresses match, ignoring case and spaces', () => {
            const result = applyShpPaymentRules(caMethods, {
                storeId: CA,
                customerGroupName: 'Newcomer',
                billingAddress: address(),
                shippingAddress: address({ postalCode: 'l5n5z4', address1: '7295 RAPISTAN CT' }),
            });

            expect(ids(result.methods)).toContain('authorizenet');
            expect(result.notices).toEqual([]);
        });

        it('does not show the notice when the store offers no card method', () => {
            const result = applyShpPaymentRules([paypal, moneyOrder], {
                storeId: CA,
                customerGroupName: 'Newcomer',
                billingAddress: address(),
                shippingAddress: address({ city: 'Toronto' }),
            });

            expect(result.notices).toEqual([]);
        });
    });

    describe('superhairpieces.com', () => {
        it('applies the .com rules on the sandbox store, which is a copy of .com', () => {
            const { methods } = applyShpPaymentRules(comMethods, {
                storeId: SANDBOX,
                customerGroupName: 'Tier 2',
            });

            expect(ids(methods)).toContain('moneyorder'); // no wholesale money-order rule on .com
            expect(ids(methods)).not.toContain('squarev2'); // Square never offered on .com
        });

        it('never offers Square, and waits on Inspection Shipment', () => {
            const { methods } = applyShpPaymentRules(comMethods, { storeId: COM });

            expect(ids(methods)).not.toContain('squarev2');
            expect(ids(methods)).not.toContain('bankdeposit');
            expect(ids(methods)).toContain('moneyorder');
        });

        it('hides card (Authorize.net and Stripe), wallets, PayPal, Venmo and Amazon Pay for Blocklist, but keeps offline methods', () => {
            const { methods } = applyShpPaymentRules(comMethods, {
                storeId: COM,
                customerGroupName: 'Blocklist',
            });

            expect(ids(methods)).toEqual(['moneyorder', 'cod']);
        });

        it('does not apply the .ca wholesale money-order rule', () => {
            const { methods } = applyShpPaymentRules(comMethods, {
                storeId: COM,
                customerGroupName: 'Tier 1',
            });

            expect(ids(methods)).toContain('moneyorder');
        });

        it('hides card and Apple Pay for OutsideUS-Newcomer when addresses differ', () => {
            const result = applyShpPaymentRules(comMethods, {
                storeId: COM,
                customerGroupName: 'OutsideUS-Newcomer',
                billingAddress: address({ countryCode: 'GB' }),
                shippingAddress: address({ countryCode: 'US' }),
            });

            expect(ids(result.methods)).not.toContain('authorizenet');
            expect(ids(result.methods)).not.toContain('card');
            expect(ids(result.methods)).not.toContain('applepay');
            expect(ids(result.methods)).toContain('paypalcommerce');
            expect(result.notices).toEqual(['newcomer-card-needs-matching-addresses']);
        });
    });

    describe('eligibility-gated methods', () => {
        it('shows Inspection Shipment once the shopper passes its check', () => {
            const { methods } = applyShpPaymentRules(caMethods, {
                storeId: CA,
                eligible: ['inspectionShipment'],
            });

            expect(ids(methods)).toContain('bankdeposit');
            expect(ids(methods)).not.toContain('instore');
        });

        it('shows Pay in Store on .ca once the shopper passes its check', () => {
            const { methods } = applyShpPaymentRules(caMethods, {
                storeId: CA,
                eligible: ['payInStore'],
            });

            expect(ids(methods)).toContain('instore');
            expect(ids(methods)).not.toContain('bankdeposit');
        });

        it('still applies group rules to an eligible shopper', () => {
            const { methods } = applyShpPaymentRules(comMethods, {
                storeId: COM,
                customerGroupName: 'Blocklist',
                eligible: ['inspectionShipment', 'payInStore'],
            });

            // Inspection Shipment unlocked; Square stays hidden on .com whatever the check says
            expect(ids(methods)).toEqual(['moneyorder', 'cod', 'bankdeposit']);
        });
    });
});

describe('isSameAddress', () => {
    it('does not block when either address is missing', () => {
        expect(isSameAddress(address(), undefined)).toBe(true);
        expect(isSameAddress(undefined, address())).toBe(true);
    });

    it('falls back to the region name when there is no region code', () => {
        expect(
            isSameAddress(
                address({ stateOrProvinceCode: '', stateOrProvince: 'Ontario' }),
                address({ stateOrProvinceCode: '', stateOrProvince: 'ontario' }),
            ),
        ).toBe(true);
    });
});
