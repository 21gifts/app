# Fiat amounts

This rule is binding for every screen, every stored amount, and every review.
It wins over any sentence in this repository that tells a committed amount to
use the current spot rate, a later daily close, or a round trip through sats.

The supported currencies are USD, CHF, EUR, and PHP. The rule is the same for
each of them. No currency is special.

## A committed amount keeps the figures fixed when it was created

A payment, charge, gift, loan, ask, repayment, or any other amount that already
exists shows the fiat figures fixed at that moment. It never shows a figure
computed later.

If a person types an amount in one currency, that exact amount is what every
later screen shows in that currency. Typing 5.00 in a currency stores 5.00 and
shows 5.00. It is never derived again from the sats. Converting those sats
back through any rate, including the rate used at that moment and including a
stored daily close, can round 5.00 to 4.99. That rounding is forbidden for the
currency that was typed.

The other supported currencies are the amounts frozen at that same moment.
Later screens show those frozen strings. They do not recompute them.

A missing frozen string stays missing. It is not filled from the current spot,
and it is not filled later from a daily close. The amount stays bitcoin until
the frozen string exists.

## What may use the rate of now

What a holding is worth right now, such as the wallet balance, may use the
current spot. That is not a committed amount.

While a person is still typing, the field shows the digits they type. The
current spot may turn those digits into sats for the payment that is about to
be created. While bitcoin is still being typed, the fiat counter under the
field may use the current spot to show the preferred fiat. That counter is
not the stored amount. The peso, dollar, franc, or euro figure on that
amount, once it exists, is the figure they typed, not the sats converted back.

## Daily rates

`btc_usd_daily` and `usd_fiat_daily` are the market's daily closes. They are
not the amount of a payment. A payment does not read them to replace, fill, or
correct its own fiat figures.
