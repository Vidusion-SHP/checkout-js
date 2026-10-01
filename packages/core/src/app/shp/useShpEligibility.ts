import { useEffect, useMemo, useState } from 'react';

import { useCheckout } from '@bigcommerce/checkout/contexts';

import {
    isInspectionShipmentEligible,
    isPayInStoreEligible,
    loadCustomerAttributes,
    loadProductCategories,
    loadSrGuidance,
    type ShpCartLine,
    type ShpProductCategories,
} from './shpEligibility';
import { getShpPageData } from './shpPageData';
import { getShpStoreConfig, type ShpEligibilityKey } from './shpStoreConfig';

// SHP: loads what the eligibility checks need and returns which gated payment methods this shopper
// may see. PaymentStep calls it and passes the result to Payment, whose rules hide the rest.
// Only signed-in customers can qualify, as before (the old script read the signed-in email).

const parseLines = (key: string): ShpCartLine[] =>
    key
        ? key.split(',').map((pair) => {
              const [productId, quantity] = pair.split(':').map(Number);

              return { productId, quantity };
          })
        : [];

export const useShpEligibility = (): ShpEligibilityKey[] => {
    const {
        selectedState: { storeId, isGuest, email, groupName, linesKey, shippingKey },
    } = useCheckout(({ data }) => {
        const customer = data.getCustomer();

        return {
            storeId: data.getConfig()?.storeProfile.storeId,
            isGuest: customer?.isGuest ?? true,
            email: customer?.email || '',
            groupName: customer?.customerGroup?.name || '',
            // Strings, so effects only re-run when the cart or the chosen shipping really changes
            linesKey: (data.getCart()?.lineItems.physicalItems || [])
                .map(({ productId, quantity }) => `${productId}:${quantity}`)
                .join(','),
            shippingKey: (data.getConsignments() || [])
                .map((consignment) => consignment.selectedShippingOption?.description || '')
                .join('\n'),
        };
    });

    const store = getShpStoreConfig(storeId);
    const inspection = store?.payment.inspectionShipment;
    const payInStore = store?.payment.payInStore;

    const lines = useMemo(() => parseLines(linesKey), [linesKey]);
    const productIdsKey = useMemo(
        () => [...new Set(lines.map((line) => line.productId))].sort().join(','),
        [lines],
    );

    const [attributes, setAttributes] = useState<Record<number, string | undefined>>();
    const [products, setProducts] = useState<ShpProductCategories[]>();
    const [srGuidance, setSrGuidance] = useState<string>();

    const eligibleFlag = inspection ? attributes?.[inspection.eligibleAttributeId] : undefined;

    // Inspection Shipment, step 1: the customer's flag and hairpiece maximum
    useEffect(() => {
        setAttributes(undefined);

        if (!inspection || isGuest) {
            return;
        }

        let isActive = true;

        void loadCustomerAttributes(getShpPageData().storefrontToken, [
            inspection.eligibleAttributeId,
            inspection.maxHairpiecesAttributeId,
        ]).then((result) => isActive && setAttributes(result));

        return () => {
            isActive = false;
        };
    }, [inspection, isGuest, email]);

    // Inspection Shipment, step 2: the cart's product categories, only for flagged customers
    useEffect(() => {
        setProducts(undefined);

        if (!inspection || !storeId || !productIdsKey || eligibleFlag !== '1') {
            return;
        }

        let isActive = true;

        void loadProductCategories(
            getShpPageData().serverBaseUrl,
            storeId,
            productIdsKey.split(',').map(Number),
        ).then((result) => isActive && setProducts(result));

        return () => {
            isActive = false;
        };
    }, [inspection, storeId, productIdsKey, eligibleFlag]);

    // Pay in Store: the client's TeamDesk "SR Guidance"
    useEffect(() => {
        setSrGuidance(undefined);

        if (!payInStore || isGuest || !email) {
            return;
        }

        let isActive = true;

        void loadSrGuidance(getShpPageData().serverBaseUrl, email).then(
            (result) => isActive && setSrGuidance(result),
        );

        return () => {
            isActive = false;
        };
    }, [payInStore, isGuest, email]);

    return useMemo(() => {
        const eligible: ShpEligibilityKey[] = [];

        if (
            inspection &&
            attributes &&
            products &&
            isInspectionShipmentEligible(
                {
                    eligibleFlag,
                    maxHairpieces: attributes[inspection.maxHairpiecesAttributeId],
                    lines,
                    products,
                },
                inspection,
            )
        ) {
            eligible.push('inspectionShipment');
        }

        if (
            payInStore &&
            isPayInStoreEligible(
                {
                    shippingOptionDescriptions: shippingKey ? shippingKey.split('\n') : [],
                    srGuidance,
                    customerGroupName: groupName,
                },
                payInStore,
            )
        ) {
            eligible.push('payInStore');
        }

        return eligible;
    }, [
        inspection,
        attributes,
        products,
        eligibleFlag,
        lines,
        payInStore,
        shippingKey,
        srGuidance,
        groupName,
    ]);
};
