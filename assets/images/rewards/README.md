# Daily check-in gift illustration

`gift-open-box.png` is the transparent opened box used in every revealed slot.
Created with the built-in `image_gen` tool from the user's second gift-dialog
reference. Prize icons, the existing Asinu mascot, names and received state are
rendered by the app rather than embedded in this image.

Opened-box generation prompt:

> Use case: stylized-concept. Asset type: one reusable transparent PNG illustration for an existing ASINU mobile app gift-opening interface. The attached user screenshot is a STYLE REFERENCE ONLY. Create ONLY ONE empty OPEN gift box, isolated, centered, no interface. Match the reference's charming glossy soft 3D mint-teal and off-white present, graceful teal ribbon, subtle dimensional shading and warm golden light inside. Three-quarter front view slightly from above: the square box body occupies the lower half, with a wide vertical teal ribbon on the white front. Its open cavity is clearly visible. The matching white-and-teal lid with a bow is lifted and tilted back toward the upper-left, visibly separated from the body. Leave generous clean NEGATIVE SPACE directly above the cavity at the upper-center/right so the app can overlay its own prize icon there. No contents inside the box: NO mascot, character, phone, coins, voucher, medical icons, heart, lettering, labels, numbers, watermark or logo. A compact soft mint elliptical contact shadow below the box and two tiny golden sparkles at the outer edges are allowed. Keep all objects compact within one square canvas, with generous transparent margins. Truly transparent background, no opaque panel, no backdrop, no grid, no other gifts. Render just this one empty opened gift box as a production UI asset.

`checkin-gift.png` is the transparent gift-box asset used by the daily check-in reward chooser. It is bundled locally and reused by the header and six choices.

Created with the built-in `image_gen` tool, using the gift chooser screenshot supplied by the user as a style reference. No CLI or external image URL is used at runtime.

Generation prompt:

> Use case: stylized-concept. Asset type: one reusable transparent PNG illustration for an existing Vietnamese ASINU mobile app daily check-in reward chooser. The supplied screenshot is a style reference only: generate a new isolated gift box matching its charming soft three-dimensional style. Subject: a small closed pale-mint and warm off-white square gift box, deep emerald-teal ribbon and a large graceful bow, an emerald heart seal on the front with a simple white heartbeat line. Front-facing with a very slight top view, soft dimensional shading, crisp readable silhouette at small mobile sizes. A subtle mint elliptical contact shadow directly under the gift; leave generous transparent padding on all sides. Only ONE gift, centered on genuinely transparent background. No interface, no cards, no words, no letters, no logo, no watermark, no background rectangle, no other gifts, no scattered confetti or extra objects. Preserve true alpha transparency. The asset will be repeated six times by React Native, so each generated pixel must belong to the single gift or its compact soft shadow.
