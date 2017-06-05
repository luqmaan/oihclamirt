# oihclamirt

I started working on something similar to https://github.com/dzt/trimalchio. So I might as well share my progress.

### Usage

```
echo '[
  {
    "keywords": ["melange"],
    "exclude": ["HOODIE"],
    "sizes": ["*"]
  }
]' > searches.json

node index \
  --oembed=https://yeezysupply.com/collections/all.oembed \
  --slack=https://hooks.slack.com/services/BLAH
```

Logs and sends a slack notification that with a paypal checkout link and an add to cart URL.

```
SWEATSHORT MELANGE GREY
https://yeezysupply.com/products/sweatshort-melange-grey
[ 'melange' ]
XL - $200 - https://purchase.yeezysupply.com/1234/checkouts/6fdf6ffced7794fa407ea7b86ed9e59d - https://yeezysupply.com/cart/42042414099:1/
M - $200 - https://purchase.yeezysupply.com/1234/checkouts/d95e9de68b7ae704af4977decff6fdf6 - https://yeezysupply.com/cart/42042413971:1/
S - $200 - https://purchase.yeezysupply.com/1234/checkouts/a407ea7b86ed9e59d6fdf6ffced7794f - https://yeezysupply.com/cart/42042413907:1/
https://yeezysupply.com/collections/all.oembed
```

### Monitor a bunch of sites

```
while true; do ./run.sh; sleep 30; done
```
