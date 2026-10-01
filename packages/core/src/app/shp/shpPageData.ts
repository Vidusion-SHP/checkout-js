// SHP: values the theme's templates/pages/checkout.html puts on the page around this app.
// Both the .ca and .com themes render them; keep them there while this checkout uses them.
//   <body data-server-base-url="{{theme_settings.server_base_url}}">  (SHP server: TeamDesk, products)
//   <input name="store-token" value="{{settings.storefront_api.token}}">  (Storefront GraphQL)

export interface ShpPageData {
    serverBaseUrl: string;
    storefrontToken: string;
}

export const getShpPageData = (): ShpPageData => {
    if (typeof document === 'undefined') {
        return { serverBaseUrl: '', storefrontToken: '' };
    }

    const tokenInput = document.querySelector<HTMLInputElement>('input[name="store-token"]');

    return {
        serverBaseUrl: (document.body?.dataset.serverBaseUrl || '').replace(/\/+$/, ''),
        storefrontToken: tokenInput?.value || '',
    };
};
