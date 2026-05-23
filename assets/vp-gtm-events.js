(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];

  function getCurrency() {
    return (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'COP';
  }

  // add_to_cart — fires when the product form successfully adds an item
  subscribe(PUB_SUB_EVENTS.cartUpdate, function (event) {
    if (event.source !== 'product-form') return;

    var item = event.cartData;
    if (!item || !item.title) return;

    var variantId = String(item.variant_id);
    var variant = (window.vpVariants && window.vpVariants[variantId]) || {};

    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: {
        currency: getCurrency(),
        value: item.price / 100,
        items: [{
          item_id: item.sku || variantId,
          item_name: item.product_title || item.title,
          item_brand: item.vendor || variant.product_vendor || '',
          item_category: item.product_type || variant.product_type || '',
          item_variant: item.variant_title || variant.title || '',
          price: item.price / 100,
          quantity: item.quantity
        }]
      }
    });
  });

  // begin_checkout — fires on any checkout button click
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[name="checkout"], .cart__checkout-button, a[href="/checkout"]')) return;
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: 'begin_checkout' });
  });

  // view_cart — fires when the cart drawer is opened
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[aria-controls="CartDrawer"], .cart-count-bubble')) return;
    setTimeout(function () {
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({ event: 'view_cart' });
    }, 300);
  });

})();
