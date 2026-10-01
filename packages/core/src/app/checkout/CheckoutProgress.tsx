import classNames from 'classnames';
import React, { type ReactElement } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';

import type CheckoutStepStatus from './CheckoutStepStatus';
import CheckoutStepType from './CheckoutStepType';

// SHP multi-step checkout: the step bar shown above the active step.
// Labels reuse the step headings, so they follow the store's language.
const STEP_HEADING_IDS: Record<CheckoutStepType, string> = {
    [CheckoutStepType.Customer]: 'customer.customer_heading',
    [CheckoutStepType.Shipping]: 'shipping.shipping_heading',
    [CheckoutStepType.Billing]: 'billing.billing_heading',
    [CheckoutStepType.Payment]: 'payment.payment_heading',
};

export interface CheckoutProgressProps {
    activeStepType: CheckoutStepType;
    steps: CheckoutStepStatus[];
    onEdit(type: CheckoutStepType): void;
}

export const CheckoutProgress = ({
    activeStepType,
    steps,
    onEdit,
}: CheckoutProgressProps): ReactElement => {
    const currentIndex = steps.findIndex((step) => step.type === activeStepType);

    return (
        <nav aria-label="Checkout progress" className="shp-progress" data-test="checkout-progress">
            <ol className="shp-progress-list">
                {steps.map((step, index) => {
                    const isCurrent = index === currentIndex;
                    // Steps after the open one read as upcoming, even if BigCommerce already
                    // considers them complete (e.g. a saved billing address).
                    const isDone = step.isComplete && index < currentIndex;
                    const label = <TranslatedString id={STEP_HEADING_IDS[step.type]} />;

                    return (
                        <li
                            className={classNames('shp-progress-step', {
                                'is-current': isCurrent,
                                'is-complete': isDone,
                            })}
                            key={step.type}
                        >
                            <span aria-hidden="true" className="shp-progress-number">
                                {index + 1}
                            </span>
                            {isDone && step.isEditable ? (
                                <button
                                    className="shp-progress-label shp-progress-label--link"
                                    data-test={`checkout-progress-${step.type}`}
                                    onClick={() => onEdit(step.type)}
                                    type="button"
                                >
                                    {label}
                                </button>
                            ) : (
                                <span
                                    aria-current={isCurrent ? 'step' : undefined}
                                    className="shp-progress-label"
                                    data-test={`checkout-progress-${step.type}`}
                                >
                                    {label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};
