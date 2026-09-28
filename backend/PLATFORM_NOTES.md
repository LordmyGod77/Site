# Platform wiring notes

## Zillow
Current Zillow Rentals feed integration is an approved feed program. Multifamily / feed partners can submit an XML/MITS feed after Zillow approval/testing. Treat this as a separate feed integration, not a browser-posting hack.

## Craigslist
Craigslist has a Bulk Posting API, but access is case-by-case for high-volume posters and is restricted to paid U.S. categories; apartment rentals are listed as eligible for NYC. For Texas apartment locating, keep the current assisted/manual workflow unless Craigslist grants your account an eligible integration.

## Snapchat
Snap Creative Kit supports website/app sharing into Snapchat's camera/preview experience. It is a user handoff, which fits the existing assisted publishing model. A later mobile wrapper can make this smoother.

## TikTok
Keep the working Content Posting API workflow already in Ad Maker. Point captions/links back to the floorplan-aware schedule URL.


## Approval-support property discovery
There is no reliable universal public API containing every property that accepts every guarantor/deposit product. Use `PropertySupport` as a verified registry. Record `SourceURL` and `VerifiedAt`.

Practical verification:
- OneApp: use its participating-community finder / property referral flow.
- TheGuarantors: use its renter address search; buildings appearing in its search are participating.
- Jetty and Rhino: confirm current participation with the property/manager or provider network.
- Liberty Rent, Leap, Insurent and Cosign: verify through the provider/property and record the source/date.

Do not advertise a property as guaranteed approval. Record only that a program was verified as available; the renter still has to qualify under that program/property's rules.
