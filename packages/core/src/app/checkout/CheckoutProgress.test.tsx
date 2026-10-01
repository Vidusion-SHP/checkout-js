import userEvent from '@testing-library/user-event';
import React from 'react';

import { render, screen } from '@bigcommerce/checkout/test-utils';

import { CheckoutProgress } from './CheckoutProgress';
import type CheckoutStepStatus from './CheckoutStepStatus';
import CheckoutStepType from './CheckoutStepType';

const step = (
    type: CheckoutStepType,
    overrides: Partial<CheckoutStepStatus> = {},
): CheckoutStepStatus => ({
    isActive: false,
    isBusy: false,
    isComplete: false,
    isEditable: false,
    isRequired: true,
    type,
    ...overrides,
});

describe('CheckoutProgress', () => {
    const steps = [
        step(CheckoutStepType.Customer, { isComplete: true, isEditable: true }),
        step(CheckoutStepType.Shipping, { isComplete: true, isEditable: false }),
        step(CheckoutStepType.Payment),
    ];

    it('lists every step it is given, in order, with its heading', () => {
        render(
            <CheckoutProgress
                activeStepType={CheckoutStepType.Payment}
                onEdit={jest.fn()}
                steps={steps}
            />,
        );

        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            '1Customer',
            '2Shipping',
            '3Payment',
        ]);
    });

    it('marks the active step as the current one', () => {
        render(
            <CheckoutProgress
                activeStepType={CheckoutStepType.Payment}
                onEdit={jest.fn()}
                steps={steps}
            />,
        );

        expect(screen.getByTestId('checkout-progress-payment')).toHaveAttribute(
            'aria-current',
            'step',
        );
        expect(screen.getByTestId('checkout-progress-customer')).not.toHaveAttribute(
            'aria-current',
        );
    });

    it('lets the shopper go back to a finished, editable step', async () => {
        const handleEdit = jest.fn();

        render(
            <CheckoutProgress
                activeStepType={CheckoutStepType.Payment}
                onEdit={handleEdit}
                steps={steps}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Customer' }));

        expect(handleEdit).toHaveBeenCalledWith(CheckoutStepType.Customer);
    });

    it('does not offer a link for steps that cannot be edited or are not finished', () => {
        render(
            <CheckoutProgress
                activeStepType={CheckoutStepType.Payment}
                onEdit={jest.fn()}
                steps={steps}
            />,
        );

        // getByRole throws if there is more than one: Customer is the only link
        expect(screen.getByRole('button')).toHaveTextContent('Customer');
        expect(screen.queryByRole('button', { name: 'Shipping' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Payment' })).not.toBeInTheDocument();
    });

    it('does not show the active step as finished, even when it is complete', () => {
        render(
            <CheckoutProgress
                activeStepType={CheckoutStepType.Customer}
                onEdit={jest.fn()}
                steps={steps}
            />,
        );

        const [customer] = screen.getAllByRole('listitem');

        expect(customer).toHaveClass('is-current');
        expect(customer).not.toHaveClass('is-complete');
        expect(screen.queryByRole('button', { name: 'Customer' })).not.toBeInTheDocument();
    });

    it('shows steps after the open one as upcoming, even if they are already complete', () => {
        // e.g. on Shipping with a saved billing address, which BigCommerce counts as complete
        render(
            <CheckoutProgress
                activeStepType={CheckoutStepType.Shipping}
                onEdit={jest.fn()}
                steps={[
                    step(CheckoutStepType.Customer, { isComplete: true, isEditable: true }),
                    step(CheckoutStepType.Shipping, { isComplete: true, isEditable: true }),
                    step(CheckoutStepType.Billing, { isComplete: true, isEditable: true }),
                    step(CheckoutStepType.Payment),
                ]}
            />,
        );

        const [, , billing] = screen.getAllByRole('listitem');

        expect(billing).not.toHaveClass('is-complete');
        expect(billing).not.toHaveClass('is-current');
        expect(screen.queryByRole('button', { name: 'Billing' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Customer' })).toBeInTheDocument();
    });
});
