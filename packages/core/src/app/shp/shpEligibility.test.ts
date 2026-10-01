import {
    isInspectionShipmentEligible,
    isPayInStoreEligible,
    loadCustomerAttributes,
    loadProductCategories,
    loadSrGuidance,
} from './shpEligibility';
import { getShpStoreConfig } from './shpStoreConfig';

const caConfig = getShpStoreConfig('900954');

if (!caConfig?.payment.payInStore) {
    throw new Error('The .ca store settings (with Pay in Store) are missing');
}

const ca = caConfig.payment;
const payInStore = caConfig.payment.payInStore;
const inspection = {
    ...ca.inspectionShipment,
    customMakeCategoryIds: [1],
    restrictedCategoryIds: [2],
    hairpieceCategoryIds: [3],
};

describe('isInspectionShipmentEligible', () => {
    const lines = [
        { productId: 10, quantity: 2 },
        { productId: 11, quantity: 1 },
    ];

    it('allows a flagged customer within their hairpiece maximum', () => {
        expect(
            isInspectionShipmentEligible(
                {
                    eligibleFlag: '1',
                    maxHairpieces: '3',
                    lines,
                    products: [
                        { id: 10, categories: [3] },
                        { id: 11, categories: [3, 99] },
                    ],
                },
                inspection,
            ),
        ).toBe(true);
    });

    it('counts every hairpiece unit, across lines, against the maximum', () => {
        expect(
            isInspectionShipmentEligible(
                {
                    eligibleFlag: '1',
                    maxHairpieces: '2',
                    lines,
                    products: [
                        { id: 10, categories: [3] },
                        { id: 11, categories: [3] },
                    ],
                },
                inspection,
            ),
        ).toBe(false);
    });

    it('ignores products that are in none of the lists', () => {
        expect(
            isInspectionShipmentEligible(
                {
                    eligibleFlag: '1',
                    maxHairpieces: '0',
                    lines,
                    products: [{ id: 10, categories: [99] }],
                },
                inspection,
            ),
        ).toBe(true);
    });

    it.each([
        ['a custom-make item', [1]],
        ['a supply item', [2]],
        ['a custom-make hairpiece', [1, 3]],
    ])('rules out an order with %s', (_, categories) => {
        expect(
            isInspectionShipmentEligible(
                {
                    eligibleFlag: '1',
                    maxHairpieces: '9',
                    lines,
                    products: [{ id: 10, categories }],
                },
                inspection,
            ),
        ).toBe(false);
    });

    it.each([
        ['the flag is not 1', { eligibleFlag: '0' }],
        ['the flag is missing', { eligibleFlag: undefined }],
        ['the cart has no physical items', { lines: [] }],
        ['no product categories came back', { products: [] }],
    ])('refuses when %s', (_, overrides) => {
        expect(
            isInspectionShipmentEligible(
                {
                    eligibleFlag: '1',
                    maxHairpieces: '9',
                    lines,
                    products: [{ id: 10, categories: [3] }],
                    ...overrides,
                },
                inspection,
            ),
        ).toBe(false);
    });

    it('treats a missing or unreadable maximum as zero hairpieces', () => {
        const order = { eligibleFlag: '1', lines, products: [{ id: 10, categories: [3] }] };

        expect(
            isInspectionShipmentEligible({ ...order, maxHairpieces: undefined }, inspection),
        ).toBe(false);
        expect(isInspectionShipmentEligible({ ...order, maxHairpieces: 'n/a' }, inspection)).toBe(
            false,
        );
    });
});

describe('isPayInStoreEligible', () => {
    const pickup = 'Pickup (In Store - 3220 Dufferin St, Toronto)';

    it('allows an A or B client picking up at one of the stores', () => {
        expect(
            isPayInStoreEligible(
                {
                    shippingOptionDescriptions: [pickup],
                    srGuidance: 'B - Good',
                    customerGroupName: 'Tier 1',
                },
                payInStore,
            ),
        ).toBe(true);
    });

    it.each([
        [
            'shipping instead of a store pickup',
            { shippingOptionDescriptions: ['Regular Shipping'] },
        ],
        ['an SR Guidance of C', { srGuidance: 'C' }],
        ['no TeamDesk record', { srGuidance: undefined }],
        ['a Newcomer', { customerGroupName: 'Newcomer' }],
    ])('refuses %s', (_, overrides) => {
        expect(
            isPayInStoreEligible(
                {
                    shippingOptionDescriptions: [pickup],
                    srGuidance: 'A',
                    customerGroupName: 'Tier 1',
                    ...overrides,
                },
                payInStore,
            ),
        ).toBe(false);
    });
});

describe('loaders', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    const respond = (body: unknown, ok = true) =>
        fetchMock.mockResolvedValueOnce({ ok, json: () => Promise.resolve(body) });

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('reads customer attributes through Storefront GraphQL with the token', async () => {
        respond({ data: { customer: { attributes: { a4: { value: '1' }, a5: { value: '3' } } } } });

        await expect(loadCustomerAttributes('TOKEN', [4, 5])).resolves.toEqual({ 4: '1', 5: '3' });

        const [url, init] = fetchMock.mock.calls[0];

        expect(url).toBe('/graphql');
        expect(init.headers.Authorization).toBe('Bearer TOKEN');
        expect(JSON.parse(init.body).query).toContain('a4: attribute(entityId: 4)');
    });

    it('returns nothing for a guest (no customer) or without a token', async () => {
        respond({ data: { customer: null } });

        await expect(loadCustomerAttributes('TOKEN', [4])).resolves.toBeUndefined();
        await expect(loadCustomerAttributes('', [4])).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reads product categories from the SHP server', async () => {
        respond({ data: [{ id: 10, categories: [3] }] });

        await expect(
            loadProductCategories('https://shp.example', '900954', [10, 11]),
        ).resolves.toEqual([{ id: 10, categories: [3] }]);
        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://shp.example/bigcommerce/products?store_id=900954&id:in=10,11&include_fields=categories',
        );
    });

    it('reads SR Guidance from TeamDesk, encoding the email', async () => {
        respond([{ 'SR Guidance': 'A' }]);

        await expect(loadSrGuidance('https://shp.example', 'a&b@x.com')).resolves.toBe('A');
        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://shp.example/teamdesk/clients?filter=%5BEmail%5D%3D%22a%26b%40x.com%22&column=*&column=SR%20Guidance',
        );
    });

    it('resolves to undefined when the server fails or is unreachable', async () => {
        respond({}, false);
        fetchMock.mockRejectedValueOnce(new Error('offline'));

        await expect(loadSrGuidance('https://shp.example', 'a@x.com')).resolves.toBeUndefined();
        await expect(
            loadProductCategories('https://shp.example', '1', [1]),
        ).resolves.toBeUndefined();
    });
});
