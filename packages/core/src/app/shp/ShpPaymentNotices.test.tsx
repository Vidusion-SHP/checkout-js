import React from 'react';

import { render, screen } from '@bigcommerce/checkout/test-utils';

import { ShpPaymentNotices } from './ShpPaymentNotices';

describe('ShpPaymentNotices', () => {
    it('renders nothing without notices', () => {
        const { container } = render(<ShpPaymentNotices notices={[]} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('explains the card rule and links to support', () => {
        render(<ShpPaymentNotices notices={['newcomer-card-needs-matching-addresses']} />);

        expect(screen.getByTestId('shp-notice-newcomer-card')).toHaveTextContent(
            'your credit card can only be used if your shipping and billing addresses are the same',
        );
        expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute(
            'href',
            '/need-assistance/',
        );
    });
});
