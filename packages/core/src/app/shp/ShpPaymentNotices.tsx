import React, { type ReactElement } from 'react';

import { Alert, AlertType } from '@bigcommerce/checkout/ui';

import { type ShpPaymentNotice } from './shpPaymentRules';

// SHP: explains why a payment method is missing. Copy matches the old theme script.

export interface ShpPaymentNoticesProps {
    notices?: ShpPaymentNotice[];
}

export const ShpPaymentNotices = ({ notices }: ShpPaymentNoticesProps): ReactElement | null => {
    if (!notices?.includes('newcomer-card-needs-matching-addresses')) {
        return null;
    }

    return (
        <Alert testId="shp-notice-newcomer-card" type={AlertType.Info}>
            <p>
                We apologize for the inconvenience, but your credit card can only be used if your
                shipping and billing addresses are the same.
            </p>
            <p>
                This policy is in place to reduce the likelihood of credit card fraud and avoid
                cards being used without the authorization of the card holder. If you would like to
                use a credit card for this order, please ensure that the shipping and billing
                addresses match. If you need the orders shipped to a location other than your
                billing address, please choose another method of payment.
            </p>
            <p>
                <a href="/need-assistance/" rel="noopener noreferrer" target="_blank">
                    Contact us
                </a>{' '}
                for more details if you have any problems.
            </p>
        </Alert>
    );
};
