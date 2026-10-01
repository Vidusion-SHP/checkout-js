import { renderHook, waitFor } from '@testing-library/react';

import { useCheckout } from '@bigcommerce/checkout/contexts';

import { loadCustomerAttributes, loadProductCategories, loadSrGuidance } from './shpEligibility';
import { useShpEligibility } from './useShpEligibility';

jest.mock('@bigcommerce/checkout/contexts');

jest.mock('./shpEligibility', () => ({
    ...jest.requireActual('./shpEligibility'),
    loadCustomerAttributes: jest.fn(),
    loadProductCategories: jest.fn(),
    loadSrGuidance: jest.fn(),
}));

jest.mock('./shpPageData', () => ({
    getShpPageData: () => ({ serverBaseUrl: 'https://shp.example', storefrontToken: 'TOKEN' }),
}));

const CA_HAIRPIECE_CATEGORY = 33527; // first id in the .ca hairpiece list
const CA_SUPPLY_CATEGORY = 33589; // first id in the .ca supply list

interface Shopper {
    storeId?: string;
    isGuest?: boolean;
    email?: string;
    group?: string;
    lines?: Array<{ productId: number; quantity: number }>;
    shipping?: string;
}

const useShopper = ({
    storeId = '900954',
    isGuest = false,
    email = 'client@example.com',
    group = 'Tier 1',
    lines = [{ productId: 10, quantity: 1 }],
    shipping = 'Regular Shipping',
}: Shopper = {}) => {
    const data = {
        getConfig: () => ({ storeProfile: { storeId } }),
        getCustomer: () => ({ isGuest, email, customerGroup: { id: 1, name: group } }),
        getCart: () => ({ lineItems: { physicalItems: lines } }),
        getConsignments: () => [{ selectedShippingOption: { description: shipping } }],
    };

    (useCheckout as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) => ({
        selectedState: selector({ data }),
    }));
};

describe('useShpEligibility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (loadCustomerAttributes as jest.Mock).mockResolvedValue({ 4: '1', 5: '2' });
        (loadProductCategories as jest.Mock).mockResolvedValue([
            { id: 10, categories: [CA_HAIRPIECE_CATEGORY] },
        ]);
        (loadSrGuidance as jest.Mock).mockResolvedValue('C');
    });

    it('unlocks Inspection Shipment for a flagged customer within their hairpiece maximum', async () => {
        useShopper();

        const { result } = renderHook(() => useShpEligibility());

        await waitFor(() => expect(result.current).toEqual(['inspectionShipment']));
        expect(loadCustomerAttributes).toHaveBeenCalledWith('TOKEN', [4, 5]);
        expect(loadProductCategories).toHaveBeenCalledWith('https://shp.example', '900954', [10]);
    });

    it('does not look up categories when the customer is not flagged', async () => {
        (loadCustomerAttributes as jest.Mock).mockResolvedValue({ 4: '0', 5: '9' });
        useShopper();

        const { result } = renderHook(() => useShpEligibility());

        await waitFor(() => expect(loadCustomerAttributes).toHaveBeenCalled());
        expect(loadProductCategories).not.toHaveBeenCalled();
        expect(result.current).toEqual([]);
    });

    it('keeps Inspection Shipment hidden for an order with a supply item', async () => {
        (loadProductCategories as jest.Mock).mockResolvedValue([
            { id: 10, categories: [CA_SUPPLY_CATEGORY] },
        ]);
        useShopper();

        const { result } = renderHook(() => useShpEligibility());

        await waitFor(() => expect(loadProductCategories).toHaveBeenCalled());
        expect(result.current).toEqual([]);
    });

    it('unlocks Pay in Store for an A client picking up at a .ca store', async () => {
        (loadCustomerAttributes as jest.Mock).mockResolvedValue({ 4: '0' });
        (loadSrGuidance as jest.Mock).mockResolvedValue('A');
        useShopper({ shipping: 'Pickup (In Store - 7295 Rapistan Ct)' });

        const { result } = renderHook(() => useShpEligibility());

        await waitFor(() => expect(result.current).toEqual(['payInStore']));
        expect(loadSrGuidance).toHaveBeenCalledWith('https://shp.example', 'client@example.com');
    });

    it('looks nothing up for a guest', async () => {
        useShopper({ isGuest: true, email: '' });

        const { result } = renderHook(() => useShpEligibility());

        await waitFor(() => expect(result.current).toEqual([]));
        expect(loadCustomerAttributes).not.toHaveBeenCalled();
        expect(loadSrGuidance).not.toHaveBeenCalled();
    });

    it('does not check Pay in Store on .com, which has no such method', async () => {
        useShopper({ storeId: '742053', shipping: 'Pickup (In Store - 7295 Rapistan Ct)' });

        renderHook(() => useShpEligibility());

        await waitFor(() => expect(loadCustomerAttributes).toHaveBeenCalled());
        expect(loadSrGuidance).not.toHaveBeenCalled();
    });

    it('does nothing for another store', async () => {
        useShopper({ storeId: '1' });

        const { result } = renderHook(() => useShpEligibility());

        expect(result.current).toEqual([]);
        expect(loadCustomerAttributes).not.toHaveBeenCalled();
        expect(loadSrGuidance).not.toHaveBeenCalled();
    });
});
