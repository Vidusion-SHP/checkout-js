// SHP: Super Hairpieces additions to checkout-js. Kept in this folder, with small hooks in upstream
// files, so upstream updates merge cleanly.
export {
    applyShpPaymentRules,
    type ShpPaymentContext,
    type ShpPaymentNotice,
    type ShpPaymentRulesResult,
} from './shpPaymentRules';
export { ShpPaymentNotices, type ShpPaymentNoticesProps } from './ShpPaymentNotices';
export { getShpStoreConfig, type ShpEligibilityKey, type ShpStoreConfig } from './shpStoreConfig';
export { useShpEligibility } from './useShpEligibility';
